import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  PageSiloItem,
  InternalLinkRec,
  RejectedKeywordItem,
  WebsiteType,
  PageRole,
} from '../src/types.js';
import { GEMINI_MODEL, resolveModelsForKey } from './gemini-config.js';
import { dedupeSlug, slugify } from './slug-utils.js';
import { executeWithParseRetry } from './gemini-retry-utils.js';

export interface ExistingSiloPageContext {
  pageId: string;
  title: string;
  suggestedSlug: string;
  suggestedFocusKeyword?: string;
  pageRole: string;
  cluster: string;
  scopeSummary?: string;
}

export interface ExistingClusterContext {
  name: string;
  purpose: string;
}

export interface AddPagesFromKeywordsInput {
  apiKey?: string;
  /** Sudah divalidasi di route: 1-5 item, non-empty, trimmed. */
  keywords: string[];
  topic: string;
  websiteType?: WebsiteType;
  targetAudience?: string;
  businessContext?: string;
  location?: string;
  authorExpertise?: string;
  referenceText?: string;
  websiteUrl?: string;
  existingSiloPages: ExistingSiloPageContext[];
  existingClusters: ExistingClusterContext[];
}

export interface AddPagesFromKeywordsResult {
  newPages: PageSiloItem[];
  newInternalLinks: InternalLinkRec[];
  rejectedKeywords: RejectedKeywordItem[];
  warnings?: string[];
}

const INDONESIAN_STOPWORDS = new Set([
  'yang', 'untuk', 'dari', 'dengan', 'adalah', 'dan', 'atau', 'pada', 'ini', 'itu',
  'ke', 'di', 'sebagai', 'dalam', 'bisa', 'akan', 'oleh', 'karena', 'juga', 'secara',
  'tentang', 'bagi', 'agar', 'supaya', 'saat', 'ketika', 'setelah', 'sebelum', 'antara',
  'tanpa', 'hingga', 'sampai', 'serta', 'namun', 'tetapi', 'melainkan', 'hanya', 'saja',
  'lebih', 'sangat', 'amat', 'paling', 'sudah', 'telah', 'sedang', 'masih', 'belum',
  'tidak', 'bukan', 'jangan', 'harus', 'wajib', 'boleh', 'dapat', 'bagaimana', 'apa',
  'mengapa', 'kenapa', 'kapan', 'dimana', 'mana', 'siapa', 'berapa', 'cara', 'tips'
]);

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenize(text: string): Set<string> {
  return new Set(
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !INDONESIAN_STOPWORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function generateSiloPagesFromKeywords(
  input: AddPagesFromKeywordsInput
): Promise<AddPagesFromKeywordsResult> {
  const {
    apiKey,
    keywords,
    topic,
    websiteType = 'General',
    targetAudience,
    businessContext,
    location,
    authorExpertise,
    referenceText = '',
    websiteUrl = '',
    existingSiloPages,
    existingClusters,
  } = input;

  if (!keywords || keywords.length === 0) {
    throw new Error('Minimal 1 kata kunci wajib diisi');
  }
  if (keywords.length > 5) {
    throw new Error('Maksimal 5 kata kunci dapat diproses dalam satu kali permintaan');
  }

  const keyToUse = apiKey || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    throw new Error(
      'Tidak ada API Key yang disediakan dan System API Key fallback tidak tersedia. Harap masukkan API Key di Pengaturan.'
    );
  }

  const client = new GoogleGenAI({
    apiKey: keyToUse,
  });

  const systemInstruction = `
Anda adalah **SEO Knowledge Architect** senior yang menerapkan prinsip **Google Search Central — Creating Helpful, Reliable, People-First Content**.

TUGAS UTAMA:
Mempelajari dan mengevaluasi setiap kata kunci yang diberikan pengguna untuk ditambahkan ke arsitektur topik SILO yang SUDAH ADA.

ATURAN WAJIB (RELEVANSI TOPIK — DIEVALUASI PALING AWAL):
1. Sebelum merancang halaman apapun, evaluasi dulu apakah kata kunci berada dalam payung TOPIK UTAMA / NICHE yang diberikan. Kata kunci tetap RELEVAN jika melayani pengguna yang tertarik pada topik utama -- termasuk sudut pandang perbandingan, pendukung keputusan pembelian, panduan implementasi, atau pelengkap -- bukan hanya jika menyebut topik utama secara harfiah kata per kata.
2. Kata kunci dianggap TIDAK RELEVAN (off-topic) HANYA jika secara maknawi berasal dari topik/niche yang benar-benar berbeda dan tidak melayani search intent pengguna niche ini.
3. JANGAN PERNAH memaksakan kata kunci off-topic menjadi rancangan halaman. Kata kunci semacam ini WAJIB masuk ke "rejectedKeywords" dengan reasonCode "OFF_TOPIC" dan penjelasan spesifik mengapa dianggap di luar topik.

ATURAN WAJIB (ANTI-KANIBALISASI):
4. WAJIB membaca daftar halaman yang sudah ada (existingSiloPages) sebelum merancang halaman baru.
5. Jika kata kunci relevan tapi scope-nya tumpang tindih dengan scopeSummary halaman existing manapun (atau rancangan baru lain dalam batch ini), UPAYAKAN LEBIH DULU mempersempit sudut pandangnya (sub-aspek lebih spesifik) agar tetap unik. HANYA jika tetap tidak bisa dibedakan secara berarti setelah diupayakan, kata kunci WAJIB masuk ke "rejectedKeywords" dengan reasonCode "CANNIBALIZATION", reason yang MENYEBUT NAMA halaman/kata kunci sumber tumpang tindih, dan conflictingPageId bila relevan.
6. Kata kunci yang terlalu umum/ambigu untuk dijadikan dasar SATU halaman terfokus WAJIB masuk ke "rejectedKeywords" dengan reasonCode "TOO_VAGUE" dan reason yang menjelaskan alasannya secara konkret.
7. Aturan anti-kanibalisasi di atas JUGA berlaku ANTAR halaman baru dalam batch ini sendiri, bukan cuma terhadap existingSiloPages.

ATURAN WAJIB (KEWAJIBAN HASIL PER KATA KUNCI):
8. Untuk SETIAP kata kunci yang diberikan, WAJIB hasilkan TEPAT SATU dari dua hal berikut -- tidak boleh dua-duanya, tidak boleh tidak sama sekali:
   (a) SATU objek pada "newPages", dengan field "sourceKeyword" diisi PERSIS sama dengan kata kunci input aslinya; ATAU
   (b) SATU objek pada "rejectedKeywords", dengan field "keyword" diisi PERSIS sama dengan kata kunci input aslinya, disertai "reasonCode" ("OFF_TOPIC" | "CANNIBALIZATION" | "TOO_VAGUE") dan "reason" yang SPESIFIK dan actionable. Dilarang keras memberi alasan generik tanpa detail (mis. "tidak relevan", "terlalu mirip") -- reason harus menyebut hal konkret yang membuatnya ditolak.
9. Prioritaskan menempatkan halaman baru yang diterima ke salah satu cluster yang SUDAH ADA (existingClusters) bila relevan, daripada membuat cluster baru. Jika mengusulkan cluster BARU ("isNewCluster": true), cluster tsb WAJIB tetap berada dalam payung TOPIK UTAMA yang sama, dan WAJIB benar-benar berbeda secara makna dari seluruh existingClusters (bukan sekadar penamaan ulang/sinonim) -- jelaskan alasannya di "clusterFitReason".
10. "suggestedFocusKeyword" WAJIB diturunkan langsung dari kata kunci yang diberikan pengguna (boleh dirapikan tata bahasanya, tapi maknanya tidak boleh berubah).
11. Setiap "pageId" pada halaman-halaman baru WAJIB unik satu sama lain di dalam batch ini (mis. pola "page_new_1", "page_new_2", dst.).
12. "pageRole" halaman baru DILARANG bernilai "Pillar" -- setiap SILO hanya boleh memiliki SATU Pillar Page, yang sudah dibuat sebelumnya di Level 1.
`.trim();

  const existingPagesBlock = existingSiloPages
    .map(
      (p) =>
        `- [${p.pageId}] "${p.title}" (slug: /${p.suggestedSlug}, role: ${p.pageRole}, cluster: ${p.cluster})${
          p.suggestedFocusKeyword ? ` — Focus Keyword: "${p.suggestedFocusKeyword}"` : ''
        }${p.scopeSummary ? ` — Cakupan: ${p.scopeSummary}` : ''}`
    )
    .join('\n');

  const existingClustersBlock = existingClusters
    .map((c) => `- ${c.name}: ${c.purpose}`)
    .join('\n');

  const keywordsBlock = keywords.map((k, i) => `${i + 1}. "${k}"`).join('\n');

  const prompt = `
KONTEKS ARSITEKTUR TOPIK YANG SUDAH ADA:
- TOPIK UTAMA: "${topic.trim()}"
- TARGET AUDIENS: "${targetAudience || 'Pengguna umum / calon pelanggan'}"
- TIPE WEBSITE: "${websiteType}"
- KONTEKS BISNIS: "${businessContext || 'Umum / Referensi Produk / Layanan'}"
- LOKASI: "${location || 'Indonesia'}"
- LATAR BELAKANG KEAHLIAN (E-E-A-T): "${authorExpertise || 'Tidak ada catatan tambahan'}"
${referenceText.trim() ? `- REFERENSI TAMBAHAN:\n"""\n${referenceText.trim()}\n"""\n` : ''}

DAFTAR HALAMAN YANG SUDAH ADA (WAJIB DIBACA, JANGAN DIDUPLIKASI):
${existingPagesBlock || '(belum ada halaman)'}

DAFTAR CLUSTER YANG SUDAH ADA:
${existingClustersBlock || '(belum ada cluster)'}

KATA KUNCI YANG PERLU DITELITI & DIEVALUASI (${keywords.length} kata kunci):
${keywordsBlock}

TUGAS:
Evaluasi setiap kata kunci di atas secara cermat.
- Jika lolos seleksi relevansi & anti-kanibalisasi: buatkan rancangan halaman baru di "newPages" dengan field "sourceKeyword" diisi teks kata kunci aslinya, serta tentukan "isNewCluster" dan "clusterFitReason".
- Jika tidak lolos: masukkan ke "rejectedKeywords" dengan "keyword" asli, "reasonCode" (OFF_TOPIC / CANNIBALIZATION / TOO_VAGUE), dan "reason" yang spesifik menyebut alasan atau halaman yang berbenturan.
- Untuk halaman baru yang diterima di "newPages", buatkan rekomendasi "newInternalLinks" yang menghubungkannya secara dua arah ke halaman existing yang paling relevan.
`.trim();

  const PAGE_ROLES_NO_PILLAR = [
    'Definition',
    'Guide',
    'Process',
    'Comparison',
    'Application',
    'Evaluation',
    'Commercial Investigation',
    'Buying Guide',
    'Problem/Solution',
    'Maintenance',
    'Reference',
    'FAQ',
  ];

  const SEARCH_INTENTS = [
    'informational',
    'navigational',
    'transactional',
    'commercial investigation',
    'problem-solving',
    'comparison',
    'reference',
    'application',
  ];

  const PRIORITY_LEVELS = ['HIGH', 'MEDIUM', 'LOW'];

  const resolvedModels = await resolveModelsForKey(client, keyToUse);

  const parsed = await executeWithParseRetry<any>(
    (activeModel = GEMINI_MODEL) => {
      const isGemini3 = activeModel.startsWith('gemini-3') && !activeModel.includes('flash-lite');
      return client.models.generateContent({
        model: activeModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          ...(isGemini3 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } } : {}),
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              newPages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageId: { type: Type.STRING },
                    sourceKeyword: { type: Type.STRING },
                    title: { type: Type.STRING },
                    suggestedSlug: { type: Type.STRING },
                    suggestedFocusKeyword: { type: Type.STRING },
                    pageRole: { type: Type.STRING, enum: PAGE_ROLES_NO_PILLAR },
                    cluster: { type: Type.STRING },
                    isNewCluster: { type: Type.BOOLEAN },
                    clusterFitReason: { type: Type.STRING },
                    intent: { type: Type.STRING, enum: SEARCH_INTENTS },
                    primaryEntity: { type: Type.STRING },
                    supportingEntities: { type: Type.ARRAY, items: { type: Type.STRING } },
                    parentPage: { type: Type.STRING },
                    childPages: { type: Type.ARRAY, items: { type: Type.STRING } },
                    relatedPages: { type: Type.ARRAY, items: { type: Type.STRING } },
                    priority: { type: Type.STRING, enum: PRIORITY_LEVELS },
                    rationale: { type: Type.STRING },
                    scopeSummary: { type: Type.STRING },
                  },
                  required: [
                    'pageId',
                    'sourceKeyword',
                    'title',
                    'suggestedSlug',
                    'suggestedFocusKeyword',
                    'pageRole',
                    'cluster',
                    'isNewCluster',
                    'clusterFitReason',
                    'intent',
                    'primaryEntity',
                    'supportingEntities',
                    'priority',
                    'rationale',
                    'scopeSummary',
                  ],
                },
              },
              rejectedKeywords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    keyword: { type: Type.STRING },
                    reasonCode: {
                      type: Type.STRING,
                      enum: ['OFF_TOPIC', 'CANNIBALIZATION', 'TOO_VAGUE'],
                    },
                    reason: { type: Type.STRING },
                    conflictingPageId: { type: Type.STRING },
                  },
                  required: ['keyword', 'reasonCode', 'reason'],
                },
              },
              newInternalLinks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourcePageId: { type: Type.STRING },
                    targetPageId: { type: Type.STRING },
                    suggestedAnchor: { type: Type.STRING },
                    linkPurpose: { type: Type.STRING },
                    relationship: {
                      type: Type.STRING,
                      enum: ['parent', 'child', 'sibling', 'cross-cluster'],
                    },
                  },
                  required: ['sourcePageId', 'targetPageId', 'suggestedAnchor', 'linkPurpose', 'relationship'],
                },
              },
            },
            required: ['newPages', 'rejectedKeywords', 'newInternalLinks'],
          },
        },
      });
    },
    resolvedModels,
    2
  );

  const rawNewPages = Array.isArray(parsed.newPages) ? parsed.newPages : [];
  const rawRejected = Array.isArray(parsed.rejectedKeywords) ? parsed.rejectedKeywords : [];
  const rawNewLinks = Array.isArray(parsed.newInternalLinks) ? parsed.newInternalLinks : [];

  const warnings: string[] = [];
  const finalRejectedKeywords: RejectedKeywordItem[] = [];

  // 1. Koleksi penolakan awal dari AI
  const rejectedKeywordMap = new Map<string, RejectedKeywordItem>();
  for (const r of rawRejected) {
    if (!r || typeof r.keyword !== 'string') continue;
    const normKey = normalizeText(r.keyword);
    const validCode =
      r.reasonCode === 'OFF_TOPIC' || r.reasonCode === 'CANNIBALIZATION' || r.reasonCode === 'TOO_VAGUE'
        ? r.reasonCode
        : 'CANNIBALIZATION';
    const item: RejectedKeywordItem = {
      keyword: r.keyword.trim(),
      reasonCode: validCode,
      reason: (r.reason || 'Ditolak berdasarkan evaluasi arsitektur').toString().trim(),
      conflictingPageId: typeof r.conflictingPageId === 'string' ? r.conflictingPageId.trim() : undefined,
    };
    rejectedKeywordMap.set(normKey, item);
  }

  // 2. Sanitasi slug, pageId, dan field role Pillar
  const usedSlugs = new Set<string>(existingSiloPages.map((p) => p.suggestedSlug));
  const usedPageIds = new Set<string>(existingSiloPages.map((p) => p.pageId));
  const idRemap = new Map<string, string>(); // pageId lama -> pageId final

  const sanitizedNewPages: PageSiloItem[] = [];

  for (let idx = 0; idx < rawNewPages.length; idx++) {
    const p = rawNewPages[idx];
    if (!p) continue;

    const sourceKeyword = typeof p.sourceKeyword === 'string' ? p.sourceKeyword.trim() : '';
    const normSourceKey = normalizeText(sourceKeyword);

    // Jika AI kontradiktif (memasukkan ke newPages DAN rejectedKeywords), menangkan penolakan
    if (normSourceKey && rejectedKeywordMap.has(normSourceKey)) {
      continue;
    }

    const baseSlug = typeof p.suggestedSlug === 'string' ? slugify(p.suggestedSlug) : `halaman-baru-${idx}`;
    const finalSlug = dedupeSlug(baseSlug, usedSlugs);
    usedSlugs.add(finalSlug);

    const rawId = typeof p.pageId === 'string' && p.pageId.trim() ? p.pageId.trim() : `page_kw_${idx}`;
    let finalId = rawId;
    if (usedPageIds.has(finalId)) {
      finalId = `page_kw_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
    }
    usedPageIds.add(finalId);
    if (rawId !== finalId) idRemap.set(rawId, finalId);

    const suggestedFocusKeyword =
      typeof p.suggestedFocusKeyword === 'string' && p.suggestedFocusKeyword.trim()
        ? p.suggestedFocusKeyword.trim()
        : (p.primaryEntity || p.title || sourceKeyword || '').toString().trim();

    // Guard Role Pillar (jaring pengaman kedua)
    let pageRole: PageRole = p.pageRole as PageRole;
    if (pageRole === 'Pillar') {
      pageRole = 'Guide';
      warnings.push(
        `Role halaman "${p.title}" otomatis diubah dari Pillar ke Guide karena arsitektur SILO sudah memiliki Pillar Page utama.`
      );
    }

    // Tata Kelola Cluster Baru: cek fuzzy match terhadap existingClusters
    let clusterName = (p.cluster || 'General').toString().trim();
    const isNewCluster = Boolean(p.isNewCluster);
    if (isNewCluster && existingClusters.length > 0) {
      const clusterTokens = tokenize(clusterName);
      let bestClusterMatch: { name: string; score: number } | null = null;
      for (const exCl of existingClusters) {
        const exTokens = tokenize(exCl.name);
        const score = jaccardSimilarity(clusterTokens, exTokens);
        if (!bestClusterMatch || score > bestClusterMatch.score) {
          bestClusterMatch = { name: exCl.name, score };
        }
      }
      // Jika kemiripan nama cluster >= 0.6, remap ke cluster lama
      if (bestClusterMatch && bestClusterMatch.score >= 0.6) {
        warnings.push(
          `Usulan cluster baru "${clusterName}" otomatis diremap ke cluster eksisting "${bestClusterMatch.name}" untuk menjaga kerapian struktur.`
        );
        clusterName = bestClusterMatch.name;
      }
    }

    sanitizedNewPages.push({
      ...p,
      pageId: finalId,
      sourceKeyword: sourceKeyword || keywords[idx] || p.title,
      suggestedSlug: finalSlug,
      suggestedFocusKeyword,
      pageRole,
      cluster: clusterName,
      isNewCluster: isNewCluster,
      clusterFitReason: p.clusterFitReason || '',
    } as PageSiloItem);
  }

  // 3. VALIDASI KEMIRIPAN & ANTI-KANIBALISASI TERPROGRAM
  const SIMILARITY_THRESHOLD = 0.6; // Jaccard threshold

  // Guard Focus Keyword Exact Match
  const existingNormalizedFocusKeywords = new Map<string, { pageId: string; title: string }>();
  for (const ep of existingSiloPages) {
    const norm = normalizeText(ep.suggestedFocusKeyword || ep.title);
    if (norm) {
      existingNormalizedFocusKeywords.set(norm, { pageId: ep.pageId, title: ep.title });
    }
  }

  const existingTokenSets = existingSiloPages.map((p) => ({
    pageId: p.pageId,
    label: p.title,
    tokens: tokenize(`${p.title} ${p.suggestedFocusKeyword || ''} ${p.scopeSummary || ''}`),
  }));

  const acceptedTokenSets: { pageId: string; label: string; tokens: Set<string> }[] = [];
  const acceptedFocusKeywords = new Map<string, { pageId: string; title: string }>();
  const acceptedNewPages: PageSiloItem[] = [];

  for (const page of sanitizedNewPages) {
    const pageFocusNorm = normalizeText(page.suggestedFocusKeyword);
    const sourceKw = page.sourceKeyword || page.title;

    // A. Cek Exact Match Focus Keyword
    if (existingNormalizedFocusKeywords.has(pageFocusNorm)) {
      const match = existingNormalizedFocusKeywords.get(pageFocusNorm)!;
      finalRejectedKeywords.push({
        keyword: sourceKw,
        reasonCode: 'CANNIBALIZATION',
        reason: `Focus Keyword "${page.suggestedFocusKeyword}" identik dengan halaman eksisting "${match.title}".`,
        conflictingPageId: match.pageId,
      });
      continue;
    }

    if (acceptedFocusKeywords.has(pageFocusNorm)) {
      const match = acceptedFocusKeywords.get(pageFocusNorm)!;
      finalRejectedKeywords.push({
        keyword: sourceKw,
        reasonCode: 'CANNIBALIZATION',
        reason: `Focus Keyword "${page.suggestedFocusKeyword}" duplikat dengan rancangan halaman baru lain "${match.title}" dalam batch ini.`,
        conflictingPageId: match.pageId,
      });
      continue;
    }

    // B. Cek Jaccard Overlap
    const pageTokens = tokenize(`${page.title} ${page.suggestedFocusKeyword} ${page.scopeSummary || ''}`);

    let bestMatch: { pageId: string; label: string; score: number } | null = null;
    for (const candidate of [...existingTokenSets, ...acceptedTokenSets]) {
      const score = jaccardSimilarity(pageTokens, candidate.tokens);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { pageId: candidate.pageId, label: candidate.label, score };
      }
    }

    if (bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD) {
      finalRejectedKeywords.push({
        keyword: sourceKw,
        reasonCode: 'CANNIBALIZATION',
        reason: `Scope konten rancangan "${page.title}" tumpang tindih tinggi (kemiripan ${(bestMatch.score * 100).toFixed(0)}%) dengan halaman "${bestMatch.label}".`,
        conflictingPageId: bestMatch.pageId,
      });
      continue;
    }

    // Lolos semua validasi
    acceptedTokenSets.push({ pageId: page.pageId, label: page.title, tokens: pageTokens });
    acceptedFocusKeywords.set(pageFocusNorm, { pageId: page.pageId, title: page.title });
    acceptedNewPages.push(page);
  }

  // 4. Masukkan penolakan AI ke list final
  for (const item of rejectedKeywordMap.values()) {
    // Pastikan tidak duplikat dengan yang ditolak programatik
    if (!finalRejectedKeywords.some((r) => normalizeText(r.keyword) === normalizeText(item.keyword))) {
      finalRejectedKeywords.push(item);
    }
  }

  // 5. Rekonsiliasi Wajib Kata Kunci (Anti-Silent-Drop)
  const coveredKeywords = new Set<string>();
  for (const p of acceptedNewPages) {
    if (p.sourceKeyword) coveredKeywords.add(normalizeText(p.sourceKeyword));
  }
  for (const r of finalRejectedKeywords) {
    if (r.keyword) coveredKeywords.add(normalizeText(r.keyword));
  }

  for (const originalKw of keywords) {
    const norm = normalizeText(originalKw);
    if (!coveredKeywords.has(norm)) {
      finalRejectedKeywords.push({
        keyword: originalKw,
        reasonCode: 'TOO_VAGUE',
        reason: 'Model AI tidak mengembalikan evaluasi atau rancangan untuk kata kunci ini. Silakan coba proses ulang.',
      });
    }
  }

  // 6. Sanitasi Graph References pada PageSiloItem (parentPage, childPages, relatedPages)
  const knownPageIds = new Set<string>([
    ...existingSiloPages.map((p) => p.pageId),
    ...acceptedNewPages.map((p) => p.pageId),
  ]);

  const sanitizedGraphNewPages: PageSiloItem[] = acceptedNewPages.map((p) => {
    const parentPage = p.parentPage && knownPageIds.has(p.parentPage) ? p.parentPage : undefined;
    const childPages = p.childPages ? p.childPages.filter((id) => knownPageIds.has(id)) : undefined;
    const relatedPages = p.relatedPages ? p.relatedPages.filter((id) => knownPageIds.has(id)) : undefined;

    return {
      ...p,
      parentPage,
      childPages: childPages && childPages.length > 0 ? childPages : undefined,
      relatedPages: relatedPages && relatedPages.length > 0 ? relatedPages : undefined,
    };
  });

  // 7. Sanitasi dan Remap Internal Links
  const sanitizedNewLinks: InternalLinkRec[] = rawNewLinks
    .map((l: any) => ({
      ...l,
      sourcePageId: idRemap.get(l.sourcePageId) || l.sourcePageId,
      targetPageId: idRemap.get(l.targetPageId) || l.targetPageId,
    }))
    .filter((l: any) => knownPageIds.has(l.sourcePageId) && knownPageIds.has(l.targetPageId));

  return {
    newPages: sanitizedGraphNewPages,
    newInternalLinks: sanitizedNewLinks,
    rejectedKeywords: finalRejectedKeywords,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
