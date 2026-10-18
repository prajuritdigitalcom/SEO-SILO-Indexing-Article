import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  KnownSiloPage,
  Level2Result,
  PageLinkPlan,
  PageRole,
  RecommendedReferenceUsage,
  ReferenceSnippet,
  SearchIntentType,
  SeoMetadata,
  SeoTitleOption,
} from '../src/types.js';
import { GEMINI_MODEL, resolveModelsForKey } from './gemini-config.js';
import { slugify } from './slug-utils.js';
import { executeWithParseRetry } from './gemini-retry-utils.js';

export interface Level2Input {
  apiKey?: string;
  topic: string;
  selectedPageTitle: string;
  selectedPageRole?: PageRole;
  pageSlug?: string;
  lockedFocusKeyword?: string;
  cluster?: string;
  parentPage?: string;
  childPages?: string[];
  relatedPages?: string[];
  sourceLevel1Id?: string;
  referenceMaterials?: ReferenceSnippet[];
  /** Rencana penautan deterministik (pilar <-> pendukung & outbound link). */
  linkPlan?: PageLinkPlan;
  /** URL website utama (root domain), diteruskan dari Level 1. */
  websiteUrl?: string;
  /** Daftar seluruh halaman SILO (judul + slug asli) agar AI mencocokkan target internal link ke slug yang benar-benar ada, bukan menebak/menulis ulang. */
  knownPages?: KnownSiloPage[];
  // Konteks bisnis dari Level 1
  targetAudience?: string;
  websiteType?: string;
  businessContext?: string;
  location?: string;
  authorExpertise?: string;
  // Keputusan strategis Level 1
  lockedIntent?: string;
  lockedPrimaryEntity?: string;
  lockedSupportingEntities?: string[];
  pageRationale?: string;
}

export async function generateLevel2Architecture(input: Level2Input): Promise<Level2Result> {
  const {
    apiKey,
    topic,
    selectedPageTitle,
    selectedPageRole = 'Guide',
    pageSlug,
    lockedFocusKeyword,
    cluster = 'Umum',
    parentPage,
    childPages = [],
    relatedPages = [],
    sourceLevel1Id,
    referenceMaterials = [],
    linkPlan,
    websiteUrl,
    knownPages = [],
    targetAudience,
    websiteType,
    businessContext,
    location,
    authorExpertise,
    lockedIntent,
    lockedPrimaryEntity,
    lockedSupportingEntities,
    pageRationale,
  } = input;

  const normalizedWebsiteUrl = websiteUrl?.trim().replace(/\/+$/, '') || undefined;

  if (!selectedPageTitle || selectedPageTitle.trim().length === 0) {
    throw new Error('Judul halaman yang dipilih tidak boleh kosong.');
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
Anda adalah **SEO Page Architect** & **Content Blueprint Specialist** senior yang mematuhi **Google Search Central — Creating Helpful, Reliable, People-First Content**.

TUGAS UTAMA:
Mengubah halaman tunggal dari SILO Architecture menjadi **Cepat & Mendalam: Page Architecture & Article Blueprint (Level 2)**.

PRINSIP MENCEGAH CANNIBALIZATION & THIN CONTENT:
1. Tetapkan BATASAN HALAMAN (Page Boundaries) yang tegas: sebutkan secara eksplisit apa yang WAJIB DIBAHAS (Included Scope) dan apa yang HARUS DIHINDARI/DIALIHKAN ke halaman tetangga (Excluded Scope).
2. Dekomposisi struktur artikel (H1, H2, H3) secara mendalam, lengkap dengan tujuan setiap seksi (Purpose), poin penjelas (mustExplain), pertanyaan pembaca, entitas pendukung, dan bukti empiris (Evidence Requirements) bila relevan.
3. Berikan saran "Evidence Recommended" (misal: foto proses asli, tabel pengujian, spesifikasi teknis, dokumen pendukung) tanpa menyuruh mengarang fakta (NO fake experience/data).

PETUNJUK OUTPUT JSON:
Kembalikan JSON terstruktur sesuai schema tanpa teks tambahan.
`.trim();

  const focusKeywordInstruction = lockedFocusKeyword
    ? `WAJIB SAMA PERSIS dengan yang sudah ditetapkan pengguna di Level 1: "${lockedFocusKeyword}". JANGAN membuat focus keyword baru atau mengubahnya.`
    : `buat SATU frasa kata kunci utama yang merepresentasikan query pencarian nyata untuk halaman ini, konsisten dengan search intent dan primary entity.`;

  const prompt = `
Susun Level 2 Page Architecture untuk:
- TOPIK MACRO: "${topic.trim()}"
- HALAMAN YANG DIPILIH: "${selectedPageTitle.trim()}"
- PAGE ROLE: "${selectedPageRole}"
- TOPIC CLUSTER: "${cluster}"
${pageSlug ? `- SLUG RESMI LEVEL 1: "${pageSlug}"` : ''}
${lockedFocusKeyword ? `- FOCUS KEYWORD RESMI LEVEL 1: "${lockedFocusKeyword}"` : ''}
- PARENT PAGE DILAINNYA: "${parentPage || 'Pillar Page'}"
- CHILD PAGES NEIGHBOR: "${childPages.join(', ') || 'Tidak ada'}"
- RELATED PAGES NEIGHBOR: "${relatedPages.join(', ') || 'Tidak ada'}"
- KONTEKS BISNIS/WEBSITE: "${businessContext || 'Umum / Referensi Produk / Layanan'}"
- TIPE WEBSITE: "${websiteType || 'General'}"
- TARGET AUDIENS: "${targetAudience || 'Pengguna umum / calon pelanggan'}"
- LOKASI/AREA LAYANAN: "${location || 'Indonesia'}"
- LATAR BELAKANG KEAHLIAN PENULIS/BISNIS (E-E-A-T): "${authorExpertise || 'Tidak ada catatan tambahan'}"
- SEARCH INTENT YANG SUDAH DITETAPKAN DI LEVEL 1: "${lockedIntent || 'Belum ditetapkan — tentukan sendiri berdasarkan analisis'}"
- ENTITAS UTAMA YANG SUDAH DITETAPKAN DI LEVEL 1: "${lockedPrimaryEntity || 'Belum ditetapkan'}"
- ENTITAS PENDUKUNG AWAL DARI LEVEL 1: "${(lockedSupportingEntities || []).join(', ') || 'Tidak ada'}"
- ALASAN STRATEGIS HALAMAN INI (RATIONALE DARI LEVEL 1): "${pageRationale || 'Tidak ada catatan tambahan'}"

PETUNJUK PEMAKAIAN KONTEKS BISNIS (WAJIB): Gunakan konteks bisnis, tipe website, target audiens, dan lokasi di atas untuk:
(a) Menentukan search intent yang realistis untuk audiens spesifik ini, bukan audiens generik industri.
(b) Memilih entitas pendukung yang benar-benar relevan dengan bisnis dan lokasi ini.
(c) Menyesuaikan evidenceRequirements dengan jenis bukti yang secara realistis bisa disediakan oleh bisnis jenis ini (jangan menyarankan bukti yang mustahil untuk tipe website/bisnis ini).
(d) Memastikan userGoal selaras dengan apa yang benar-benar dicari audiens tersebut, bukan tujuan generik.

PETUNJUK KONSISTENSI (WAJIB): searchIntent dan primaryEntity yang Anda hasilkan HARUS selaras dengan yang sudah ditetapkan Level 1 di atas (jangan mengganti maknanya). Entitas pendukung dari Level 1 boleh diperkaya/ditambah, tapi jangan dihapus tanpa alasan kuat. Gunakan "Alasan Strategis" di atas sebagai acuan agar struktur artikel benar-benar menjawab tujuan halaman ini dibuat.
${
  knownPages.length > 0
    ? `\n- DAFTAR SELURUH HALAMAN SILO YANG SUDAH ADA (title -> slug asli, WAJIB dipakai sebagai acuan target internal link, JANGAN mengarang slug baru):\n` +
      knownPages
        .map(
          (p) =>
            `  * "${p.title}" -> slug: "${p.slug}"${p.scopeSummary ? ` | Cakupan halaman ini: ${p.scopeSummary}` : ''}`
        )
        .join('\n') +
      `\n\nPETUNJUK INTERNAL LINK (WAJIB): Untuk setiap item pada "internalLinkOpportunities", pilih "targetPage" HANYA dari daftar judul halaman di atas (gunakan judul persis seperti tertulis), lalu isi "targetSlug" dengan slug yang sesuai dari daftar tersebut. Jika tidak ada halaman yang cocok secara relevan, jangan sertakan item tersebut. Catatan: tautan wajib pilar<->pendukung dan outbound link ditangani sistem secara terpisah. Pada internalLinkOpportunities, hanya berikan peluang tautan KONTEKSTUAL tambahan ke halaman SILO lain yang relevan, dan JANGAN sertakan halaman pilar maupun URL eksternal.\n\nPETUNJUK ANTI-KANIBALISASI (WAJIB): Gunakan kolom "Cakupan halaman ini" di atas sebagai SUMBER KEBENARAN saat menentukan excludedScope — jangan menebak hanya dari judul. Jika sebuah topik yang berpotensi tumpang tindih TIDAK disebutkan secara eksplisit dalam cakupan halaman tetangga manapun, JANGAN asumsikan sudah ditangani halaman lain — sertakan dalam includedScope halaman ini, atau laporkan sebagai potensi celah.`
    : ''
}
${
  referenceMaterials.length > 0
    ? `\n- BANK REFERENSI TERSEDIA (${referenceMaterials.length} item data/fakta):\n` +
      referenceMaterials
        .map(
          (r) =>
            `  * [ID: "${r.id}"] [${r.title}]${r.category ? ` (${r.category})` : ''}: ${r.content}`
        )
        .join('\n') +
      `\n\nPETUNJUK RELEVANSI BANK REFERENSI: Evaluasi setiap snippet di atas. Pilih HANYA snippet yang benar-benar relevan dan mendukung halaman "${selectedPageTitle}" (${selectedPageRole}). Sertakan id dan alasan relevansinya pada field "recommendedReferenceUsage". Jika tidak ada yang relevan, kosongkan list tersebut.`
    : ''
}

Sediakan:
1. Search Intent & User Goal yang tepat.
2. Entitas Utama & Entitas Pendukung (LSI / semantic entities).
3. Pertanyaan Kunci yang wajib dijawab agar pembaca puas (Satisfying Information Experience).
4. Scope Boundaries (Included Scope vs Excluded Scope yang ditangani halaman tetangga).
5. Struktur Artikel Hirarkis (1x H1, 6-9x H2, dan H3 bila relevan (target total artikel 3.000 kata atau lebih, sehingga cakupan topik harus luas dan mendalam)). Setiap seksi wajib memiliki sectionId unik, heading, level, purpose, mustExplain[], questions[], entities[], evidenceRequirements[], dan internalLinks[]. Rancang outline agar memuat sudut pembahasan yang beragam dan tidak saling mengulang, misalnya: definisi dan konteks, cara kerja atau alasan di baliknya, kriteria memilih, langkah praktis berurutan, kesalahan umum dan cara menghindarinya, perbandingan opsi, batasan atau kapan opsi tidak cocok, dan satu seksi pertanyaan yang sering diajukan (FAQ) yang menjawab pertanyaan pembaca. Gunakan hanya sudut yang relevan dengan peran halaman (page role) ini dan tidak melanggar excludedScope. Jangan menambah seksi hanya untuk memperpanjang.
6. Rekomendasi Bukti Lapangan / Evidence Requirements (misal: foto asli, lembar uji, kriteria penilaian).
7. Peluang Tautan Internal (Target page, Anchor text alami, Konteks penempatan).
8. Rekomendasi Penggunaan Snippet Referensi (recommendedReferenceUsage: list of { snippetId, relevanceReason } yang relevan dengan topik halaman ini).
9. People-First Quality Guidance & Search-Engine-First Warnings (mencegah keyword stuffing, kata berbelit-belit, atau manipulasi).
10. SEO Publishing Metadata (WAJIB, dibutuhkan untuk publikasi langsung ke WordPress/Blogger):

    ATURAN SINKRONISASI (WAJIB DIPATUHI — INI MENENTUKAN SKOR SEO DI PLUGIN SEPERTI YOAST/RANKMATH):
    "focusKeyword" adalah SUMBER KEBENARAN TUNGGAL untuk seluruh metadata di bawah. Tentukan/pakai focusKeyword LEBIH DULU, baru turunkan elemen lainnya supaya SEMUANYA memuat frasa focusKeyword yang SAMA PERSIS (boleh berbeda kapitalisasi).
    URUTAN PRIORITAS untuk metaTitle & metaDescription (ikuti persis urutan ini): (1) WAJIB sinkron dengan focusKeyword, (2) WAJIB nyaman dibaca manusia (natural, tidak terpotong, tidak dipaksakan pendek), (3) BOLEH melebihi batas karakter SERP standar jika diperlukan untuk memenuhi poin (1) dan (2) — batas karakter bukan aturan keras.
    a. "focusKeyword": ${focusKeywordInstruction}
    b. "titleOptions": 3-5 variasi judul H1. SETIAP opsi WAJIB memuat frasa focusKeyword secara utuh (boleh di awal/tengah/akhir kalimat). Jangan mengubah scope, primary entity, atau search intent yang sudah ditetapkan — variasikan hanya sudut pandang/urutan kata/daya tarik di SEKITAR focusKeyword. Sertakan "rationale" singkat per opsi, tandai opsi terbaik di "recommendedTitleIndex".
    c. "metaTitle": WAJIB memuat focusKeyword SEDEKAT MUNGKIN ke awal kalimat, unik, menggugah klik tanpa clickbait palsu. PRIORITASKAN kalimat yang utuh dan nyaman dibaca manusia — JANGAN memotong atau memaksakan kalimat menjadi pendek hanya demi memenuhi batas karakter. Acuan referensi SERP adalah ~60 karakter, tapi BOLEH melebihi batas ini apabila diperlukan agar kalimat tetap natural, jelas, dan bermakna utuh.
    d. "metaDescription": WAJIB memuat focusKeyword secara alami (jangan dipaksakan/keyword stuffing), merangkum value proposition halaman dalam kalimat yang utuh dan mengalir enak dibaca. Acuan referensi SERP adalah ~120-158 karakter, tapi BOLEH melebihi batas ini apabila diperlukan agar kalimat tetap natural dan tidak terpotong di tengah maksud — keterbacaan dan makna yang utuh lebih penting daripada jumlah karakter.
    e. "secondaryKeywords": 3-6 frasa semantik pendukung (LSI) yang MELENGKAPI focusKeyword, bukan duplikat maknanya.
    f. "category": SATU label kategori CMS ringkas (1-3 kata, Title Case), diturunkan dari Topic Cluster "${cluster}".
    g. "tags": 5-8 tag relevan, gaya alami seperti yang benar-benar dicari pengguna.
${
  pageSlug
    ? `    h. "slug": WAJIB SAMA PERSIS dengan slug yang sudah ditetapkan di Level 1: "${pageSlug}". JANGAN mengubah, menerjemahkan ulang, atau membuat slug baru.`
    : `    h. "slug": buat slug URL singkat, huruf kecil, kata dipisah tanda hubung "-", HARUS mencerminkan/mengandung focusKeyword.`
}
`.trim();

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
              searchIntent: { type: Type.STRING, enum: SEARCH_INTENTS },
              userGoal: { type: Type.STRING },
              primaryEntity: { type: Type.STRING },
              supportingEntities: { type: Type.ARRAY, items: { type: Type.STRING } },
              questions: { type: Type.ARRAY, items: { type: Type.STRING } },
              conceptsToUnderstand: { type: Type.ARRAY, items: { type: Type.STRING } },
              includedScope: { type: Type.ARRAY, items: { type: Type.STRING } },
              excludedScope: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    handledByPage: { type: Type.STRING },
                  },
                  required: ['topic', 'handledByPage'],
                },
              },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sectionId: { type: Type.STRING },
                    heading: { type: Type.STRING },
                    level: { type: Type.STRING, enum: ['H1', 'H2', 'H3'] },
                    purpose: { type: Type.STRING },
                    mustExplain: { type: Type.ARRAY, items: { type: Type.STRING } },
                    questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    entities: { type: Type.ARRAY, items: { type: Type.STRING } },
                    evidenceRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    internalLinks: { type: Type.ARRAY, items: { type: Type.STRING } },
                    notes: { type: Type.STRING },
                  },
                  required: [
                    'sectionId',
                    'heading',
                    'level',
                    'purpose',
                    'mustExplain',
                    'questions',
                    'entities',
                    'evidenceRequirements',
                    'internalLinks',
                  ],
                },
              },
              evidenceRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
              internalLinkOpportunities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    targetPage: { type: Type.STRING },
                    targetSlug: { type: Type.STRING },
                    suggestedAnchor: { type: Type.STRING },
                    context: { type: Type.STRING },
                  },
                  required: ['targetPage', 'suggestedAnchor', 'context'],
                },
              },
              recommendedReferenceUsage: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    snippetId: { type: Type.STRING },
                    relevanceReason: { type: Type.STRING },
                  },
                  required: ['snippetId', 'relevanceReason'],
                },
              },
              peopleFirstQualityGuidance: { type: Type.ARRAY, items: { type: Type.STRING } },
              searchEngineFirstWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
              seoMetadata: {
                type: Type.OBJECT,
                properties: {
                  titleOptions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        rationale: { type: Type.STRING },
                      },
                      required: ['title', 'rationale'],
                    },
                  },
                  recommendedTitleIndex: { type: Type.NUMBER },
                  slug: { type: Type.STRING },
                  category: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  metaTitle: { type: Type.STRING },
                  metaDescription: { type: Type.STRING },
                  focusKeyword: { type: Type.STRING },
                  secondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'titleOptions',
                  'recommendedTitleIndex',
                  'slug',
                  'category',
                  'tags',
                  'metaTitle',
                  'metaDescription',
                  'focusKeyword',
                  'secondaryKeywords',
                ],
              },
            },
            required: [
              'searchIntent',
              'userGoal',
              'primaryEntity',
              'supportingEntities',
              'questions',
              'conceptsToUnderstand',
              'includedScope',
              'excludedScope',
              'sections',
              'evidenceRequirements',
              'internalLinkOpportunities',
              'peopleFirstQualityGuidance',
              'searchEngineFirstWarnings',
              'seoMetadata',
            ],
          },
        },
      });
    },
    resolvedModels,
    2
  );

  // Validate recommended reference usage against available snippet IDs
  const validSnippetIds = new Set(referenceMaterials.map((r) => r.id));
  const rawRecommended = parsed.recommendedReferenceUsage || [];
  const validatedRecommendedUsage: RecommendedReferenceUsage[] = Array.isArray(rawRecommended)
    ? rawRecommended.filter(
        (u: any) => u && typeof u.snippetId === 'string' && validSnippetIds.has(u.snippetId)
      )
    : [];

  // Strict slug enforcement: Level 2 HARUS mempertahankan slug resmi dari Level 1 bila disediakan
  const finalSlug = pageSlug ? pageSlug : slugify(parsed.seoMetadata?.slug || selectedPageTitle);

  // Focus keyword: pertahankan lockedFocusKeyword bila ada
  const finalFocusKeyword = lockedFocusKeyword
    ? lockedFocusKeyword
    : (parsed.seoMetadata?.focusKeyword || '').trim() || selectedPageTitle;

  // Sinkronisasi targetSlug pada internalLinkOpportunities terhadap knownPages
  const knownSlugByTitle = new Map<string, string>();
  const knownSlugSet = new Set<string>();
  for (const kp of knownPages) {
    if (kp.title && kp.slug) {
      knownSlugByTitle.set(kp.title.toLowerCase().trim(), kp.slug);
      knownSlugSet.add(kp.slug.toLowerCase().trim());
    }
  }

  const rawOpportunities = Array.isArray(parsed.internalLinkOpportunities)
    ? parsed.internalLinkOpportunities
    : [];
  const sanitizedLinkOpportunities = rawOpportunities.map((opp: any) => {
    const rawTargetPage = (opp.targetPage || '').toString().trim();
    const rawTargetSlug = (opp.targetSlug || '').toString().trim();

    // 1. Coba cocokkan exact title
    const matchedSlugByTitle = knownSlugByTitle.get(rawTargetPage.toLowerCase());
    let finalTargetSlug = matchedSlugByTitle;

    // 2. Jika tidak cocok via title, cek apakah targetSlug dari AI valid di knownSlugSet
    if (!finalTargetSlug && rawTargetSlug && knownSlugSet.has(rawTargetSlug.toLowerCase())) {
      finalTargetSlug = rawTargetSlug;
    }

    // 3. Fallback jika tidak ada di knownPages: slugify targetPage
    if (!finalTargetSlug) {
      finalTargetSlug = rawTargetSlug ? slugify(rawTargetSlug) : slugify(rawTargetPage);
    }

    // Buang leading slash jika AI menambahkan '/' di awal slug
    finalTargetSlug = finalTargetSlug.replace(/^\/+/, '');

    // Bangun full URL jika websiteUrl tersedia
    const targetUrl = normalizedWebsiteUrl
      ? `${normalizedWebsiteUrl}/${finalTargetSlug}`
      : undefined;

    return {
      targetPage: rawTargetPage,
      targetSlug: finalTargetSlug,
      targetUrl,
      suggestedAnchor: (opp.suggestedAnchor || '').toString().trim(),
      context: (opp.context || '').toString().trim(),
    };
  });

  // Validasi format seoMetadata dan titleOptions
  const rawMetadata = parsed.seoMetadata || {};
  const rawTitleOptions = Array.isArray(rawMetadata.titleOptions) ? rawMetadata.titleOptions : [];
  const validatedTitleOptions: SeoTitleOption[] =
    rawTitleOptions.length > 0
      ? rawTitleOptions
          .filter((t: any) => t && typeof t.title === 'string')
          .map((t: any) => ({
            title: t.title.trim(),
            rationale: (t.rationale || '').toString().trim(),
          }))
      : [
          {
            title: selectedPageTitle,
            rationale: 'Judul default halaman arsitektur.',
          },
        ];

  const rawRecommendedIdx =
    typeof rawMetadata.recommendedTitleIndex === 'number'
      ? rawMetadata.recommendedTitleIndex
      : 0;
  const recommendedTitleIndex =
    rawRecommendedIdx >= 0 && rawRecommendedIdx < validatedTitleOptions.length
      ? rawRecommendedIdx
      : 0;

  const seoMetadata: SeoMetadata = {
    titleOptions: validatedTitleOptions,
    recommendedTitleIndex,
    slug: finalSlug,
    category: (rawMetadata.category || cluster || 'Umum').toString().trim(),
    tags: Array.isArray(rawMetadata.tags)
      ? rawMetadata.tags.map((t: any) => t.toString().trim()).filter(Boolean)
      : [],
    metaTitle: (rawMetadata.metaTitle || selectedPageTitle).toString().trim(),
    metaDescription: (rawMetadata.metaDescription || '').toString().trim(),
    focusKeyword: finalFocusKeyword,
    secondaryKeywords: Array.isArray(rawMetadata.secondaryKeywords)
      ? rawMetadata.secondaryKeywords.map((k: any) => k.toString().trim()).filter(Boolean)
      : [],
  };

  const result: Level2Result = {
    id: `lvl2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    schemaVersion: '1.0',
    engineVersion: '1.0.0',
    qualityRulesVersion: 'google-people-first-v1',
    sourceLevel1Id,
    websiteUrl: normalizedWebsiteUrl,
    topic: topic.trim(),
    selectedPageTitle: selectedPageTitle.trim(),
    selectedPageRole: selectedPageRole,
    searchIntent: (parsed.searchIntent || 'informational') as SearchIntentType,
    userGoal: parsed.userGoal || 'Memahami informasi secara tuntas.',
    primaryEntity: parsed.primaryEntity || selectedPageTitle,
    supportingEntities: parsed.supportingEntities || [],
    questions: parsed.questions || [],
    conceptsToUnderstand: parsed.conceptsToUnderstand || [],
    includedScope: parsed.includedScope || [],
    excludedScope: parsed.excludedScope || [],
    sections: parsed.sections || [],
    evidenceRequirements: parsed.evidenceRequirements || [],
    internalLinkOpportunities: sanitizedLinkOpportunities,
    recommendedReferenceUsage:
      validatedRecommendedUsage.length > 0 ? validatedRecommendedUsage : undefined,
    referenceMaterials: referenceMaterials.length > 0 ? referenceMaterials : undefined,
    linkPlan: linkPlan ?? undefined,
    authorExpertise: authorExpertise?.trim() || undefined,
    peopleFirstQualityGuidance: parsed.peopleFirstQualityGuidance || [],
    searchEngineFirstWarnings: parsed.searchEngineFirstWarnings || [],
    seoMetadata,
    createdAt: new Date().toISOString(),
  };

  return result;
}
