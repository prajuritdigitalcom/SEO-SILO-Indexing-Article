import {
  ApiKeyItem,
  BulkVerificationItemResult,
  BulkVerificationSummary,
  KeyPoolStats,
  StoredClientKey,
  VerifyKeyResult,
} from '../types';
import {
  addVerifiedKeysToStorage,
  loadStoredKeys,
  maskKey,
  parseAndDeduplicateRawKeys,
  saveStoredKeys,
  toPublicApiKeyItem,
  updateStoredKeyVerification,
} from './api-key-storage';
import { readApiResponse } from './api-client';

const POOL_STATE_KEY = 'seo_architecture_key_pool_state';

interface KeyPoolState {
  roundRobinIndex: number;
  totalRequests: number;
  totalFailovers: number;
}

export class ClientKeyPoolManager {
  private loadState(): KeyPoolState {
    try {
      const raw = localStorage.getItem(POOL_STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { roundRobinIndex: 0, totalRequests: 0, totalFailovers: 0 };
  }

  private saveState(state: KeyPoolState) {
    try {
      localStorage.setItem(POOL_STATE_KEY, JSON.stringify(state));
    } catch {}
  }

  /**
   * Performs real-time verification of a single Gemini API Key against /api/gemini/test.
   * Transient - key is not stored server-side.
   * Includes up to 2 automatic client-side retries for network errors and 5xx.
   */
  public async verifyApiKey(rawKey: string): Promise<VerifyKeyResult> {
    const trimmed = rawKey.trim();
    if (!trimmed || trimmed.length < 8) {
      return {
        valid: false,
        status: 'invalid',
        classification: 'INVALID_FORMAT',
        message: 'Format API Key tidak valid (terlalu pendek atau kosong).',
      };
    }

    const retryDelays = [2000, 5000];
    const maxAttempts = 1 + retryDelays.length;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await fetch('/api/gemini/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: trimmed }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await readApiResponse(res);

        // 1. Cek valid_unverified terlebih dahulu
        if (data.success === true && (data.status === 'valid_unverified' || data.classification === 'PROVIDER_BUSY')) {
          return {
            valid: true,
            status: 'valid_unverified',
            classification: 'PROVIDER_BUSY',
            message: data.message || 'Key diterima Google, tetapi model sedang sibuk. Key disimpan.',
            requestId: data.requestId,
          };
        }

        // 2. Key valid terverifikasi penuh
        if (data.valid === true) {
          return {
            valid: true,
            status: 'valid',
            classification: 'VALID',
            message: data.message || 'Koneksi Gemini API Berhasil!',
            requestId: data.requestId,
          };
        }

        // 3. Key salah atau dicabut (Google 401, 403, 400 API_KEY_INVALID)
        if (res.status === 401 || data.status === 'invalid' || data.classification === 'INVALID_KEY') {
          return {
            valid: false,
            status: 'invalid',
            classification: 'INVALID_KEY',
            message: data.message || 'API Key tidak valid atau telah dicabut.',
            requestId: data.requestId,
          };
        }

        // 4. Rate limit / Kuota habis (429)
        if (res.status === 429 || data.status === 'quota_limited' || data.classification === 'RATE_LIMIT') {
          return {
            valid: false,
            status: 'quota_limited',
            classification: 'RATE_LIMIT',
            message: data.message || 'API Key mencapai batas kuota / rate limit (429). Disimpan dalam status cooldown.',
            requestId: data.requestId,
          };
        }

        // 5. Model not found (404) tidak boleh membuat key ditolak
        if (res.status === 404 || data.status === 'model_unavailable' || data.classification === 'MODEL_NOT_FOUND') {
          return {
            valid: true,
            status: 'valid_unverified',
            classification: 'PROVIDER_BUSY',
            message: 'Model Gemini sedang dialihkan. Key disimpan.',
            requestId: data.requestId,
          };
        }

        // Jika status 5xx dan masih ada sisa retry
        if (res.status >= 500 && attempt < maxAttempts) {
          const delay = retryDelays[attempt - 1];
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return {
          valid: false,
          status: 'provider_unavailable',
          classification: data.classification || 'PROVIDER_ERROR',
          message: data.message || data.error || 'Layanan Gemini sedang tidak dapat dihubungi.',
          requestId: data.requestId,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (attempt < maxAttempts) {
          const delay = retryDelays[attempt - 1];
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return {
          valid: false,
          status: 'network_error',
          classification: 'NETWORK_ERROR',
          message: err?.message || 'Gagal menghubungi server verifikasi (Network Error).',
        };
      }
    }

    return {
      valid: false,
      status: 'provider_unavailable',
      classification: 'PROVIDER_ERROR',
      message: 'Layanan Gemini sedang tidak dapat dihubungi setelah percobaan ulang.',
    };
  }

  /**
   * Bulk Verification Workflow:
   * 1. Parses raw string into distinct keys.
   * 2. Runs sequential live verification against Gemini API.
   * 3. Persists ONLY keys that returned valid === true.
   * 4. Returns complete diagnostics summary.
   */
  public async verifyAndSaveBulkKeys(
    rawInput: string,
    onProgress?: (current: number, total: number, currentMasked: string) => void
  ): Promise<BulkVerificationSummary> {
    const rawKeys = parseAndDeduplicateRawKeys(rawInput);

    if (rawKeys.length === 0) {
      throw new Error('Tidak ada API Key yang dimasukkan.');
    }

    const existingKeys = loadStoredKeys();
    const existingRawSet = new Set(existingKeys.map((k) => k.rawKey));

    const results: BulkVerificationItemResult[] = [];
    const keysToStore: {
      rawKey: string;
      verifiedAt: string;
      status?: 'READY' | 'COOLDOWN';
      verificationStatus?: 'VALID' | 'RATE_LIMIT';
      cooldownUntil?: string;
      lastErrorReason?: string;
    }[] = [];

    let validCount = 0;
    let invalidCount = 0;
    let rateLimitCount = 0;
    let unavailableCount = 0;
    let alreadyExistingCount = 0;

    const CONCURRENCY = 3;
    let completedCount = 0;

    for (let start = 0; start < rawKeys.length; start += CONCURRENCY) {
      const batch = rawKeys.slice(start, start + CONCURRENCY);

      const batchResults = await Promise.all(
        batch.map(async (key) => {
          const masked = maskKey(key);
          const isExisting = existingRawSet.has(key);
          const verifyResult = await this.verifyApiKey(key);
          completedCount++;
          if (onProgress) {
            onProgress(completedCount, rawKeys.length, masked);
          }
          return { key, masked, isExisting, verifyResult };
        })
      );

      for (const { key, masked, isExisting, verifyResult } of batchResults) {
        const now = new Date().toISOString();

        results.push({
          rawKey: key,
          maskedKey: masked,
          valid: verifyResult.valid,
          status: verifyResult.status,
          message: verifyResult.message,
          isExisting,
        });

        if (verifyResult.valid) {
          validCount++;
          if (isExisting) {
            alreadyExistingCount++;
          }
          keysToStore.push({
            rawKey: key,
            verifiedAt: now,
            status: 'READY',
            verificationStatus: 'VALID',
          });
        } else if (verifyResult.status === 'quota_limited') {
          // Key benar tetapi kuota habis: SIMPAN dalam status COOLDOWN 60 detik
          rateLimitCount++;
          keysToStore.push({
            rawKey: key,
            verifiedAt: now,
            status: 'COOLDOWN',
            verificationStatus: 'RATE_LIMIT',
            cooldownUntil: new Date(Date.now() + 60000).toISOString(),
            lastErrorReason: verifyResult.message,
          });
        } else if (verifyResult.status === 'invalid') {
          // Hanya key yang benar-benar ditolak Google (HTTP 400 API_KEY_INVALID, 401, 403) yang tidak disimpan
          invalidCount++;
        } else {
          // provider_unavailable / network_error: sementara tidak terverifikasi
          unavailableCount++;
        }
      }
    }

    // Simpan semua key yang valid dan key yang terkena cooldown kuota
    if (keysToStore.length > 0) {
      addVerifiedKeysToStorage(keysToStore as any);
    }

    return {
      totalProcessed: rawKeys.length,
      validCount,
      invalidCount,
      rateLimitCount,
      unavailableCount,
      alreadyExistingCount,
      results,
    };
  }

  /**
   * Tests an already stored key by ID and updates its stored status.
   */
  public async testAndSyncStoredKey(keyId: string): Promise<VerifyKeyResult> {
    const rawKey = this.getRawKeyById(keyId);
    if (!rawKey) {
      return {
        valid: false,
        status: 'invalid',
        message: 'API Key tidak ditemukan di penyimpanan lokal browser.',
      };
    }

    const result = await this.verifyApiKey(rawKey);
    updateStoredKeyVerification(keyId, result);
    return result;
  }

  public refreshCooldowns(): StoredClientKey[] {
    const keys = loadStoredKeys();
    const now = new Date().getTime();
    let changed = false;

    for (const key of keys) {
      if (key.status === 'COOLDOWN' && key.cooldownUntil) {
        const cooldownTime = new Date(key.cooldownUntil).getTime();
        if (now >= cooldownTime) {
          key.status = 'READY';
          key.cooldownUntil = undefined;
          changed = true;
        }
      }
    }

    if (changed) {
      saveStoredKeys(keys);
    }
    return keys;
  }

  public getPublicKeys(): ApiKeyItem[] {
    const keys = this.refreshCooldowns();
    return keys.map((k) => toPublicApiKeyItem(k));
  }

  public getRawKeyById(id: string): string | null {
    const keys = loadStoredKeys();
    const found = keys.find((k) => k.id === id);
    return found ? found.rawKey : null;
  }

  public getNextExecutableKey(): {
    keyObj?: StoredClientKey;
    rawKey?: string;
    keyId?: string;
    isSystemFallback: boolean;
  } {
    const keys = this.refreshCooldowns();
    // Only keys that are READY and Verified
    const eligible = keys.filter(
      (k) => k.status === 'READY' && (k.verificationStatus === 'VALID' || !k.verificationStatus)
    );

    const state = this.loadState();
    state.totalRequests++;

    if (eligible.length > 0) {
      const selected = eligible[state.roundRobinIndex % eligible.length];
      state.roundRobinIndex = (state.roundRobinIndex + 1) % eligible.length;
      this.saveState(state);

      selected.lastUsedAt = new Date().toISOString();
      saveStoredKeys(keys);

      return {
        keyObj: selected,
        rawKey: selected.rawKey,
        keyId: selected.id,
        isSystemFallback: false,
      };
    }

    this.saveState(state);
    // No eligible visitor keys -> use system fallback on server
    return {
      isSystemFallback: true,
    };
  }

  public reportSuccess(keyId?: string) {
    if (!keyId) return;
    const keys = loadStoredKeys();
    const found = keys.find((k) => k.id === keyId);
    if (found) {
      found.status = 'READY';
      found.verificationStatus = 'VALID';
      found.successCount++;
      found.cooldownUntil = undefined;
      found.lastErrorReason = undefined;
      saveStoredKeys(keys);
    }
  }

  public reportError(keyId: string | undefined, error: any) {
    if (!keyId) return;
    const state = this.loadState();
    state.totalFailovers++;
    this.saveState(state);

    const keys = loadStoredKeys();
    const found = keys.find((k) => k.id === keyId);
    if (!found) return;

    const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    found.lastFailureAt = new Date().toISOString();
    found.lastErrorReason = errMsg.substring(0, 150);

    if (
      errMsg.includes('401') ||
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('invalid credential') ||
      errMsg.includes('PERMISSION_DENIED')
    ) {
      found.status = 'INVALID';
      found.verificationStatus = 'INVALID';
      found.failureCount++;
    } else if (
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('Quota') ||
      errMsg.includes('rate limit') ||
      errMsg.includes('RATE_LIMIT')
    ) {
      found.failureCount++;
      found.status = 'COOLDOWN';
      found.verificationStatus = 'RATE_LIMIT';

      // Adaptive Backoff: 30s, 60s, 120s, 300s
      let durationSec = 30;
      if (found.failureCount === 2) durationSec = 60;
      else if (found.failureCount === 3) durationSec = 120;
      else if (found.failureCount >= 4) durationSec = 300;

      const jitter = Math.floor(Math.random() * 10) - 5;
      const cooldownMs = Math.max(10, durationSec + jitter) * 1000;

      found.cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
    } else if (
      errMsg.includes('500') ||
      errMsg.includes('503') ||
      errMsg.includes('504') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('timeout')
    ) {
      found.status = 'COOLDOWN';
      found.verificationStatus = 'UNAVAILABLE';
      found.cooldownUntil = new Date(Date.now() + 15000).toISOString();
    } else {
      found.status = 'READY';
    }

    saveStoredKeys(keys);
  }

  public getStats(hasSystemFallbackServer: boolean = true): KeyPoolStats {
    const keys = this.refreshCooldowns();
    const state = this.loadState();

    const readyKeys = keys.filter(
      (k) => k.status === 'READY' && (k.verificationStatus === 'VALID' || !k.verificationStatus)
    ).length;
    const cooldownKeys = keys.filter((k) => k.status === 'COOLDOWN').length;
    const invalidKeys = keys.filter((k) => k.status === 'INVALID' || k.status === 'DISABLED').length;

    return {
      totalKeys: keys.length,
      readyKeys,
      cooldownKeys,
      invalidKeys,
      hasSystemFallback: hasSystemFallbackServer,
      activeRoundRobinIndex: state.roundRobinIndex,
      totalRequestsProcessed: state.totalRequests,
      totalFailoversTriggered: state.totalFailovers,
    };
  }
}

export const clientKeyPool = new ClientKeyPoolManager();
