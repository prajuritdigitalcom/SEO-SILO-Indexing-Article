import React, { useState } from 'react';
import { Level1Result, WebsiteType } from '../types.ts';
import {
  Sparkles,
  Layers,
  Link,
  Search,
  Building2,
  Users,
  MapPin,
  CheckCircle2,
  BookOpen,
  FileText,
  Briefcase,
} from 'lucide-react';

interface Level1WorkspaceProps {
  onGenerateLevel1: (params: {
    topic: string;
    targetAudience?: string;
    websiteType?: WebsiteType;
    businessContext?: string;
    location?: string;
    authorExpertise?: string;
    referenceText?: string;
    manualSiloStructure?: string;
    writingVoiceSample?: string;
    websiteUrl?: string;
  }) => Promise<Level1Result>;
  loading: boolean;
}

export const Level1Workspace: React.FC<Level1WorkspaceProps> = ({
  onGenerateLevel1,
  loading,
}) => {
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [websiteType, setWebsiteType] = useState<WebsiteType>('General');
  const [businessContext, setBusinessContext] = useState('');
  const [location, setLocation] = useState('');
  const [authorExpertise, setAuthorExpertise] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [manualSiloStructure, setManualSiloStructure] = useState('');
  const [writingVoiceSample, setWritingVoiceSample] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const presetTopics: Array<{
    title: string;
    type: WebsiteType;
    audience: string;
    context: string;
    referenceText: string;
  }> = [
    {
      title: 'Kayu FJL',
      type: 'Product Website',
      audience: 'Pemilik furniture, kontraktor, pembeli kayu',
      context: 'Kami produsen & distributor papan kayu FJL (Finger Joint Laminated) untuk interior dan mebel',
      referenceText: `SPESIFIKASI TEKNIS KAYU FJL:
Kadar air (MC) standar 10-12% kiln dry. Lem D4 water-resistant bebas formaldehyde berlebih (standar E0/E1). Tersedia kayu pinus, karet (rubberwood), mahoni, dan jati belanda. Ukuran standar lembaran 1220 x 2440 mm dengan ketebalan 12mm, 15mm, 18mm, 20mm, 25mm, hingga 40mm.

UJI BEBAN & KETAHANAN SAMBUNGAN:
Uji tekan dan lentur (bending strength MOR) sambungan finger joint mencapai 95-105 MPa, sebanding dengan kayu solid utuh. Sambungan interlocking meminimalisir risiko muai susut dan warping.

PORTOFOLIO & PENGIRIMAN PABRIK:
Kapasitas produksi 15 kontainer/bulan dengan minimum order 1 peti pallet kayu. Melayani pengiriman door-to-door seluruh Jawa-Bali dan port-to-port luar pulau.`,
    },
    {
      title: 'Pajak UMKM',
      type: 'Educational',
      audience: 'Pemilik UMKM, pengusaha muda, akuntan',
      context: 'Edukasi dan panduan kewajiban perpajakan UMKM berdasarkan regulasi terbaru DJP Indonesia',
      referenceText: `DASAR HUKUM PP 55 TAHUN 2022:
Tarif PPh Final UMKM sebesar 0,5% dari peredaran bruto untuk omzet tahunan hingga Rp 4,8 Miliar. Wajib Pajak Orang Pribadi UMKM mendapat pembebasan pajak untuk omzet sampai dengan Rp 500 Juta pertama per tahun pajak.

BATAS WAKTU PENGGUNAAN PPH FINAL 0.5%:
Jangka waktu pemanfaatan tarif 0,5%: Orang Pribadi maksimal 7 tahun pajak, PT maksimal 3 tahun pajak, CV/Firma/Koperasi maksimal 4 tahun pajak sejak terdaftar.`,
    },
    {
      title: 'Panel Surya',
      type: 'Service Business',
      audience: 'Pemilik rumah, pengelola gedung, pabrik',
      context: 'Jasa EPC (Engineering, Procurement, Construction) instalasi sistem PLTS Atap on-grid & hybrid',
      referenceText: `SPESIFIKASI MODUL TIER-1 & EFISIENSI:
Modul Monocrystalline Half-Cut 550Wp dengan efisiensi modul 21.3%. Garansi output daya linier 25 tahun (minimum 84.8% pada tahun ke-25). Inverter grid-tied bersertifikasi SNI dan IEC dengan efisiensi Eropa 98.2%.

ESTIMASI PENGHEMATAN & ROI:
Penghematan tagihan listrik PLN mencapai 30-50% per bulan. Payback period (BEP) berkisar 4-6 tahun tergantung kapasitas dan profil pemakaian beban siang hari.`,
    },
    {
      title: 'Jasa Desain Interior',
      type: 'Service Business',
      audience: 'Pemilik rumah baru, apartemen, kantor, cafe',
      context: 'Studio desain interior & custom furniture bergaya Japandi dan Modern Tropis',
      referenceText: `STANDAR MATERIAL & HARDWARE:
Bahan dasar Plywood/Multiplek Meranti Grade A tebal 18mm (bukan MDF/particle board). Finishing HPL merek Taco/Aica dengan edging PVC 2mm mesin press. Hardware engsel slow-motion soft close dan rel laci double track full extension tahan beban 35kg.

GARANSI & LAYANAN:
Garansi struktur kabinet 3 tahun dan gratis konsultasi serta 3D visual render revisi 3 kali sebelum produksi workshop.`,
    },
    {
      title: 'Susu Kambing Etawa',
      type: 'Product Website',
      audience: 'Penderita gangguan pernapasan, lansia, keluarga peduli kesehatan',
      context: 'Produsen & distributor susu kambing etawa bubuk organik murni dengan tambahan herbal alami',
      referenceText: `KANDUNGAN NUTRISI & HIGIENIS:
Mengandung senyawa Flourin 10-100 kali lebih tinggi dari susu sapi untuk menjaga kesehatan saluran pernapasan dan paru-paru. Molekul lemak lebih kecil dan homogen sehingga sangat mudah diserap tubuh tanpa memicu alergi laktosa atau asam lambung naik. Diproses melalui teknologi spray drying suhu rendah untuk mempertahankan enzim alami bioaktif.

LEGALITAS & SERTIFIKASI RESMI:
Izin edar resmi BPOM RI MD 803112001000 dan sertifikasi Halal ID33110000250001021. Bebas bahan pengawet, pemanis buatan, dan tanpa krimer nabati trans-fat.`,
    },
    {
      title: 'Software Payroll',
      type: 'Product Website',
      audience: 'HRD Manager, pemilik bisnis, Finance Director',
      context: 'Aplikasi SaaS HRIS & payroll otomatis berbasis cloud untuk otomasi gaji, PPh 21 TER, dan BPJS',
      referenceText: `FITUR PERHITUNGAN OTOMATIS SESUAI REGULASI:
Kalkulasi PPh 21 tarif efektif rata-rata (TER) sesuai PP 58/2023 dan PMK 168/2023. Perhitungan iuran BPJS Ketenagakerjaan (JKK, JKM, JHT, JP) dan BPJS Kesehatan dengan pembaruan otomatis batas atas upah.

INTEGRASI & KEAMANAN DATA:
Integrasi absensi biometrik mesin sidik jari & GPS mobile selfie anti-fake GPS. Enkripsi standar perbankan SSL 256-bit dan sertifikasi keamanan ISO 27001 pada server cloud lokal tier-4.`,
    },
  ];

  const applyPreset = (preset: (typeof presetTopics)[0]) => {
    setTopic(preset.title);
    setWebsiteType(preset.type);
    setTargetAudience(preset.audience);
    setBusinessContext(preset.context);
    setReferenceText(preset.referenceText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    try {
      await onGenerateLevel1({
        topic: topic.trim(),
        targetAudience: targetAudience.trim() || undefined,
        websiteType,
        businessContext: businessContext.trim() || undefined,
        location: location.trim() || undefined,
        authorExpertise: authorExpertise.trim() || undefined,
        referenceText: referenceText.trim() || undefined,
        manualSiloStructure: manualSiloStructure.trim() || undefined,
        writingVoiceSample: writingVoiceSample.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
      });
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Gagal menghasilkan Level 1 Architecture'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form Card */}
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs">
        {/* Preset Chips */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[#6F6670] mb-2">
            Contoh Topik Cepat (Preset Referensi Lengkap):
          </label>
          <div className="flex flex-wrap gap-2">
            {presetTopics.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 bg-[#FFF9FA] hover:bg-[#FFE8EE] border border-[#F1DDE2] hover:border-[#FE4C6F] rounded-xl text-xs font-medium text-[#1F1720] hover:text-[#FE4C6F] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#FE4C6F]" />
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Baris 1: Topik, Website URL, Tipe Website, Target Audiens, Konteks Bisnis, Lokasi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Baris 1 - Kolom 1: Topik */}
            <div>
              <label className="block text-xs font-semibold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#FE4C6F]" /> Topik / Niche Utama (Wajib)
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Kayu FJL, Pajak UMKM, Panel Surya..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] transition-colors"
              />
            </div>

            {/* Baris 1 - Kolom 2: URL Website */}
            <div>
              <label className="block text-xs font-semibold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-[#FE4C6F]" /> URL Website (Opsional)
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://contohdomain.com"
                className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] transition-colors"
              />
            </div>

            {/* Baris 1 - Kolom 3: Tipe Website */}
            <div>
              <label className="block text-xs font-semibold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#FE4C6F]" /> Tipe Website
              </label>
              <select
                value={websiteType}
                onChange={(e) => setWebsiteType(e.target.value as WebsiteType)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] transition-colors cursor-pointer"
              >
                <option value="General">General / General Website</option>
                <option value="Company Profile">Company Profile / Bisnis</option>
                <option value="Ecommerce">Ecommerce / Toko Online</option>
                <option value="Blog">Blog / Portal Berita</option>
                <option value="Affiliate">Affiliate / Review Site</option>
                <option value="Educational">Educational / Edukasi</option>
                <option value="Service Business">Service Business / Jasa</option>
                <option value="Product Website">Product Website / Katalog</option>
                <option value="Publisher">Publisher / Media</option>
              </select>
            </div>

            {/* Baris 2 - Kolom 1: Target Audiens */}
            <div>
              <label className="block text-xs font-semibold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#FE4C6F]" /> Target Audiens (Opsional)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Contoh: Pemilik furniture, kontraktor..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] transition-colors"
              />
            </div>

            {/* Baris 2 - Kolom 2: Konteks Bisnis */}
            <div>
              <label className="block text-xs font-semibold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#FE4C6F]" /> Konteks Bisnis (Opsional)
              </label>
              <input
                type="text"
                value={businessContext}
                onChange={(e) => setBusinessContext(e.target.value)}
                placeholder="Contoh: Produsen kayu FJL ekspor & lokal..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] transition-colors"
              />
            </div>

            {/* Baris 2 - Kolom 3: Lokasi Target */}
            <div>
              <label className="block text-xs font-semibold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FE4C6F]" /> Lokasi Target (Opsional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Indonesia, Jakarta, Global..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] transition-colors"
              />
            </div>
          </div>

          {/* Struktur SILO Hasil Riset Sendiri (Opsional, Full Width) */}
          <div className="bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl p-4">
            <label className="block text-xs font-bold text-[#1F1720] mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FE4C6F]" />
              Struktur SILO Hasil Riset Sendiri (Opsional — Lewati Riset Struktur oleh AI)
            </label>
            <textarea
              rows={8}
              value={manualSiloStructure}
              onChange={(e) => setManualSiloStructure(e.target.value)}
              placeholder={`Sudah punya riset SILO sendiri? Tempelkan di sini (format bebas: tree, bullet, atau daftar bertingkat), contoh:\n\nPILLAR: PINTU KAYU FJL\n/pintu-kayu-fjl/\n\nTRANSACTIONAL\n- Harga Pintu Kayu FJL   /harga-pintu-kayu-fjl/\n- Pintu Kayu FJL Custom  /pintu-kayu-fjl-custom/\n\nEDUKASI\n- Apa Itu Pintu Kayu FJL?\n- Kelebihan Pintu Kayu FJL\n- Cara Merawat Pintu Kayu FJL`}
              className="w-full px-3.5 py-2.5 bg-white border border-[#F1DDE2] rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] leading-relaxed resize-y"
            />
            <p className="text-[10px] text-[#6F6670] mt-1.5">
              {manualSiloStructure.trim().length > 0
                ? 'Mode "Susun dari Riset Sendiri" aktif — AI tidak akan meriset ulang Pillar/Kategori/Halaman, hanya menyusun & melengkapi metadata SEO teknis mengikuti struktur ini apa adanya.'
                : 'Kosongkan bagian ini jika ingin AI yang meriset dan menyusun struktur SILO dari nol berdasarkan Topik di atas.'}
            </p>
          </div>

          {/* 3 Input Pendukung Sejajar (1 Baris, Lebar & Tinggi Sama) */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Kolom 1: Latar Belakang Keahlian Penulis / Bisnis (E-E-A-T) */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-[#1F1720] mb-1.5 flex items-center gap-1.5 min-h-[20px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FE4C6F] shrink-0" />
                  <span className="truncate" title="Latar Belakang Keahlian Penulis / Bisnis (E-E-A-T) (Opsional)">
                    Keahlian Penulis (E-E-A-T) (Opsional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={authorExpertise}
                  onChange={(e) => setAuthorExpertise(e.target.value)}
                  placeholder="Contoh: Kami adalah tim insinyur kayu dengan pengalaman 15 tahun di industri perkayuan ekspor, menguji standar kekuatan lem D4..."
                  className="w-full flex-1 px-3 py-2 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] leading-relaxed resize-none h-28"
                />
                <p className="text-[10px] text-[#6F6670] mt-1.5 line-clamp-2">
                  Memperkuat sinyal E-E-A-T dan sudut pandang pembahasan artikel.
                </p>
              </div>

              {/* Kolom 2: Informasi Referensi & Fakta Perusahaan */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-[#1F1720] mb-1.5 flex items-center gap-1.5 min-h-[20px]">
                  <BookOpen className="w-3.5 h-3.5 text-[#FE4C6F] shrink-0" />
                  <span className="truncate" title="Informasi Referensi & Fakta Perusahaan (Opsional)">
                    Informasi Referensi & Fakta (Opsional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  placeholder="Contoh: Brosur produk, spesifikasi teknis, sertifikasi, hasil uji lab, data harga, pengalaman/studi kasus lapangan..."
                  className="w-full flex-1 px-3 py-2 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] leading-relaxed resize-none h-28"
                />
                <p className="text-[10px] text-[#6F6670] mt-1.5 line-clamp-2">
                  {referenceText.trim().length > 0
                    ? `${referenceText.trim().length.toLocaleString('id-ID')} karakter siap diolah AI.`
                    : 'Data/fakta pendukung untuk bank referensi.'}
                </p>
              </div>

              {/* Kolom 3: Contoh Gaya Tulisan / Writing Voice Sample */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-[#1F1720] mb-1.5 flex items-center gap-1.5 min-h-[20px]">
                  <FileText className="w-3.5 h-3.5 text-[#FE4C6F]" />
                  <span className="truncate" title="Contoh Gaya Tulisan / Writing Voice Sample (Opsional)">
                    Gaya Tulisan / Voice Sample (Opsional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={writingVoiceSample}
                  onChange={(e) => setWritingVoiceSample(e.target.value)}
                  placeholder="Contoh: Tempelkan 2-3 paragraf tulisan asli yang sudah dipublikasikan agar AI meniru ritme kalimat & gaya tutur brand Anda."
                  className="w-full flex-1 px-3 py-2 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] leading-relaxed resize-none h-28"
                />
                <p className="text-[10px] text-[#6F6670] mt-1.5 line-clamp-2">
                  Acuan nada & gaya bahasa saat merangkai prompt di Level 2.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="px-6 py-2.5 bg-[#FE4C6F] hover:bg-[#E83E60] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memproses Level 1 Architecture...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Level 1 Architecture</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Stage Display */}
      {loading && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-[#FFE8EE] text-[#FE4C6F] rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-base text-[#1F1720]">
              Menyusun Arsitektur Pengetahuan & SILO Structure...
            </h4>
            <p className="text-xs text-[#6F6670] mt-1">
              Sistem sedang menerapkan prinsip Google Search Central untuk menghindari cannibalization dan thin content.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-[#FE4C6F] font-medium pt-2">
            <div className="w-2 h-2 rounded-full bg-[#FE4C6F] animate-ping" />
            <span>Proses AI Orchestration dengan Failover & Key Pool Rotation...</span>
          </div>
        </div>
      )}
    </div>
  );
};
