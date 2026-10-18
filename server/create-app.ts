import express, { Express } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODEL,
  GEMINI_PREFERRED_MODELS,
  resolveModelsForKey,
} from './gemini-config.js';
import { generateLevel1Architecture } from './level1-engine.js';
import { generateSiloPagesFromKeywords } from './level1-add-pages-engine.js';
import { generateLevel2Architecture } from './level2-engine.js';
import { buildReadyToPastePrompt } from './prompt-engine.js';
import {
  getErrorStatus,
  isExplicitKeyRejection,
  isModelNotFoundError,
  isOverloadedOrUnavailableError,
  isRateLimitError,
  isTransientError,
  logUpstreamError,
} from './gemini-retry-utils.js';

dotenv.config();

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function classifyError(error: any): string {
  const errMsg = error?.message || String(error);
  const status = getErrorStatus(error);

  // 1. Timeout INTERNAL aplikasi
  if (errMsg.includes('melebihi batas waktu')) {
    return 'GENERATION_TIMEOUT';
  }

  // 2. KEY DITOLAK (Google HTTP 400 API_KEY_INVALID, 401, 403, PERMISSION_DENIED)
  if (isExplicitKeyRejection(error)) {
    return 'INVALID_KEY';
  }

  // 3. Kuota / Rate Limit (HTTP 429 / RESOURCE_EXHAUSTED)
  if (isRateLimitError(error)) {
    return 'RATE_LIMIT';
  }

  // 4. Model tidak ditemukan (HTTP 404 / NOT_FOUND) — ini BUKAN key salah!
  if (isModelNotFoundError(error)) {
    return 'MODEL_NOT_FOUND';
  }

  // 5. Provider Overload / Error Server (HTTP 500/502/503/504 / UNAVAILABLE)
  if (isOverloadedOrUnavailableError(error) || status === 500 || status === 502 || status === 504) {
    return 'PROVIDER_ERROR';
  }

  // 6. Jaringan / Timeout
  if (
    errMsg.includes('fetch failed') ||
    errMsg.includes('timeout') ||
    errMsg.includes('timed out') ||
    errMsg.includes('aborted') ||
    errMsg.includes('ECONNREFUSED') ||
    errMsg.includes('ETIMEDOUT') ||
    errMsg.includes('ECONNRESET') ||
    errMsg.includes('network error')
  ) {
    return 'NETWORK_TIMEOUT';
  }

  // 7. Generic error (status 400 lain seperti parameter schema bukan INVALID_KEY)
  return 'GENERIC_ERROR';
}

/**
 * Executes a promise with an explicit timeout
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export function createApp(): Express {
  const app = express();

  console.log(`[CONFIG] geminiModel=${GEMINI_MODEL}`);

  app.use(express.json({ limit: '10mb' }));

  // Request logger middleware (never logs sensitive API keys)
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = generateRequestId();
    res.locals.requestId = requestId;

    res.on('finish', () => {
      if (req.path.startsWith('/api/')) {
        const duration = Date.now() - start;
        console.log(
          `[API ${req.method}] path=${req.path} status=${res.statusCode} duration=${duration}ms requestId=${requestId}`
        );
      }
    });

    next();
  });

  // Gate Lockout Tracker: In-memory store per client
  interface GateAttemptRecord {
    failedAttempts: number;
    lockedUntil: number | null;
  }
  const gateAttemptsMap = new Map<string, GateAttemptRecord>();
  const LOCKOUT_DURATION_MS = 12 * 60 * 60 * 1000; // 12 Hours in milliseconds
  const MAX_ALLOWED_ATTEMPTS = 3;

  function getClientGateKey(req: express.Request, visitorId?: string): string {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const vId = (visitorId || (req.headers['x-visitor-id'] as string) || '').trim();
    return vId ? `${rawIp}_${vId}` : rawIp;
  }

  // 0. Gate Auth Status check
  app.get('/api/auth/gate-status', (req, res) => {
    const visitorId = (req.query.visitorId as string) || '';
    const key = getClientGateKey(req, visitorId);
    const record = gateAttemptsMap.get(key);

    if (record?.lockedUntil && Date.now() < record.lockedUntil) {
      return res.json({
        isLocked: true,
        lockedUntil: record.lockedUntil,
        remainingTimeMs: record.lockedUntil - Date.now(),
        remainingAttempts: 0,
      });
    }

    if (record?.lockedUntil && Date.now() >= record.lockedUntil) {
      gateAttemptsMap.delete(key);
    }

    const currentFails = record?.failedAttempts || 0;
    const remaining = Math.max(0, MAX_ALLOWED_ATTEMPTS - currentFails);

    res.json({
      isLocked: false,
      remainingAttempts: remaining,
      totalMaxAttempts: MAX_ALLOWED_ATTEMPTS,
    });
  });

  // 0. Gate Password Verification
  app.post('/api/auth/verify-gate', (req, res) => {
    const { password, visitorId } = req.body;
    const clientKey = getClientGateKey(req, visitorId);
    let record = gateAttemptsMap.get(clientKey);

    // Check if client is currently locked out
    if (record?.lockedUntil && Date.now() < record.lockedUntil) {
      return res.status(429).json({
        success: false,
        isLocked: true,
        lockedUntil: record.lockedUntil,
        remainingTimeMs: record.lockedUntil - Date.now(),
        remainingAttempts: 0,
        error: 'Aplikasi masih terkunci selama 12 jam karena salah memasukkan password 3 kali.',
      });
    }

    // Reset lock if expired
    if (record?.lockedUntil && Date.now() >= record.lockedUntil) {
      record = undefined;
      gateAttemptsMap.delete(clientKey);
    }

    const configuredPassword = process.env.PASSWORD || process.env.APP_PASSWORD || 'seosilo@prajuritdigital.com';
    const inputPassword = typeof password === 'string' ? password.trim() : '';

    if (inputPassword === configuredPassword) {
      // Clear any failed attempts on success
      gateAttemptsMap.delete(clientKey);

      const sessionToken = `pd_auth_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      return res.json({
        success: true,
        message: 'Akses berhasil dibuka.',
        token: sessionToken,
      });
    }

    // Wrong password handling
    const currentFails = (record?.failedAttempts || 0) + 1;
    if (currentFails >= MAX_ALLOWED_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      gateAttemptsMap.set(clientKey, {
        failedAttempts: currentFails,
        lockedUntil: lockUntil,
      });

      return res.status(403).json({
        success: false,
        isLocked: true,
        lockedUntil: lockUntil,
        remainingAttempts: 0,
        error: 'Password salah sebanyak 3 kali! Input dikunci selama 12 jam.',
      });
    }

    gateAttemptsMap.set(clientKey, {
      failedAttempts: currentFails,
      lockedUntil: null,
    });

    const remaining = MAX_ALLOWED_ATTEMPTS - currentFails;
    return res.status(401).json({
      success: false,
      isLocked: false,
      remainingAttempts: remaining,
      error: `Password salah! Sisa percobaan: ${remaining} dari ${MAX_ALLOWED_ATTEMPTS}.`,
    });
  });

  // 1. Health check
  app.get('/api/health', (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    res.json({
      success: true,
      api: true,
      geminiModel: GEMINI_MODEL,
      timestamp: new Date().toISOString(),
      hasSystemFallback: !!process.env.GEMINI_API_KEY,
      environment: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
      requestId,
    });
  });

  // 2. Gemini Connection Test (Tiered Stateless Verification)
  async function verifyKeyTiered(
    ai: GoogleGenAI,
    requestId: string
  ): Promise<{ outcome: 'valid' | 'valid_unverified'; via?: string }> {
    // TAHAP A - Cek key tanpa generate (hanya models.list)
    try {
      await withTimeout(
        ai.models.list({ config: { pageSize: 5 } }),
        8000,
        'Permintaan verifikasi Gemini melebihi batas waktu (timeout 8 detik).'
      );
      return { outcome: 'valid', via: 'models.list' };
    } catch (e: any) {
      logUpstreamError(requestId, 'models.list', e);
      const kind = classifyError(e);
      if (kind === 'INVALID_KEY' || kind === 'RATE_LIMIT') throw e;
    }

    // TAHAP B - Generate ringan lewat cascade model (Ping tanpa thinkingConfig)
    const testModels = GEMINI_PREFERRED_MODELS.slice(0, 3);
    for (const model of testModels) {
      try {
        const r = await withTimeout(
          ai.models.generateContent({
            model,
            contents: 'Ping',
            config: { maxOutputTokens: 16 }, // tanpa thinkingConfig
          }),
          12000,
          'Permintaan verifikasi Gemini melebihi batas waktu (timeout 12 detik).'
        );
        if (r?.text) return { outcome: 'valid', via: model };
      } catch (e: any) {
        logUpstreamError(requestId, model, e);
        const kind = classifyError(e);
        if (kind === 'INVALID_KEY' || kind === 'RATE_LIMIT') throw e;
        // PROVIDER_ERROR / GENERATION_TIMEOUT / MODEL_NOT_FOUND -> coba model berikutnya
      }
    }

    // TAHAP C - Semua gagal tetapi TIDAK ada penolakan key: simpan key sebagai valid_unverified
    return { outcome: 'valid_unverified' };
  }

  app.post(['/api/gemini/test', '/api/keys/test'], async (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    const startTime = Date.now();
    const { key } = req.body;
    const isExplicitUserKey = typeof key === 'string';
    const keyToTest = isExplicitUserKey ? key.trim() : (process.env.GEMINI_API_KEY || '');

    if (!keyToTest) {
      console.log(
        `[KEY VERIFY] requestId=${requestId} status=missing_key classification=INVALID_FORMAT durationMs=${Date.now() - startTime}`
      );
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'invalid_format',
        classification: 'INVALID_FORMAT',
        message: 'API Key tidak boleh kosong.',
        requestId,
      });
    }

    // Sanity check format longgar
    if (/\s/.test(keyToTest) || keyToTest.length < 10) {
      console.log(
        `[KEY VERIFY] requestId=${requestId} status=invalid_format classification=INVALID_FORMAT durationMs=${Date.now() - startTime}`
      );
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'invalid_format',
        classification: 'INVALID_FORMAT',
        message: 'API Key terlalu pendek atau mengandung spasi/baris baru yang tidak valid.',
        requestId,
      });
    }

    const keyPrefix = keyToTest.slice(0, 4);
    console.log(
      `[KEY VERIFY START] requestId=${requestId} keyLength=${keyToTest.length} keyPrefix=${keyPrefix}***`
    );

    try {
      const ai = new GoogleGenAI({
        apiKey: keyToTest,
      });

      const verification = await verifyKeyTiered(ai, requestId);
      const durationMs = Date.now() - startTime;

      if (verification.outcome === 'valid') {
        console.log(
          `[KEY VERIFY SUCCESS] requestId=${requestId} via=${verification.via || 'models.list'} durationMs=${durationMs}`
        );
        return res.json({
          success: true,
          valid: true,
          status: 'valid',
          geminiModel: verification.via || 'models.list',
          message: 'Koneksi Gemini API Berhasil!',
          requestId,
        });
      }

      console.log(
        `[KEY VERIFY UNVERIFIED] requestId=${requestId} classification=PROVIDER_BUSY durationMs=${durationMs}`
      );
      return res.json({
        success: true,
        valid: true,
        status: 'valid_unverified',
        classification: 'PROVIDER_BUSY',
        requestId,
        message:
          'Key diterima Google, tetapi model sedang sibuk. Key disimpan dan akan dicoba lagi saat generate.',
      });
    } catch (err: any) {
      const classification = classifyError(err);
      const durationMs = Date.now() - startTime;

      if (classification === 'INVALID_KEY') {
        console.log(
          `[KEY VERIFY INVALID] requestId=${requestId} classification=INVALID_KEY durationMs=${durationMs}`
        );
        return res.status(401).json({
          success: false,
          valid: false,
          status: 'invalid',
          message: 'API Key tidak valid atau telah dicabut.',
          classification,
          requestId,
        });
      }

      if (classification === 'RATE_LIMIT') {
        console.log(
          `[KEY VERIFY] requestId=${requestId} status=rate_limit classification=RATE_LIMIT durationMs=${durationMs}`
        );
        return res.status(429).json({
          success: false,
          valid: false,
          status: 'quota_limited',
          message: 'API Key telah mencapai batas kuota / rate limit (429).',
          classification,
          requestId,
        });
      }

      // Untuk error selain penolakan eksplisit key dan rate limit:
      // Jangan menolak key! Simpan sebagai valid_unverified agar user tetap bisa menggunakan aplikasinya.
      console.log(
        `[KEY VERIFY UNVERIFIED FALLBACK] requestId=${requestId} classification=${classification} durationMs=${durationMs}`
      );
      return res.json({
        success: true,
        valid: true,
        status: 'valid_unverified',
        classification: 'PROVIDER_BUSY',
        requestId,
        message:
          'Key diterima Google, tetapi model sedang sibuk. Key disimpan dan akan dicoba lagi saat generate.',
      });
    }
  });

  // Diagnostic Endpoint: Mengecek model yang tersedia untuk key tertentu
  app.all(['/api/gemini/models', '/api/models'], async (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    const queryKey = typeof req.query.key === 'string' ? req.query.key : undefined;
    const bodyKey = typeof req.body?.key === 'string' ? req.body.key : undefined;
    const keyToUse = (queryKey || bodyKey || process.env.GEMINI_API_KEY || '').trim();

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: 'API Key tidak boleh kosong.',
        requestId,
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: keyToUse });
      const models = await resolveModelsForKey(ai, keyToUse);
      return res.json({
        success: true,
        requestId,
        availableModels: models,
        primaryModel: GEMINI_MODEL,
        preferredModels: GEMINI_PREFERRED_MODELS,
        fallbackModels: GEMINI_FALLBACK_MODELS,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        requestId,
        error: err?.message || 'Gagal mengambil daftar model.',
      });
    }
  });

  // 3. Level 1 Architecture Generation
  app.post('/api/generate/level1', async (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    try {
      const {
        apiKey,
        topic,
        targetAudience,
        websiteType,
        businessContext,
        location,
        authorExpertise,
        referenceText,
        manualSiloStructure,
        writingVoiceSample,
        websiteUrl,
      } = req.body;
      if (!topic || topic.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Topik wajib diisi', requestId });
      }

      const result = await generateLevel1Architecture({
        apiKey,
        topic,
        targetAudience,
        websiteType,
        businessContext,
        location,
        authorExpertise,
        referenceText,
        manualSiloStructure,
        writingVoiceSample,
        websiteUrl,
      });

      res.json({ success: true, result, requestId });
    } catch (err: any) {
      const classification = classifyError(err);
      console.error(
        `[API ERROR] requestId=${requestId} method=POST path=/api/generate/level1 stage=gemini classification=${classification}`
      );

      const statusCode =
        classification === 'RATE_LIMIT'
          ? 429
          : classification === 'INVALID_KEY'
          ? 401
          : classification === 'MODEL_NOT_FOUND'
          ? 404
          : 500;
      res.status(statusCode).json({
        success: false,
        error: err?.message || 'Gagal memproses Level 1 Architecture',
        classification,
        requestId,
      });
    }
  });

  // 3b. Level 1 — Tambah Rancangan Halaman dari List Kata Kunci
  app.post('/api/generate/level1/add-pages-from-keywords', async (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    try {
      const {
        apiKey,
        keywords,
        topic,
        websiteType,
        targetAudience,
        businessContext,
        location,
        authorExpertise,
        referenceText,
        writingVoiceSample,
        websiteUrl,
        existingSiloPages,
        existingClusters,
      } = req.body;

      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ success: false, error: 'Minimal 1 kata kunci wajib diisi', requestId });
      }

      const cleanedKeywords = keywords
        .map((k: any) => (typeof k === 'string' ? k.trim() : ''))
        .filter((k: string) => k.length > 0);

      if (cleanedKeywords.length === 0) {
        return res.status(400).json({ success: false, error: 'Kata kunci tidak boleh kosong', requestId });
      }
      if (cleanedKeywords.length > 5) {
        return res.status(400).json({
          success: false,
          error: 'Maksimal 5 kata kunci dapat diproses dalam satu kali permintaan',
          requestId,
        });
      }
      if (!topic || topic.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Konteks topik Level 1 wajib disertakan', requestId });
      }

      const result = await generateSiloPagesFromKeywords({
        apiKey,
        keywords: cleanedKeywords,
        topic,
        websiteType,
        targetAudience,
        businessContext,
        location,
        authorExpertise,
        referenceText,
        writingVoiceSample,
        websiteUrl,
        existingSiloPages: Array.isArray(existingSiloPages) ? existingSiloPages : [],
        existingClusters: Array.isArray(existingClusters) ? existingClusters : [],
      });

      res.json({ success: true, result, requestId });
    } catch (err: any) {
      const classification = classifyError(err);
      console.error(
        `[API ERROR] requestId=${requestId} method=POST path=/api/generate/level1/add-pages-from-keywords classification=${classification}`
      );
      const statusCode =
        classification === 'RATE_LIMIT'
          ? 429
          : classification === 'INVALID_KEY'
          ? 401
          : classification === 'MODEL_NOT_FOUND'
          ? 404
          : 500;
      res.status(statusCode).json({
        success: false,
        error: err?.message || 'Gagal menghasilkan rancangan halaman baru dari kata kunci',
        classification,
        requestId,
      });
    }
  });

  // 4. Level 2 Page Architecture Generation
  app.post('/api/generate/level2', async (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    try {
      const {
        apiKey,
        topic,
        selectedPageTitle,
        selectedPageRole,
        pageSlug,
        lockedFocusKeyword,
        cluster,
        parentPage,
        childPages,
        relatedPages,
        sourceLevel1Id,
        referenceMaterials,
        writingVoiceSample,
        websiteUrl,
        knownPages,
        targetAudience,
        websiteType,
        businessContext,
        location,
        authorExpertise,
        lockedIntent,
        lockedPrimaryEntity,
        lockedSupportingEntities,
        pageRationale,
      } = req.body;

      if (!selectedPageTitle || selectedPageTitle.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Judul halaman pilihan wajib diisi', requestId });
      }

      const result = await generateLevel2Architecture({
        apiKey,
        topic,
        selectedPageTitle,
        selectedPageRole,
        pageSlug,
        lockedFocusKeyword,
        cluster,
        parentPage,
        childPages,
        relatedPages,
        sourceLevel1Id,
        referenceMaterials,
        writingVoiceSample,
        websiteUrl,
        knownPages,
        targetAudience,
        websiteType,
        businessContext,
        location,
        authorExpertise,
        lockedIntent,
        lockedPrimaryEntity,
        lockedSupportingEntities,
        pageRationale,
      });

      res.json({ success: true, result, requestId });
    } catch (err: any) {
      const classification = classifyError(err);
      console.error(
        `[API ERROR] requestId=${requestId} method=POST path=/api/generate/level2 stage=gemini classification=${classification}`
      );

      const statusCode =
        classification === 'RATE_LIMIT'
          ? 429
          : classification === 'INVALID_KEY'
          ? 401
          : classification === 'MODEL_NOT_FOUND'
          ? 404
          : 500;
      res.status(statusCode).json({
        success: false,
        error: err?.message || 'Gagal memproses Level 2 Page Architecture',
        classification,
        requestId,
      });
    }
  });

  // 5. Prompt Generation
  app.post('/api/generate/prompt', (req, res) => {
    const requestId = res.locals.requestId || generateRequestId();
    try {
      const { level2Data, checkboxes, referenceMaterials } = req.body;
      if (!level2Data || !checkboxes) {
        return res
          .status(400)
          .json({ success: false, error: 'Level 2 Data dan Checkboxes wajib dikirim', requestId });
      }

      const promptResult = buildReadyToPastePrompt(
        level2Data,
        checkboxes,
        referenceMaterials || []
      );
      res.json({ success: true, promptResult, requestId });
    } catch (err: any) {
      console.error(
        `[API ERROR] requestId=${requestId} method=POST path=/api/generate/prompt stage=prompt_build`
      );
      res
        .status(400)
        .json({ success: false, error: err?.message || 'Gagal menghasilkan Prompt', requestId });
    }
  });

  // API Routing Guard: Ensure all non-matched /api/* routes always return JSON, NEVER HTML
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const requestId = res.locals.requestId || generateRequestId();
      return res.status(404).json({
        success: false,
        error: `API endpoint tidak ditemukan: ${req.method} ${req.path}`,
        requestId,
      });
    }
    next();
  });

  return app;
}
