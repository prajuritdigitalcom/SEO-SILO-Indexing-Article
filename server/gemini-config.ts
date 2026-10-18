import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

/**
 * Model default di kode diset ke 'gemini-3.6-flash' (stabil dan tidak rentan overload).
 * Aplikasi TIDAK bergantung pada env var apa pun untuk memilih model.
 * Env GEMINI_MODEL hanya override opsional bila diisi di masa depan.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';

/**
 * Model preferred diurutkan dari yang paling stabil di depan, 3.8 di paling belakang.
 */
export const GEMINI_PREFERRED_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

/**
 * Cadangan darurat (kualitas lebih rendah, tetapi aplikasi tetap jalan).
 * Dipakai jika semua model generasi 3.x preferred mengalami overload/gangguan.
 */
export const GEMINI_EMERGENCY_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

export const GEMINI_ALLOW_EMERGENCY_MODELS =
  process.env.GEMINI_ALLOW_EMERGENCY_MODELS !== undefined
    ? process.env.GEMINI_ALLOW_EMERGENCY_MODELS === 'true'
    : true; // Default true: prioritas utama pemilik adalah aplikasi tetap bisa dipakai!

/**
 * Daftar fallback statis gabungan.
 */
export const GEMINI_FALLBACK_MODELS: string[] = [
  GEMINI_MODEL,
  ...GEMINI_PREFERRED_MODELS.filter((m) => m !== GEMINI_MODEL),
  ...(GEMINI_ALLOW_EMERGENCY_MODELS ? GEMINI_EMERGENCY_MODELS : []),
].filter((m, i, arr) => arr.indexOf(m) === i);

// In-memory cache untuk daftar model per hash key (TTL: 10 menit)
interface ModelCacheEntry {
  models: string[];
  expiresAt: number;
}
const keyModelCache = new Map<string, ModelCacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

/**
 * Menyelesaikan daftar model yang benar-benar didukung & tersedia untuk API key tertentu.
 * Memanggil ai.models.list (timeout 8 dtk).
 * Hasil diurutkan berdasarkan GEMINI_PREFERRED_MODELS, lalu GEMINI_EMERGENCY_MODELS (jika diizinkan).
 * Jika list gagal atau kosong, fallback ke GEMINI_FALLBACK_MODELS statis tanpa melempar error.
 */
export async function resolveModelsForKey(ai: GoogleGenAI, apiKey: string): Promise<string[]> {
  const trimmed = apiKey?.trim();
  if (!trimmed) {
    return GEMINI_FALLBACK_MODELS;
  }

  const keyHash = hashApiKey(trimmed);
  const cached = keyModelCache.get(keyHash);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.models;
  }

  try {
    let timeoutTimer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new Error('models.list timeout (8 detik)'));
      }, 8000);
      if (typeof timeoutTimer.unref === 'function') timeoutTimer.unref();
    });

    const pager: any = await Promise.race([
      ai.models.list({ config: { pageSize: 50 } }),
      timeoutPromise,
    ]).finally(() => {
      clearTimeout(timeoutTimer!);
    });

    const availableNames = new Set<string>();

    const items = pager?.page || pager?.models || (Array.isArray(pager) ? pager : []);
    if (Array.isArray(items)) {
      for (const item of items) {
        const rawName = item?.name || '';
        // Nama model berformat "models/gemini-3.6-flash" -> buang awalan "models/"
        const cleanName = rawName.replace(/^models\//, '').trim();
        if (!cleanName) continue;

        // Cek supportedActions jika field tersebut ada
        if (Array.isArray(item?.supportedActions)) {
          if (item.supportedActions.includes('generateContent')) {
            availableNames.add(cleanName);
          }
        } else {
          availableNames.add(cleanName);
        }
      }
    }

    const resolved: string[] = [];

    // 1. Ambil model yang disukai (preferred) jika tersedia
    for (const m of GEMINI_PREFERRED_MODELS) {
      if (availableNames.has(m)) {
        resolved.push(m);
      }
    }

    // 2. Ambil model darurat jika diizinkan dan tersedia
    if (GEMINI_ALLOW_EMERGENCY_MODELS) {
      for (const m of GEMINI_EMERGENCY_MODELS) {
        if (availableNames.has(m) && !resolved.includes(m)) {
          resolved.push(m);
        }
      }
    }

    const finalModels = resolved.length > 0 ? resolved : GEMINI_FALLBACK_MODELS;

    keyModelCache.set(keyHash, {
      models: finalModels,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return finalModels;
  } catch (err: any) {
    // Jangan pernah throw hanya karena models.list gagal — gunakan fallback statis
    console.warn(`[GEMINI MODEL RESOLVE] models.list gagal (${err?.message || err}), menggunakan fallback statis.`);
    return GEMINI_FALLBACK_MODELS;
  }
}
