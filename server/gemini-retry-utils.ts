import { GEMINI_FALLBACK_MODELS, GEMINI_MODEL } from './gemini-config.js';

export function getErrorStatus(err: any): number | undefined {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.code === 'number') return err.code;
  const m = String(err?.message || '').match(/"code"\s*:\s*(\d{3})/);
  return m ? Number(m[1]) : undefined;
}

export function logUpstreamError(requestId: string, model: string, err: any): void {
  const status = getErrorStatus(err);
  const msg = String(err?.message || err)
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[REDACTED]')
    .replace(/AQ\.[0-9A-Za-z_\-\.]{10,}/g, '[REDACTED]')
    .slice(0, 500);
  console.log(
    `[KEY VERIFY UPSTREAM] requestId=${requestId} model=${model} httpStatus=${status ?? 'n/a'} message="${msg}"`
  );
}

/**
 * Memeriksa apakah error merupakan penolakan API key secara eksplisit dari Google:
 * HTTP 401, 403, atau HTTP 400 dengan alasan API_KEY_INVALID / API key not valid dsb.
 */
export function isExplicitKeyRejection(err: any): boolean {
  const status = getErrorStatus(err);
  const msg = String(err?.message || err || '');

  if (status === 401 || status === 403) return true;

  if (
    /API_KEY_INVALID|API_KEY_SERVICE_BLOCKED|API key not valid|API key expired|PERMISSION_DENIED/i.test(
      msg
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Memeriksa apakah error merupakan rate limit / kuota habis (429 / RESOURCE_EXHAUSTED).
 */
export function isRateLimitError(err: any): boolean {
  const status = getErrorStatus(err);
  const msg = String(err?.message || err || '');

  return (
    status === 429 ||
    /\b429\b|RESOURCE_EXHAUSTED|Quota|rate limit|Resource has been exhausted/i.test(msg)
  );
}

export function isModelNotFoundError(err: any): boolean {
  const status = getErrorStatus(err);
  const msg = String(err?.message || err || '');

  return (
    status === 404 ||
    /\b404\b|NOT_FOUND|is not found|model not found|model does not exist/i.test(msg)
  );
}

export function isOverloadedOrUnavailableError(err: any): boolean {
  const status = getErrorStatus(err);
  const msg = String(err?.message || err || '');

  return (
    status === 503 ||
    /\b503\b|UNAVAILABLE|high demand|overloaded|spikes in demand/i.test(msg)
  );
}

export function isTransientError(err: any): boolean {
  const status = getErrorStatus(err);
  const msg = String(err?.message || err || '');

  return (
    isOverloadedOrUnavailableError(err) ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    /\b500\b|\b502\b|\b504\b|fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network error|socket hang up/i.test(
      msg
    )
  );
}

export function calculateBackoffDelay(attempt: number, baseDelayMs = 1200): number {
  const exponential = baseDelayMs * Math.pow(1.8, attempt - 1);
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(exponential * jitterFactor);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GenerateContentFn = (model: string) => Promise<any>;

// Timeout per percobaan default 90 detik, bisa disesuaikan via env
const DEFAULT_ATTEMPT_TIMEOUT_MS = process.env.GEMINI_ATTEMPT_TIMEOUT_MS
  ? Number(process.env.GEMINI_ATTEMPT_TIMEOUT_MS)
  : 90000;

// Batas total eksekusi agar tidak terpotong hard-kill Vercel 300 detik
const TOTAL_DEADLINE_MS = 270000;

/**
 * Menjalankan pemanggilan Gemini API dengan:
 * 1. Urutan model cascade dinamis / preferred -> emergency.
 * 2. Timeout per percobaan (default 90 detik) dan deadline total (270 detik).
 * 3. Jika suatu model mengembalikan 404 (model not found), timeout, atau 400 (unsupported config):
 *    otomatis beralih ke model berikutnya tanpa menghentikan proses!
 * 4. Hanya jika key benar-benar ditolak Google (API_KEY_INVALID) atau 429 (kuota habis) yang langsung throw
 *    agar frontend key pool dapat segera failover ke key lain.
 * 5. Model pertama diberi 1 retry backoff singkat (1-2 detik) bila 503. Model berikutnya dicoba 1x langsung.
 */
export async function executeWithParseRetry<T>(
  generateFn: GenerateContentFn | (() => Promise<any>),
  modelsToTry: string[] = GEMINI_FALLBACK_MODELS,
  maxParseAttempts = 2,
  requestId = 'req_gen'
): Promise<T> {
  const models = modelsToTry && modelsToTry.length > 0 ? modelsToTry : [GEMINI_MODEL];
  const executionStartTime = Date.now();
  let lastError: any;
  let allModelsFailedDueToOverload = true;

  for (let mIdx = 0; mIdx < models.length; mIdx++) {
    const currentModel = models[mIdx];
    const isPrimaryModel = mIdx === 0;

    // Cek sisa waktu terhadap deadline total Vercel (270 dtk). Butuh setidaknya 25 dtk untuk mencoba model baru.
    const elapsedTime = Date.now() - executionStartTime;
    const remainingTime = TOTAL_DEADLINE_MS - elapsedTime;
    if (remainingTime < 25000 && mIdx > 0) {
      console.warn(
        `[Gemini Execution Deadline] Sisa waktu (${remainingTime}ms) tidak cukup untuk mencoba model '${currentModel}'. Menghentikan cascade.`
      );
      break;
    }

    // Hitung timeout untuk percobaan model saat ini (tidak melebihi sisa waktu)
    const currentAttemptTimeoutMs = Math.min(DEFAULT_ATTEMPT_TIMEOUT_MS, Math.max(15000, remainingTime - 5000));

    // Hanya model pertama yang dapat 1 retry ekstra bila 503 (total 2 percobaan). Model lainnya 1 percobaan.
    const maxCallAttempts = isPrimaryModel ? 2 : 1;

    for (let callAttempt = 1; callAttempt <= maxCallAttempts; callAttempt++) {
      let response: any;

      try {
        // Bungkus percobaan pemanggilan dengan timeout per attempt
        let attemptTimer: NodeJS.Timeout;
        const attemptTimeoutPromise = new Promise<never>((_, reject) => {
          attemptTimer = setTimeout(() => {
            reject(new Error(`Timeout percobaan model '${currentModel}' (${currentAttemptTimeoutMs}ms)`));
          }, currentAttemptTimeoutMs);
          if (typeof attemptTimer.unref === 'function') attemptTimer.unref();
        });

        const rawPromise = (generateFn as any)(currentModel);

        response = await Promise.race([rawPromise, attemptTimeoutPromise]).finally(() => {
          clearTimeout(attemptTimer!);
        });
      } catch (callErr: any) {
        lastError = callErr;
        logUpstreamError(requestId, currentModel, callErr);
        const errMsg = callErr?.message || String(callErr);

        // A. Key ditolak Google: FAIL-FAST seketika agar key-pool di frontend dapat rotasi/tandai key
        if (isExplicitKeyRejection(callErr)) {
          throw callErr;
        }

        // B. Rate limit 429: FAIL-FAST agar key-pool bisa menaruh key di cooldown dan rotasi
        if (isRateLimitError(callErr)) {
          throw callErr;
        }

        // C. Model Not Found (404): Bukan alasan gagalkan key! Pindah ke model berikutnya langsung!
        if (isModelNotFoundError(callErr)) {
          console.warn(
            `[Gemini Model 404] Model '${currentModel}' tidak ditemukan untuk key ini. Mencoba model berikutnya...`
          );
          allModelsFailedDueToOverload = false;
          break; // Lanjut ke model berikutnya di array models
        }

        // D. Timeout percobaan pada model ini: Jangan langsung throw total! Coba model berikutnya
        if (errMsg.includes('Timeout percobaan model') || errMsg.includes('aborted')) {
          console.warn(
            `[Gemini Model Timeout] Model '${currentModel}' tidak merespons dalam ${currentAttemptTimeoutMs}ms. Mencoba model berikutnya...`
          );
          allModelsFailedDueToOverload = false;
          break;
        }

        const isOverload = isOverloadedOrUnavailableError(callErr);
        const isTransient = isTransientError(callErr);

        if (!isOverload) {
          allModelsFailedDueToOverload = false;
        }

        // E. 503 / UNAVAILABLE / Overload
        if (isOverload) {
          if (callAttempt < maxCallAttempts) {
            const delayMs = calculateBackoffDelay(callAttempt, 1200);
            console.warn(
              `[Gemini Overload] Percobaan ${callAttempt}/${maxCallAttempts} model '${currentModel}' overloaded (503). Menunggu ${delayMs}ms...`
            );
            await sleep(delayMs);
            continue;
          }

          console.warn(
            `[Gemini Model Fallback] Model '${currentModel}' tetap overload setelah percobaan. Pindah ke model berikutnya...`
          );
          break;
        }

        // F. Error 400 non-key (misal parameter / thinkingConfig tidak didukung model ini):
        // Pindah ke model berikutnya
        const status = getErrorStatus(callErr);
        if (status === 400) {
          console.warn(
            `[Gemini 400 Config] Model '${currentModel}' menolak konfigurasi parameter (bukan key). Mencoba model berikutnya...`
          );
          allModelsFailedDueToOverload = false;
          break;
        }

        // G. Error transient lain (500, 502, 504, network)
        if (isTransient) {
          console.warn(
            `[Gemini Transient Error] Model '${currentModel}' error jaringan (${errMsg}). Mencoba model berikutnya...`
          );
          break;
        }

        // Error lainnya yang tidak dikenal: coba model berikutnya untuk berjaga-jaga
        console.warn(
          `[Gemini Error] Model '${currentModel}' gagal (${errMsg}). Mencoba model cadangan berikutnya...`
        );
        allModelsFailedDueToOverload = false;
        break;
      }

      // Validasi respons dan parsing JSON
      let formatSuccess = false;
      let parsedData: T | undefined;

      for (let parseAttempt = 1; parseAttempt <= maxParseAttempts; parseAttempt++) {
        const rawText = response?.text?.trim() || '';

        if (!rawText) {
          lastError = new Error(`Respons kosong dari model '${currentModel}'.`);
          if (parseAttempt < maxParseAttempts) {
            console.warn(
              `[Gemini Parse Retry] Format attempt ${parseAttempt} model '${currentModel}' kosong, mencoba generate ulang cepat...`
            );
            try {
              response = await (generateFn as any)(currentModel);
              continue;
            } catch (retryErr: any) {
              lastError = retryErr;
              break;
            }
          }
          break;
        }

        try {
          parsedData = JSON.parse(rawText) as T;
          formatSuccess = true;
          break;
        } catch (parseErr: any) {
          lastError = parseErr;
          if (parseAttempt < maxParseAttempts) {
            console.warn(
              `[Gemini Parse Retry] Format attempt ${parseAttempt} model '${currentModel}' JSON parse gagal, mencoba generate ulang cepat...`
            );
            try {
              response = await (generateFn as any)(currentModel);
              continue;
            } catch (retryErr: any) {
              lastError = retryErr;
              break;
            }
          }
          break;
        }
      }

      if (formatSuccess && parsedData !== undefined) {
        return parsedData;
      }
    }
  }

  // Jika semua model gagal
  if (allModelsFailedDueToOverload) {
    throw new Error(
      'Semua model Gemini sedang sibuk atau tidak merespons (503 UNAVAILABLE). Silakan coba generate lagi dalam 1-2 menit.'
    );
  }

  if (lastError?.message?.includes('Respons kosong')) {
    throw new Error('Respons kosong dari Gemini model setelah mencoba seluruh model yang tersedia.');
  }

  if (lastError?.name === 'SyntaxError' || lastError?.message?.includes('JSON')) {
    throw new Error(
      'Gemini mengembalikan format data yang tidak valid setelah mencoba seluruh model cadangan.'
    );
  }

  throw new Error(
    lastError?.message ||
      'Semua model Gemini sedang sibuk atau tidak merespons. Coba lagi dalam 1-2 menit.'
  );
}
