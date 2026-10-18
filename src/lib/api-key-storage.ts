import { ApiKeyItem, StoredClientKey, VerificationStatus, VerifyKeyResult } from '../types';

const STORAGE_KEYS = {
  VISITOR_ID: 'seo_architecture_visitor_id',
  API_KEYS: 'seo_architecture_api_keys',
  POOL_STATE: 'seo_architecture_key_pool_state',
  HISTORY: 'seo_architecture_history',
  PREFERENCES: 'seo_architecture_preferences',
};

interface StoredKeysPayload {
  version: number;
  keys: StoredClientKey[];
}

export function maskKey(rawKey: string): string {
  if (!rawKey || rawKey.length < 10) return '••••••••';
  return `${rawKey.substring(0, 6)}...${rawKey.substring(rawKey.length - 4)}`;
}

export function getOrCreateLocalVisitorId(): string {
  try {
    let visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
    if (!visitorId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        visitorId = crypto.randomUUID();
      } else {
        visitorId = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
    }
    return visitorId;
  } catch (e) {
    return `vis_${Date.now()}_fallback`;
  }
}

export function parseAndDeduplicateRawKeys(rawInput: string): string[] {
  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line);
      unique.push(line);
    }
  }

  return unique;
}

export function loadStoredKeys(): StoredClientKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.keys)) {
      return parsed.keys;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('[ApiKeyStorage] Gagal membaca keys dari localStorage:', err);
    return [];
  }
}

export function saveStoredKeys(keys: StoredClientKey[]): void {
  try {
    const payload: StoredKeysPayload = {
      version: 1,
      keys,
    };
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(payload));
  } catch (err) {
    console.error('[ApiKeyStorage] Gagal menyimpan keys ke localStorage:', err);
  }
}

export interface KeyToStoreInput {
  rawKey: string;
  verifiedAt: string;
  status?: 'READY' | 'COOLDOWN';
  verificationStatus?: VerificationStatus;
  cooldownUntil?: string;
  lastErrorReason?: string;
}

/**
 * Persists verified valid keys and cooldown keys (429) into localStorage.
 * Does NOT persist explicit invalid keys.
 */
export function addVerifiedKeysToStorage(
  verifiedKeys: KeyToStoreInput[]
): { addedCount: number; updatedCount: number } {
  if (!verifiedKeys || verifiedKeys.length === 0) {
    return { addedCount: 0, updatedCount: 0 };
  }

  const existing = loadStoredKeys();
  let addedCount = 0;
  let updatedCount = 0;

  for (const item of verifiedKeys) {
    const keyStatus = item.status || 'READY';
    const keyVerification = item.verificationStatus || 'VALID';

    const duplicateIndex = existing.findIndex((k) => k.rawKey === item.rawKey);
    if (duplicateIndex >= 0) {
      existing[duplicateIndex].status = keyStatus;
      existing[duplicateIndex].verificationStatus = keyVerification;
      existing[duplicateIndex].lastVerifiedAt = item.verifiedAt;
      existing[duplicateIndex].failureCount = 0;
      existing[duplicateIndex].cooldownUntil = item.cooldownUntil;
      existing[duplicateIndex].lastErrorReason = item.lastErrorReason;
      existing[duplicateIndex].updatedAt = item.verifiedAt;
      updatedCount++;
    } else {
      const id = `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newKey: StoredClientKey = {
        id,
        rawKey: item.rawKey,
        maskedKey: maskKey(item.rawKey),
        status: keyStatus,
        verificationStatus: keyVerification,
        lastVerifiedAt: item.verifiedAt,
        failureCount: 0,
        successCount: 0,
        cooldownUntil: item.cooldownUntil,
        lastErrorReason: item.lastErrorReason,
        createdAt: item.verifiedAt,
        updatedAt: item.verifiedAt,
      };
      existing.push(newKey);
      addedCount++;
    }
  }

  saveStoredKeys(existing);
  return { addedCount, updatedCount };
}

export function removeKeyFromStorage(id: string): StoredClientKey[] {
  const existing = loadStoredKeys();
  const updated = existing.filter((k) => k.id !== id);
  saveStoredKeys(updated);
  return updated;
}

export function updateStoredKeyVerification(
  id: string,
  result: VerifyKeyResult
): StoredClientKey | null {
  const existing = loadStoredKeys();
  const idx = existing.findIndex((k) => k.id === id);
  if (idx < 0) return null;

  const now = new Date().toISOString();
  const key = existing[idx];

  key.lastVerifiedAt = now;
  key.updatedAt = now;

  if (result.valid) {
    key.status = 'READY';
    key.verificationStatus = 'VALID';
    key.cooldownUntil = undefined;
    key.lastErrorReason = undefined;
  } else if (result.status === 'invalid') {
    key.status = 'INVALID';
    key.verificationStatus = 'INVALID';
    key.lastErrorReason = result.message;
  } else if (result.status === 'quota_limited') {
    key.status = 'COOLDOWN';
    key.verificationStatus = 'RATE_LIMIT';
    key.lastErrorReason = result.message;
    key.cooldownUntil = new Date(Date.now() + 60000).toISOString();
  } else {
    key.verificationStatus = 'UNAVAILABLE';
    key.lastErrorReason = result.message;
  }

  saveStoredKeys(existing);
  return key;
}

export function toPublicApiKeyItem(key: StoredClientKey): ApiKeyItem {
  return {
    id: key.id,
    maskedKey: key.maskedKey,
    status: key.status,
    verificationStatus: key.verificationStatus || 'VALID',
    lastVerifiedAt: key.lastVerifiedAt,
    failureCount: key.failureCount,
    successCount: key.successCount,
    lastUsedAt: key.lastUsedAt,
    lastFailureAt: key.lastFailureAt,
    cooldownUntil: key.cooldownUntil,
    lastErrorReason: key.lastErrorReason,
    createdAt: key.createdAt,
  };
}
