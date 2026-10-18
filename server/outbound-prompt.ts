import { deriveUrlTopicHint } from './outbound-links.js';

export type GroupBasis = 'wilayah' | 'varian produk' | 'domain' | 'kata kunci' | 'urutan';

export interface OutboundGroup {
  label: string;
  urls: string[];
}

export interface OutboundGrouping {
  basis: GroupBasis;
  groups: OutboundGroup[];
}

/** Jika jumlah outbound >= angka ini, seksi referensi memakai <h3> per kelompok. */
const GROUPED_MIN_LINKS = 8;
const GROUP_MIN = 3;
const GROUP_MAX = 6;
const GROUP_IDEAL_MAX = 5;

const STOPWORDS = new Set([
  'di', 'ke', 'dan', 'atau', 'yang', 'untuk', 'dari', 'dengan', 'kota', 'kabupaten', 'kab',
  'jual', 'beli', 'murah', 'terbaru', 'the', 'and', 'for', 'with', 'www', 'com', 'html',
]);

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Kunci "wilayah": nama setelah "di kota/kabupaten/kecamatan/provinsi X" pada petunjuk topik URL. */
function placeKey(url: string): string {
  const hint = deriveUrlTopicHint(url).toLowerCase();
  const m = hint.match(/\bdi\s+(?:kota|kabupaten|kab|kecamatan|kec|provinsi|prov)\s+(.+)$/);
  return m ? m[1].trim() : '';
}

/** Kunci "varian produk": petunjuk topik tanpa bagian " di ..." di ujungnya. */
function variantKey(url: string): string {
  const hint = deriveUrlTopicHint(url).toLowerCase();
  if (!hint || hint === hostOf(url)) return '';
  return hint.replace(/\s+di\s+.+$/, '').trim();
}

/** Kunci "domain": hostname tanpa www. */
function domainKey(url: string): string {
  return hostOf(url);
}

function tokensOf(url: string): Set<string> {
  const hint = deriveUrlTopicHint(url).toLowerCase();
  return new Set(
    hint
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOPWORDS.has(t))
  );
}

/** Pengelompokan "kata kunci": kata yang dimiliki 3 sampai 6 URL sekaligus, dipilih berulang secara greedy. */
function keywordGroups(urls: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const tokenSets = new Map<string, Set<string>>(urls.map((u) => [u, tokensOf(u)]));
  let remaining = [...urls];

  while (remaining.length >= GROUP_MIN) {
    const df = new Map<string, number>();
    for (const u of remaining) {
      for (const t of tokenSets.get(u)!) df.set(t, (df.get(t) ?? 0) + 1);
    }
    let best = '';
    let bestDf = 0;
    for (const [t, c] of df) {
      if (c >= GROUP_MIN && c <= GROUP_MAX && c > bestDf) {
        best = t;
        bestDf = c;
      }
    }
    if (!best) break;
    result.set(best, remaining.filter((u) => tokenSets.get(u)!.has(best)));
    remaining = remaining.filter((u) => !tokenSets.get(u)!.has(best));
  }
  if (remaining.length > 0) result.set('', remaining);
  return result;
}

function groupByKey(urls: string[], keyFn: (u: string) => string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const url of urls) {
    const key = keyFn(url);
    const list = map.get(key) ?? [];
    list.push(url);
    map.set(key, list);
  }
  return map;
}

/** Skor = proporsi link yang berada di kelompok berukuran 3 sampai 6 (kunci kosong = tidak terkelompok). */
function coverage(map: Map<string, string[]>, total: number): number {
  let good = 0;
  for (const [key, urls] of map) {
    if (key !== '' && urls.length >= GROUP_MIN && urls.length <= GROUP_MAX) good += urls.length;
  }
  return total === 0 ? 0 : good / total;
}

/** Membagi items menjadi potongan berukuran seimbang, masing-masing maksimal maxSize. */
function balancedChunks<T>(items: T[], maxSize: number): T[][] {
  if (items.length === 0) return [];
  const k = Math.ceil(items.length / maxSize);
  const base = Math.floor(items.length / k);
  const extra = items.length % k;
  const result: T[][] = [];
  let cursor = 0;
  for (let c = 0; c < k; c++) {
    const size = base + (c < extra ? 1 : 0);
    result.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return result;
}

/**
 * Pengelompokan FLEKSIBEL outbound link. Sistem mencoba beberapa dasar pengelompokan dari URL
 * (wilayah, varian produk, domain, kata kunci bersama), memilih yang paling banyak menghasilkan
 * kelompok berukuran 3 sampai 6 link (seri: urutan prioritas tersebut), lalu merapikannya:
 * kelompok kecil (kurang dari 3) dan link tanpa kunci masuk "Lainnya", kelompok besar (lebih dari 6)
 * dipecah seimbang. Jika tidak ada dasar yang berhasil, link dipotong berurutan ("Kumpulan n").
 * Setiap URL masuk tepat satu kelompok.
 */
export function groupOutboundLinks(outbound: string[]): OutboundGrouping {
  const structured: { basis: GroupBasis; map: Map<string, string[]> }[] = [
    { basis: 'wilayah', map: groupByKey(outbound, placeKey) },
    { basis: 'varian produk', map: groupByKey(outbound, variantKey) },
    { basis: 'domain', map: groupByKey(outbound, domainKey) },
  ];

  let best = structured[0];
  let bestScore = coverage(best.map, outbound.length);
  for (const c of structured.slice(1)) {
    const score = coverage(c.map, outbound.length);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }

  // "Kata kunci" hanya cadangan: dipakai bila dasar terstruktur kurang dari 50% terkelompok.
  if (bestScore < 0.5) {
    const kw = { basis: 'kata kunci' as GroupBasis, map: keywordGroups(outbound) };
    const kwScore = coverage(kw.map, outbound.length);
    if (kwScore > bestScore) {
      best = kw;
      bestScore = kwScore;
    }
  }

  if (bestScore === 0) {
    const chunks = balancedChunks(outbound, GROUP_IDEAL_MAX);
    return {
      basis: 'urutan',
      groups: chunks.map((urls, i) => ({ label: `Kumpulan ${i + 1}`, urls })),
    };
  }

  const groups: OutboundGroup[] = [];
  const pool: string[] = [];
  for (const [key, urls] of best.map) {
    if (key === '' || urls.length < GROUP_MIN) {
      pool.push(...urls);
      continue;
    }
    const label = best.basis === 'kata kunci' ? `Kata kunci: ${key}` : toTitleCase(key);
    if (urls.length <= GROUP_MAX) {
      groups.push({ label, urls });
      continue;
    }
    balancedChunks(urls, GROUP_IDEAL_MAX).forEach((chunk, i) => {
      groups.push({ label: `${label} (bagian ${i + 1})`, urls: chunk });
    });
  }
  if (pool.length > 0) {
    const chunks = balancedChunks(pool, GROUP_IDEAL_MAX);
    chunks.forEach((chunk, i) => {
      groups.push({
        label: chunks.length > 1 ? `Lainnya (bagian ${i + 1})` : 'Lainnya',
        urls: chunk,
      });
    });
  }
  return { basis: best.basis, groups };
}

/** Daftar outbound link + aturan dasar (dipakai di blok TAUTAN WAJIB). */
export function buildOutboundListLines(outbound: string[]): string[] {
  const out: string[] = [];
  out.push(`B. OUTBOUND LINK (WAJIB dimasukkan SEMUA, total ${outbound.length} link):`);

  if (outbound.length >= GROUPED_MIN_LINKS) {
    const { basis, groups } = groupOutboundLinks(outbound);
    out.push(`   Daftar sudah DIKELOMPOKKAN OTOMATIS oleh sistem (${groups.length} kelompok, dasar pengelompokan: ${basis}). Pengelompokan ini WAJIB dipakai apa adanya di seksi referensi: jangan memindahkan link antar kelompok, jangan menggabung atau memecah kelompok.`);
    out.push(`   Format baris: nomor. URL | topik: petunjuk topik dari URL`);
    let no = 0;
    groups.forEach((g, gi) => {
      out.push(``);
      out.push(`   KELOMPOK ${gi + 1}: ${g.label} (${g.urls.length} link)`);
      g.urls.forEach((url) => {
        no++;
        out.push(`   ${no}. ${url} | topik: ${deriveUrlTopicHint(url) || '-'}`);
      });
    });
  } else {
    out.push(`   Daftar (URL | petunjuk topik dari URL):`);
    outbound.forEach((url, idx) => {
      out.push(`   ${idx + 1}. ${url} | topik: ${deriveUrlTopicHint(url) || '-'}`);
    });
  }

  out.push(``);
  out.push(`   ATURAN DASAR:`);
  out.push(`   - Setiap URL dimasukkan TEPAT SATU KALI, href persis seperti tertulis (jangan diubah, jangan ditambah parameter, jangan dipendekkan).`);
  out.push(`   - Jangan menambahkan atribut rel="nofollow", rel="sponsored", atau rel="ugc". Gunakan <a href="..." target="_blank" rel="noopener">.`);
  out.push(`   - Jangan mengarang isi halaman tujuan. Anda tidak bisa membuka URL tersebut. Informasi yang boleh dipakai hanya "petunjuk topik" di atas dan nama domainnya. Dilarang membuat klaim tentang harga, stok, isi, kualitas, atau layanan pada halaman tujuan.`);
  out.push(`   - Jangan menambahkan outbound link lain di luar daftar ini.`);
  out.push(`   - ATURAN PENEMPATAN dan SEKSI REFERENSI untuk link ini ada di bagian paling akhir prompt dan WAJIB diikuti.`);
  out.push(``);
  return out;
}

/** Aturan penempatan + seksi referensi. Ditaruh di AKHIR prompt agar prioritas tertinggi. */
export function buildOutboundPlacementLines(outbound: string[]): string[] {
  const outboundCount = outbound.length;
  const grouped = outboundCount >= GROUPED_MIN_LINKS;
  const grouping = grouped ? groupOutboundLinks(outbound) : null;
  const groupCount = grouping ? grouping.groups.length : Math.max(1, Math.ceil(outboundCount / 4));
  const basisText = grouping ? grouping.basis : 'wilayah, varian produk, atau sumber link';
  const refSectionWords = groupCount * 90 + 80;
  const out: string[] = [];
  out.push(``);
  out.push(`ATURAN PENEMPATAN OUTBOUND LINK (PRIORITAS TERTINGGI, MENIMPA INSTRUKSI LAIN YANG BERTENTANGAN):`);
  out.push(`Artikel ini memiliki ${outboundCount} outbound link. Ikuti aturan berikut tanpa pengecualian.`);
  out.push(``);
  out.push(`A. JALUR DEFAULT`);
  out.push(`1. Kumpulkan SEMUA outbound link di SATU seksi referensi (aturan seksi di bagian C).`);
  out.push(`2. Artikel yang paragraf isinya BERSIH dari outbound link, dan seluruh outbound link-nya berada di seksi referensi, adalah hasil yang BENAR dan DIINGINKAN.`);
  out.push(`3. Jangan menyebar link supaya terlihat merata. Tidak ada kewajiban menaruh link di setiap seksi atau setiap paragraf.`);
  out.push(``);
  out.push(`B. PENGECUALIAN KETAT (outbound link di paragraf isi)`);
  out.push(`1. Sebuah outbound link boleh ditaruh di paragraf isi HANYA jika jenis produk/topik pada "petunjuk topik" sama persis dengan hal yang sedang dibahas di kalimat itu. Kecocokan nama kota saja TIDAK cukup. Jika ragu, taruh di seksi referensi.`);
  out.push(`2. Maksimal 1 outbound link per seksi H2 di paragraf isi, dan sebagian besar seksi H2 sebaiknya tidak memiliki outbound link sama sekali.`);
  out.push(`3. Dilarang ada dua paragraf berurutan yang sama-sama berisi outbound link.`);
  out.push(`4. POSISI: dilarang menaruh outbound link di kalimat terakhir paragraf. Dilarang menaruhnya di paragraf pembuka artikel atau paragraf pembuka seksi. Tautan harus berada di tengah kalimat yang membawa informasi inti paragraf, bukan kalimat tambahan di ujung paragraf.`);
  out.push(`5. Dilarang mengulang pola "paragraf ditutup dengan satu kalimat berisi tautan" pada paragraf yang berbeda.`);
  out.push(`6. Dilarang menyebut nama kota atau wilayah di paragraf isi hanya untuk menciptakan alasan memasukkan tautan.`);
  out.push(`7. Link yang sudah dipakai di paragraf isi TIDAK diulang di seksi referensi. Kelompok boleh menjadi lebih kecil, dan kelompok yang menjadi kosong dibuang.`);
  out.push(``);
  out.push(`C. SEKSI REFERENSI (WAJIB bila ada outbound link yang tidak ditaruh di paragraf isi)`);
  out.push(`1. Posisi: satu <h2> TAMBAHAN di luar struktur seksi yang dipilih, diletakkan setelah seksi isi terakhir, sebelum seksi FAQ bila ada, dan sebelum paragraf penutup. Tidak menggantikan seksi mana pun dari outline.`);
  out.push(`2. Judul: sentence case, relevan dengan topik artikel, tanpa tautan di judul. Boleh memakai kata "referensi", "listing", atau "ketersediaan", misalnya "Referensi listing {topik}" atau "Pilihan {topik} untuk dibandingkan". Jangan menyebut kota atau wilayah di judul kecuali dasar pengelompokan memang wilayah. Isi seksi TIDAK boleh menjanjikan stok, harga, atau layanan.`);
  out.push(`3. Paragraf pembuka (60 sampai 100 kata, tanpa tautan): jelaskan mengapa membandingkan referensi berdasarkan ${basisText} berguna bagi keputusan pembaca terkait topik artikel. Isi sesuai dasar pengelompokan itu; jangan membahas wilayah bila dasarnya bukan wilayah. Hanya klaim umum yang aman.`);
  if (grouped) {
    out.push(`4. Pengelompokan: pakai PERSIS kelompok pada daftar di bagian B (sudah dihitung sistem, ${groupCount} kelompok, dasar: ${basisText}). Buat satu <h3> per kelompok: sentence case, tanpa tautan, judulnya mencerminkan label kelompok itu (nama wilayah, varian produk, domain, atau kata kunci), tanpa kata "kelompok" dan tanpa nomor. Susunan judul <h3> dibuat bervariasi, jangan semuanya berpola sama. Bila label kelompok tidak bermakna sebagai judul ("Lainnya", "Kumpulan n", atau "Kata kunci: ..."), buat judul <h3> dari tema yang dimiliki bersama oleh petunjuk topik link di dalamnya.`);
  } else {
    out.push(`4. Pengelompokan: jumlah link kurang dari 8, jadi cukup 1 sampai 2 paragraf tanpa <h3>. Kelompokkan link secara alami menurut kemiripan petunjuk topik URL (wilayah, varian produk, atau domain bila ada).`);
  }
  out.push(`5. Isi tiap kelompok: 70 sampai 110 kata prosa yang menghubungkan topik artikel dengan konteks kelompok itu, memuat SEMUA link kelompok tersebut. Maksimal 2 link per kalimat, dipisahkan kata yang bermakna (bukan rantai koma). Tiap kelompok memakai sudut pandang berbeda, bukan template yang diulang. Letak tautan dalam paragraf bervariasi.`);
  out.push(`6. Dilarang memakai <ul>/<ol> berisi tautan, tabel tautan, atau daftar nama kota polos.`);
  out.push(`7. Klaim yang dilarang di seksi ini: harga, stok, ongkos kirim, jasa pemasangan, alamat, jam buka, cuaca atau iklim spesifik suatu kota, dan apa pun yang tidak bisa diturunkan dari petunjuk topik URL. Boleh menyebut bahwa tautan mengarah ke halaman listing di domain tersebut, tidak lebih.`);
  out.push(`8. Panjang: seksi referensi menjadi TAMBAHAN di atas target isi inti (sekitar ${refSectionWords} kata untuk artikel ini). Isi inti di luar seksi referensi tetap wajib mengikuti aturan panjang artikel.`);
  out.push(`9. Paragraf penutup artikel TIDAK boleh memuat outbound link. Tautan ke pilar di paragraf penutup tetap diperbolehkan selama total tautan ke pilar tidak melebihi batas pada blok A.`);
  out.push(``);
  out.push(`D. KALIMAT DAN ANCHOR`);
  out.push(`1. Kalimat yang memuat tautan harus membawa makna bagi paragrafnya dan tetap utuh walaupun tautannya dihapus.`);
  out.push(`2. Dilarang memakai kalimat pembungkus seragam. Pola terlarang: "Pembaca di {kota} dapat ...", "Bagi pembaca di {kota} ...", "Pengelola di {kota} dapat ...", "Untuk wilayah {kota}, lihat/tersedia/ada ...", "Bacaan lanjutan / bacaan tambahan / bacaan terkait / bacaan pembanding / rujukan tambahan ...", "Sebagai bacaan lanjutan ...", "Sebagai bacaan tambahan, ada halaman ...", "... bisa dibuka sebagai referensi", "... dapat melanjutkan ke ...", "Halaman ... bisa dijadikan ...", "Pembaca yang ingin ...", "Orang yang ingin ...". Jangan memakai pola kalimat yang sama untuk dua tautan berbeda.`);
  out.push(`3. Anchor text 2 sampai 6 kata, diturunkan dari "petunjuk topik" URL (pertahankan kata kunci produk dari URL, dan nama wilayah hanya bila ada di URL), dengan susunan yang bervariasi antar tautan. Contoh variasi untuk petunjuk "ice bath di kota sleman": "ice bath di Sleman", "unit ice bath wilayah Sleman", "pilihan ice bath Sleman"; untuk petunjuk tanpa wilayah seperti "portable ice bath tub": "portable ice bath tub", "bak ice bath portabel", "pilihan ice bath tub". Jangan memulai semua anchor dengan kata yang sama. Tidak boleh ada dua anchor yang sama persis di seluruh artikel.`);
  out.push(`4. Anchor tidak boleh generik ("klik di sini", "selengkapnya"), bukan URL mentah, dan tidak boleh berisi klaim yang tidak ada di petunjuk topik.`);
  out.push(``);
  return out;
}
