import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { Level1Result, WebsiteType } from '../src/types.js';
import { GEMINI_MODEL, resolveModelsForKey } from './gemini-config.js';
import { dedupeSlug, slugify } from './slug-utils.js';
import { executeWithParseRetry } from './gemini-retry-utils.js';

export interface Level1Input {
  apiKey?: string;
  topic: string;
  targetAudience?: string;
  websiteType?: WebsiteType;
  businessContext?: string;
  location?: string;
  /** Latar belakang keahlian praktis/bisnis untuk sinyal E-E-A-T. */
  authorExpertise?: string;
  /** Teks referensi bebas format yang ditempel pengguna, tanpa perlu tagging manual. */
  referenceText?: string;
  /** Struktur SILO hasil riset manual pengguna sendiri (Pillar, kategori/cluster, judul halaman, slug opsional), format bebas (tree/bullet/daftar bertingkat). Jika terisi, AI TIDAK meriset struktur dari nol — AI hanya menyusun & melengkapi metadata teknis SEO mengikuti struktur ini apa adanya. */
  manualSiloStructure?: string;
  /** Daftar outbound link untuk artikel pendukung. */
  outboundLinks?: string[];
  /** URL website utama (root domain), dipakai untuk menyusun internal link otomatis di Level 2. */
  websiteUrl?: string;
}

export async function generateLevel1Architecture(input: Level1Input): Promise<Level1Result> {
  const {
    apiKey,
    topic,
    targetAudience,
    websiteType = 'General',
    businessContext,
    location,
    authorExpertise,
    referenceText = '',
    manualSiloStructure = '',
    outboundLinks = [],
    websiteUrl,
  } = input;

  // Buang trailing slash supaya penggabungan "domain + slug" nanti tidak jadi "domain//slug"
  const normalizedWebsiteUrl = websiteUrl?.trim().replace(/\/+$/, '') || undefined;

  if (!topic || topic.trim().length === 0) {
    throw new Error('Topik tidak boleh kosong');
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
Anda adalah **SEO Knowledge Architect** & **Content Strategy Engine** senior yang menerapkan prinsip-prinsip utama **Google Search Central — Creating Helpful, Reliable, People-First Content**.

TUGAS UTAMA:
Mengubah sebuah topik utama menjadi **Arsitektur Pengetahuan (Knowledge Architecture)**, **Topic Clusters**, **SILO Architecture**, **Rekomendasi Internal Link**, **Gap Analysis**, dan **Content Roadmap**.

PRINSIP GOOGLE PEOPLE-FIRST CONTENT (MANDATORI):
1. Mengutamakan kepuasan informasi pengguna (Satisfying Information Experience), bukan sekadar menumpuk keyword.
2. Setiap halaman harus memiliki ALASAN TEPAT UNTUK EKSIS (Primary Purpose). Jangan membuat halaman terpisah hanya karena variasi keyword tipis (mencegah Cannibalization & Search-Engine-First thin content).
3. Mengelompokkan pengetahuan secara logis (Pillar -> Sub-pillar -> Spoke/Supporting pages).
4. Menghasilkan jangkar teks internal link (Anchor Text) yang alami dan kontekstual.
5. Sebelum menetapkan suggestedFocusKeyword dan intent tiap halaman, pastikan frasa tersebut realistis dan spesifik (bukan sekadar variasi kata teoritis), selaras dengan pola pencarian yang lazim untuk topik dan lokasi tersebut.

PETUNJUK OUTPUT JSON:
Kembalikan JSON terstruktur sesuai format persis tanpa teks pengantar atau markdown tambahan.
`.trim();

  const hasManualSilo = manualSiloStructure.trim().length > 0;

  const prompt = `
Susun Level 1 Topic Architecture untuk:
- TOPIK UTAMA: "${topic.trim()}"
- TARGET AUDIENS: "${targetAudience || 'Pengguna umum / calon pelanggan'}"
- TIPE WEBSITE: "${websiteType}"
- KONTEKS BISNIS: "${businessContext || 'Umum / Referensi Produk / Layanan'}"
- LOKASI: "${location || 'Indonesia'}"
- LATAR BELAKANG KEAHLIAN PENULIS/BISNIS (E-E-A-T): "${authorExpertise || 'Tidak ada catatan tambahan'}"
${
  referenceText.trim().length > 0
    ? `\n- INFORMASI REFERENSI MENTAH DARI PENGGUNA (bebas format — bisa berupa paragraf, poin acak, tabel teks, campuran topik apa saja: spesifikasi, sertifikasi, data uji, regulasi, harga, pengalaman lapangan, dll.):\n"""\n${referenceText.trim()}\n"""\n\nPETUNJUK PENGOLAHAN REFERENSI (WAJIB): Baca seluruh teks di atas sendiri, lalu:\n(a) Gunakan fakta-fakta di dalamnya untuk memperkaya & mempertajam Knowledge Architecture, Clusters, SILO Pages, dan Gap Analysis di bawah ini — JANGAN mengarang data yang tidak ada di teks.\n(b) Pecah teks tersebut sendiri menjadi butir-butir fakta diskrit yang berguna pada field "referenceMaterials" (list of { title, category, content }). Anda yang menentukan judul, kategori (mis. Spesifikasi/Data Uji/Regulasi/Standar Operasional/Komersial/Pengalaman Lapangan), dan isi tiap butir — jangan mengubah makna fakta aslinya. Jika teks kosong atau tidak relevan, kosongkan list ini.`
    : ''
}
${
  hasManualSilo
    ? `\n- STRUKTUR SILO HASIL RISET PENGGUNA SENDIRI (WAJIB DIPATUHI APA ADANYA — INI SUMBER KEBENARAN UTAMA UNTUK STRUKTUR, BUKAN HASIL RISET ANDA):\n"""\n${manualSiloStructure.trim()}\n"""\n\nATURAN WAJIB KETIKA STRUKTUR SILO DI ATAS TERSEDIA (MODE "SUSUN DARI RISET SENDIRI"):\n(a) Pengguna sudah menyelesaikan riset & penentuan Pillar, Kategori/Cluster, judul halaman, dan (jika ada) slug. Tugas Anda BUKAN meriset ulang atau membuat struktur baru dari nol — tugas Anda HANYA menyusun (structuring) & melengkapi metadata teknis SEO mengikuti struktur ini.\n(b) JANGAN menghapus, mengganti, atau menggabungkan Pillar/Kategori/Halaman yang sudah ditentukan pengguna. Anda BOLEH menambah halaman baru hanya lewat field "gaps" (lihat poin 5 di bawah) jika menemukan celah topik yang sungguh-sungguh nyata dan relevan — jangan menyusupkan halaman baru secara diam-diam ke dalam "siloPages" tanpa alasan kuat.\n(c) Setiap baris kategori/grouping level atas pada struktur (contoh: TRANSACTIONAL, B2B, PRODUK BERDASARKAN MATERIAL, SPESIFIKASI, EDUKASI) WAJIB dipetakan apa adanya ke field "cluster" pada setiap siloPages di bawahnya — gunakan label yang sama persis seperti yang ditulis pengguna (boleh dirapikan kapitalisasi/spasinya saja, jangan diubah maknanya atau digabung dengan kategori lain).\n(d) Field "siloPages" hasil akhir HANYA BOLEH berisi TEPAT SATU halaman dengan pageRole "Pillar", dan halaman itu WAJIB merepresentasikan TOPIK UTAMA ("${topic.trim()}") yang tercantum di atas — BUKAN dibuat dari baris di dalam struktur riset pengguna. JIKA struktur di atas turut mencantumkan baris root/akar berlabel "PILLAR: ..." (atau sejenisnya), JANGAN jadikan baris itu halaman Pillar kedua/duplikat pada "siloPages" — perlakukan HANYA sebagai detail tambahan (misalnya path/slug Pillar, jika dicantumkan) untuk melengkapi Pillar tunggal yang sudah mewakili Topik Utama. Setiap baris judul halaman SELAIN baris PILLAR tsb (semua kategori & halaman di bawahnya) WAJIB tetap menjadi objek terpisah pada "siloPages" seperti biasa.\n(e) Jika sebuah baris sudah mencantumkan slug/path (contoh: "/harga-pintu-kayu-fjl/"), jadikan itu dasar "suggestedSlug" (boleh dirapikan formatnya, tapi jangan diganti kata-katanya). Jika baris tidak mencantumkan slug, turunkan slug dari judul halaman tsb seperti biasa.\n(f) Relasi "parentPage" / "childPages" WAJIB mengikuti persis level indentasi/hierarki pada struktur yang diberikan — Pillar menjadi parentPage dari seluruh halaman non-Pillar; JANGAN membuat ulang hierarki hasil interpretasi bebas yang berbeda dari yang ditulis pengguna.\n(g) Anda TETAP WAJIB melengkapi setiap halaman dengan field metadata teknis yang belum tersedia di struktur pengguna — pageRole, intent, primaryEntity, supportingEntities, priority, rationale, scopeSummary, dan suggestedFocusKeyword — simpulkan secara logis dari judul halaman & posisinya dalam struktur, pastikan realistis dan selaras dengan pola pencarian yang lazim sesuai instruksi sistem.\n(h) Jika ada catatan tambahan di belakang judul (mis. tanda bintang "*", catatan dalam kurung, dsb.), perlakukan sebagai catatan konteks untuk "rationale" — bukan bagian dari judul/slug final.`
    : ''
}

Catatan Umum (berlaku di kedua mode): Pillar Page SELALU merepresentasikan TOPIK UTAMA di atas — hasil akhir hanya boleh memiliki TEPAT SATU halaman berpageRole "Pillar" di seluruh "siloPages", tidak peduli apakah struktur berasal dari riset AI maupun dari Struktur SILO Riset Pengguna.

Persyaratan Detail:
1. Knowledge Architecture: Dekomposisi topik ke dalam node hierarkis (Fundamental, Material, Manufacturing/Proses, Kualitas/Properties, Aplikasi/Penggunaan, Perbandingan, Komersial/Harga, Perawatan/FAQ)${hasManualSilo ? ' — selaraskan dengan Struktur SILO Riset Pengguna di atas, jangan bertentangan dengannya' : ''}.
2. Clusters: Kelompokkan topik menjadi 4-8 Topic Clusters yang adaptif dan bermakna${hasManualSilo ? ' — KARENA Struktur SILO Riset Pengguna tersedia, susun field "clusters" ini mengikuti kategori/grouping yang SUDAH ditentukan pengguna (lihat ATURAN WAJIB di atas), jangan membuat pengelompokan baru' : ''}.
3. SILO Architecture: ${hasManualSilo ? 'Susun "siloPages" PERSIS mengikuti Struktur SILO Riset Pengguna di atas sesuai ATURAN WAJIB-nya — JANGAN meriset/menentukan Pillar & Supporting Pages dari nol.' : 'Tentukan halaman-halaman utama (1 Pillar Page + 6-15 Supporting/Spoke Pages) dengan Page Role yang presisi. Tentukan relasi parentPage, childPages, dan relatedPages.'} Page Role yang presisi (Pillar, Definition, Guide, Process, Comparison, Application, Commercial Investigation, Buying Guide, Problem/Solution, Maintenance, Reference, FAQ) tetap wajib diisi untuk tiap halaman. Setiap "suggestedSlug" WAJIB berupa SATU segmen URL datar (flat), huruf kecil, kata dipisah tanda hubung "-", TANPA karakter "/". Hierarki parent-child cukup dinyatakan lewat field parentPage/childPages — JANGAN direpresentasikan lewat path URL bertingkat. Untuk setiap halaman, isi juga "suggestedFocusKeyword": SATU frasa kata kunci target (query pencarian realistis, 2-5 kata) yang merepresentasikan halaman ini. Frasa ini WAJIB selaras dengan "title" dan "primaryEntity" halaman tsb, dan akan dipakai sebagai acuan tunggal untuk Judul H1, Slug, Meta Title, dan Meta Description saat halaman ini dikembangkan lebih lanjut di Level 2 — jadi pastikan realistis dan spesifik, bukan generik. Untuk setiap halaman, isi juga "scopeSummary": 1-2 kalimat yang secara SPESIFIK menyatakan apa yang WAJIB dibahas mendalam oleh halaman ini dan apa yang TIDAK akan dibahasnya secara mendalam. Field ini akan dipakai sebagai acuan anti-kanibalisasi untuk seluruh SILO, jadi pastikan scopeSummary antar halaman tidak saling tumpang tindih.
4. Internal Links: Berikan rekomendasi tautan internal dengan jangkar teks yang natural.
5. Architecture Gap: Evaluasi coverage score (0-100) dan sebutkan 2-4 area pengetahuan yang mendesak untuk dilengkapi${hasManualSilo ? ' — KHUSUS mode ini, hanya laporkan gap yang benar-benar belum tercakup oleh Struktur SILO Riset Pengguna; jangan mengarang gap hanya supaya field ini terisi' : ''}.
6. Roadmap: Buat 5-10 langkah urutan publikasi konten prioritas.
`.trim();

  const PAGE_ROLES = [
    'Pillar',
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
              summary: { type: Type.STRING },
              architectureCoverageScore: { type: Type.NUMBER },
              referenceMaterials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ['title', 'content'],
                },
              },
              knowledgeArchitecture: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    purpose: { type: Type.STRING },
                    importance: { type: Type.STRING, enum: PRIORITY_LEVELS },
                    parentId: { type: Type.STRING },
                  },
                  required: ['id', 'name', 'type', 'purpose', 'importance'],
                },
              },
              clusters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    purpose: { type: Type.STRING },
                    parentTopic: { type: Type.STRING },
                    searchIntentCoverage: { type: Type.ARRAY, items: { type: Type.STRING } },
                    candidatePages: { type: Type.ARRAY, items: { type: Type.STRING } },
                    relevantEntities: { type: Type.ARRAY, items: { type: Type.STRING } },
                    priority: { type: Type.STRING, enum: PRIORITY_LEVELS },
                  },
                  required: [
                    'id',
                    'name',
                    'purpose',
                    'parentTopic',
                    'searchIntentCoverage',
                    'candidatePages',
                    'relevantEntities',
                    'priority',
                  ],
                },
              },
              siloPages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    suggestedSlug: { type: Type.STRING },
                    suggestedFocusKeyword: { type: Type.STRING },
                    pageRole: { type: Type.STRING, enum: PAGE_ROLES },
                    cluster: { type: Type.STRING },
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
                    'title',
                    'suggestedSlug',
                    'suggestedFocusKeyword',
                    'pageRole',
                    'cluster',
                    'intent',
                    'primaryEntity',
                    'supportingEntities',
                    'priority',
                    'rationale',
                    'scopeSummary',
                  ],
                },
              },
              internalLinks: {
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
              gaps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topicArea: { type: Type.STRING },
                    description: { type: Type.STRING },
                    urgency: { type: Type.STRING, enum: PRIORITY_LEVELS },
                    suggestedPageRole: { type: Type.STRING, enum: PAGE_ROLES },
                  },
                  required: ['topicArea', 'description', 'urgency'],
                },
              },
              roadmap: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.NUMBER },
                    pageTitle: { type: Type.STRING },
                    pageRole: { type: Type.STRING, enum: PAGE_ROLES },
                    rationale: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: PRIORITY_LEVELS },
                  },
                  required: ['step', 'pageTitle', 'pageRole', 'rationale', 'priority'],
                },
              },
            },
            required: [
              'summary',
              'architectureCoverageScore',
              'knowledgeArchitecture',
              'clusters',
              'siloPages',
              'internalLinks',
              'gaps',
              'roadmap',
            ],
          },
        },
      });
    },
    resolvedModels,
    2
  );

  const rawExtractedReferences = Array.isArray(parsed.referenceMaterials) ? parsed.referenceMaterials : [];
  const extractedReferenceMaterials = rawExtractedReferences
    .filter((r: any) => r && typeof r.title === 'string' && typeof r.content === 'string')
    .map((r: any, idx: number) => ({
      id: `ref_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      title: r.title.trim(),
      category: typeof r.category === 'string' && r.category.trim() ? r.category.trim() : undefined,
      content: r.content.trim(),
    }));

  const rawSiloPages = Array.isArray(parsed.siloPages) ? parsed.siloPages : [];
  const warnings: string[] = [];
  if (!hasManualSilo && (rawSiloPages.length < 7 || rawSiloPages.length > 16)) {
    const msg = `Jumlah SILO pages (${rawSiloPages.length}) di luar rekomendasi ideal (7-16 halaman). Pertimbangkan generate ulang atau edit manual.`;
    console.warn(`[Level 1 Warning] ${msg}`);
    warnings.push(msg);
  }

  // P2-2: Jangan diam-diam menutupi kegagalan architectureCoverageScore
  const hasValidScore = typeof parsed.architectureCoverageScore === 'number';
  if (!hasValidScore) {
    warnings.push('Skor coverage arsitektur tidak berhasil dihitung oleh AI — menampilkan nilai default (80), bukan penilaian aktual.');
  }
  const architectureCoverageScore = hasValidScore
    ? Math.min(100, Math.max(0, parsed.architectureCoverageScore))
    : 80;

  const usedSlugs = new Set<string>();
  const sanitizedSiloPages = rawSiloPages.map((p: any) => {
    const baseSlug = typeof p.suggestedSlug === 'string' ? slugify(p.suggestedSlug) : 'page';
    const finalSlug = dedupeSlug(baseSlug, usedSlugs);
    usedSlugs.add(finalSlug);

    const suggestedFocusKeyword =
      typeof p.suggestedFocusKeyword === 'string' && p.suggestedFocusKeyword.trim()
        ? p.suggestedFocusKeyword.trim()
        : (p.primaryEntity || p.title || '').toString().trim();

    return {
      ...p,
      suggestedSlug: finalSlug,
      suggestedFocusKeyword,
    };
  });

  const result: Level1Result = {
    id: `lvl1_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    schemaVersion: '1.0',
    engineVersion: '1.0.0',
    qualityRulesVersion: 'google-people-first-v1',
    topic: topic.trim(),
    summary: parsed.summary || 'Arsitektur topik berhasil disusun secara holistik.',
    targetAudience,
    websiteType,
    businessContext,
    location,
    authorExpertise: authorExpertise?.trim() || undefined,
    websiteUrl: normalizedWebsiteUrl,
    referenceNotes: referenceText.trim() || undefined,
    manualSiloStructure: manualSiloStructure.trim() || undefined,
    outboundLinks: outboundLinks.length > 0 ? outboundLinks : undefined,
    referenceMaterials: extractedReferenceMaterials.length > 0 ? extractedReferenceMaterials : undefined,
    knowledgeArchitecture: parsed.knowledgeArchitecture || [],
    clusters: parsed.clusters || [],
    siloPages: sanitizedSiloPages,
    internalLinks: parsed.internalLinks || [],
    architectureCoverageScore,
    gaps: parsed.gaps || [],
    roadmap: parsed.roadmap || [],
    warnings: warnings.length > 0 ? warnings : undefined,
    createdAt: new Date().toISOString(),
  };

  return result;
}
