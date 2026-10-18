import React, { useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Hash,
  Layers,
  Link2,
  Sparkles,
  Tag,
  Target,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Edit3,
} from 'lucide-react';
import { SeoMetadata } from '../types';
import { slugify } from '../lib/slug-utils';

interface SeoMetadataPanelProps {
  metadata?: SeoMetadata;
  pageRole?: string;
  onChange?: (updated: SeoMetadata) => void;
}

export const SeoMetadataPanel: React.FC<SeoMetadataPanelProps> = ({
  metadata,
  pageRole,
  onChange,
}) => {
  if (!metadata) return null;

  const [selectedTitleIdx, setSelectedTitleIdx] = useState<number>(() => {
    if (
      typeof metadata.recommendedTitleIndex === 'number' &&
      metadata.recommendedTitleIndex >= 0 &&
      metadata.recommendedTitleIndex < metadata.titleOptions.length
    ) {
      return metadata.recommendedTitleIndex;
    }
    return 0;
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const selectedTitle =
    metadata.titleOptions[selectedTitleIdx]?.title ||
    metadata.titleOptions[0]?.title ||
    '';

  const copyAllAsCmsBlock = () => {
    const lines = [
      `Judul: ${selectedTitle}`,
      `Slug: ${metadata.slug}`,
      `Kategori: ${metadata.category}`,
      `Tags: ${metadata.tags.join(', ')}`,
      `Focus Keyword: ${metadata.focusKeyword}`,
      metadata.secondaryKeywords.length > 0
        ? `Secondary Keywords: ${metadata.secondaryKeywords.join(', ')}`
        : null,
      `Meta Title: ${metadata.metaTitle} (${metadata.metaTitle.length} karakter)`,
      `Meta Description: ${metadata.metaDescription} (${metadata.metaDescription.length} karakter)`,
    ]
      .filter(Boolean)
      .join('\n');

    copyToClipboard(lines, 'all_cms');
  };

  const metaTitleLen = metadata.metaTitle.length;
  const metaDescLen = metadata.metaDescription.length;

  // Real-time synchronization checks
  const kwLower = (metadata.focusKeyword || '').trim().toLowerCase();
  const isSynced = (text: string) =>
    kwLower.length > 0 && (text || '').toLowerCase().includes(kwLower);

  const syncChecks = [
    { label: 'Judul H1', ok: isSynced(selectedTitle) },
    {
      label: 'Slug URL',
      ok:
        kwLower.length > 0 &&
        (metadata.slug || '').toLowerCase().replace(/[-_]/g, ' ').includes(kwLower.replace(/[-_]/g, ' ')),
    },
    { label: 'Meta Title', ok: isSynced(metadata.metaTitle) },
    { label: 'Meta Description', ok: isSynced(metadata.metaDescription) },
  ];

  const allSynced = syncChecks.every((c) => c.ok);

  // Field change handlers for controlled mode
  const handleFocusKeywordChange = (newKw: string) => {
    onChange?.({
      ...metadata,
      focusKeyword: newKw,
    });
  };

  const handleSlugChange = (newSlug: string) => {
    onChange?.({
      ...metadata,
      slug: slugify(newSlug),
    });
  };

  const handleCategoryChange = (newCat: string) => {
    onChange?.({
      ...metadata,
      category: newCat,
    });
  };

  const handleTagsChange = (rawTags: string) => {
    const split = rawTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onChange?.({
      ...metadata,
      tags: split,
    });
  };

  const handleMetaTitleChange = (newTitle: string) => {
    onChange?.({
      ...metadata,
      metaTitle: newTitle,
    });
  };

  const handleMetaDescChange = (newDesc: string) => {
    onChange?.({
      ...metadata,
      metaDescription: newDesc,
    });
  };

  const handleSelectTitleIdx = (idx: number) => {
    setSelectedTitleIdx(idx);
    onChange?.({
      ...metadata,
      recommendedTitleIndex: idx,
    });
  };

  // Auto-sync function (Client-side fast alignment)
  // Tidak lagi memotong paksa ke batas karakter — panjang boleh melebihi acuan SERP
  // selama hasilnya tetap sinkron dengan focusKeyword dan nyaman dibaca.
  const handleAutoAlign = () => {
    const kw = metadata.focusKeyword.trim();
    if (!kw) return;

    let updatedMetaTitle = metadata.metaTitle;
    if (!isSynced(updatedMetaTitle)) {
      updatedMetaTitle = `${kw}: ${updatedMetaTitle}`;
    }

    let updatedMetaDesc = metadata.metaDescription;
    if (!isSynced(updatedMetaDesc)) {
      updatedMetaDesc = `Pelajari ${kw} secara lengkap. ${updatedMetaDesc}`;
    }

    // FIX: Slug URL juga wajib ikut diselaraskan.
    let updatedSlug = metadata.slug;
    const slugIsSynced =
      kwLower.length > 0 &&
      (updatedSlug || '').toLowerCase().replace(/[-_]/g, ' ').includes(kwLower.replace(/[-_]/g, ' '));
    if (!slugIsSynced) {
      updatedSlug = slugify(kw);
    }

    // FIX (revisi): Judul H1 wajib diselaraskan. Prioritas 1: kalau ada
    // opsi LAIN di antara titleOptions yang SUDAH mengandung Focus Keyword,
    // pindahkan pilihan ke opsi itu. Prioritas 2: kalau KETIGA opsi yang
    // ada sama-sama TIDAK mengandung Focus Keyword (kurang sinkron semua),
    // JANGAN memaksa memilih salah satu yang kurang tepat — buat SATU
    // opsi judul BARU (opsi ke-4) yang dijamin mengandung Focus Keyword,
    // lalu otomatis pilih opsi baru itu. Opsi lama tetap disimpan, hanya
    // ditambahkan opsi baru di akhir daftar.
    let updatedTitleOptions = metadata.titleOptions;
    let updatedTitleIdx = selectedTitleIdx;
    const currentSelectedTitle = metadata.titleOptions[selectedTitleIdx]?.title || '';

    if (!isSynced(currentSelectedTitle)) {
      const syncedIdx = metadata.titleOptions.findIndex((opt) => isSynced(opt.title));

      if (syncedIdx !== -1) {
        // Ada opsi existing yang sudah sinkron -> pakai itu, tidak perlu bikin baru.
        updatedTitleIdx = syncedIdx;
      } else {
        // Tidak ada satu pun opsi yang sinkron -> buat opsi baru (ke-4).
        const baseTitle =
          metadata.titleOptions[selectedTitleIdx]?.title ||
          metadata.titleOptions[0]?.title ||
          '';

        const kwTitleCase = kw
          .split(' ')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        const newTitleText = baseTitle ? `${kwTitleCase}: ${baseTitle}` : kwTitleCase;

        const newOption = {
          title: newTitleText,
          rationale: `Dibuat otomatis oleh "Selaraskan Otomatis" karena opsi judul yang tersedia belum mengandung Focus Keyword "${kw}" secara utuh.`,
        };

        updatedTitleOptions = [...metadata.titleOptions, newOption];
        updatedTitleIdx = updatedTitleOptions.length - 1;
      }
    }

    if (updatedTitleIdx !== selectedTitleIdx) {
      setSelectedTitleIdx(updatedTitleIdx);
    }

    onChange?.({
      ...metadata,
      metaTitle: updatedMetaTitle,
      metaDescription: updatedMetaDesc,
      slug: updatedSlug,
      titleOptions: updatedTitleOptions,
      recommendedTitleIndex: updatedTitleIdx,
    });
  };

  return (
    <div
      id="seo-publishing-metadata-panel"
      className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-5"
    >
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F1DDE2]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFE8EE] text-[#FE4C6F] flex items-center justify-center font-bold shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-[#1F1720]">
                SEO Publishing Metadata (CMS Ready)
              </h3>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">
                Referensi Editorial Interaktif
              </span>
            </div>
            <p className="text-[11px] text-[#6F6670] mt-0.5">
              Siap disalin ke kolom WordPress, Blogger, atau CMS saat publikasi artikel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!allSynced && (
            <button
              onClick={handleAutoAlign}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Selaraskan Judul H1, Slug, Meta Title & Meta Description dengan Focus Keyword secara otomatis"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Selaraskan Otomatis</span>
            </button>
          )}

          <button
            id="btn-copy-all-cms-metadata"
            onClick={copyAllAsCmsBlock}
            className="px-3 py-1.5 bg-[#FFF2F5] hover:bg-[#FFE4EC] text-[#FE4C6F] border border-[#FCD2DC] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            {copiedKey === 'all_cms' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Tersalin Semua!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Semua sebagai Blok CMS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Status Badge Bar */}
      <div className="bg-[#FAF8F9] p-3 rounded-xl border border-[#F1DDE2] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#1F1720] text-[11px]">
            Status Sinkronisasi Focus Keyword:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {syncChecks.map((chk, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-md font-medium text-[10px] flex items-center gap-1 border ${
                  chk.ok
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {chk.ok ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                )}
                <span>
                  {chk.label}: {chk.ok ? 'Sinkron' : 'Belum Memuat'}
                </span>
              </span>
            ))}
          </div>
        </div>

        {allSynced ? (
          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            100% Selaras
          </span>
        ) : (
          <span className="text-[10px] text-amber-700 font-medium">
            Edit atau klik "Selaraskan Otomatis" untuk skor SEO optimal
          </span>
        )}
      </div>

      {/* Grid Kolom Utama */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Kolom Kiri: Rekomendasi Judul H1 (Opsi & Rationale) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F1720]">
              <FileText className="w-3.5 h-3.5 text-[#FE4C6F]" />
              <span>Pilihan Judul H1 Artikel ({metadata.titleOptions.length} Variasi)</span>
            </div>
            <button
              onClick={() => copyToClipboard(selectedTitle, 'active_title')}
              className="text-[11px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer font-medium"
            >
              {copiedKey === 'active_title' ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>Salin Judul Terpilih</span>
            </button>
          </div>

          <div className="space-y-2">
            {metadata.titleOptions.map((opt, idx) => {
              const isSelected = selectedTitleIdx === idx;
              const isRecommended = idx === metadata.recommendedTitleIndex;
              const titleHasKw = isSynced(opt.title);

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectTitleIdx(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#FFF9FA] border-[#FE4C6F] shadow-2xs'
                      : 'bg-white border-[#F1DDE2] hover:border-[#D6B5BC]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="seoTitleOption"
                      checked={isSelected}
                      onChange={() => handleSelectTitleIdx(idx)}
                      className="mt-0.5 accent-[#FE4C6F] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-[#1F1720]' : 'text-[#4A404B]'
                          }`}
                        >
                          {opt.title}
                        </span>
                        {isRecommended && (
                          <span className="px-1.5 py-0.2 bg-[#FFE8EE] text-[#E83E60] font-bold text-[9px] rounded-sm">
                            Rekomendasi AI
                          </span>
                        )}
                        {!titleHasKw && (
                          <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] rounded-sm font-medium">
                            Kurang Focus Keyword
                          </span>
                        )}
                      </div>
                      {opt.rationale && (
                        <p className="text-[11px] text-[#6F6670] mt-1 leading-relaxed">
                          {opt.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan: Focus Keyword, Slug, Kategori, Tags, Secondary Keywords */}
        <div className="space-y-4">
          {/* Focus Keyword Target */}
          <div className="p-3 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1F1720]">
                <Target className="w-3.5 h-3.5 text-[#FE4C6F]" />
                <span>Focus Keyword (Sumber Kebenaran Tunggal)</span>
              </div>
              <button
                onClick={() => copyToClipboard(metadata.focusKeyword, 'focus_kw')}
                className="text-[10px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer font-medium"
              >
                {copiedKey === 'focus_kw' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Salin</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={metadata.focusKeyword}
                onChange={(e) => handleFocusKeywordChange(e.target.value)}
                placeholder="Masukkan focus keyword..."
                className="w-full bg-white border border-[#F1DDE2] focus:border-[#FE4C6F] focus:outline-hidden px-3 py-1.5 rounded-lg text-xs font-bold text-[#1F1720]"
              />
            </div>
            <p className="text-[10px] text-[#6F6670]">
              Acuan utama untuk Judul H1, Slug, Meta Title, dan Meta Description
            </p>
          </div>

          {/* Baris Slug & Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Slug */}
            <div className="p-3 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#1F1720]">
                  <Link2 className="w-3 h-3 text-[#FE4C6F]" />
                  <span>Slug URL</span>
                </div>
                <button
                  onClick={() => copyToClipboard(metadata.slug, 'slug')}
                  className="text-[10px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'slug' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Salin</span>
                </button>
              </div>
              <input
                type="text"
                value={metadata.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="w-full font-mono text-xs text-[#1F1720] bg-white px-2.5 py-1.5 rounded-lg border border-[#F1DDE2] focus:border-[#FE4C6F] focus:outline-hidden"
              />
              <p className="text-[10px] text-[#6F6670]">Sinkron dengan slug SILO Level 1</p>
            </div>

            {/* Kategori */}
            <div className="p-3 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#1F1720]">
                  <Layers className="w-3 h-3 text-[#FE4C6F]" />
                  <span>Kategori CMS</span>
                </div>
                <button
                  onClick={() => copyToClipboard(metadata.category, 'category')}
                  className="text-[10px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'category' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Salin</span>
                </button>
              </div>
              <input
                type="text"
                value={metadata.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full text-xs font-medium text-[#1F1720] bg-white px-2.5 py-1.5 rounded-lg border border-[#F1DDE2] focus:border-[#FE4C6F] focus:outline-hidden"
              />
              <p className="text-[10px] text-[#6F6670]">Diturunkan dari Topic Cluster</p>
            </div>
          </div>

          {/* Secondary Keywords */}
          {metadata.secondaryKeywords && metadata.secondaryKeywords.length > 0 && (
            <div className="p-3 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1F1720]">
                  Secondary Keywords (LSI Pendukung):
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(metadata.secondaryKeywords.join(', '), 'sec_kw')
                  }
                  className="text-[10px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedKey === 'sec_kw' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Salin Semua</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metadata.secondaryKeywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-white border border-[#F1DDE2] text-[11px] text-[#4A404B] rounded-md font-medium"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags CMS */}
          <div className="p-3 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#1F1720]">
                <Tag className="w-3 h-3 text-[#FE4C6F]" />
                <span>Tags CMS ({metadata.tags.length} Tags)</span>
              </div>
              <button
                onClick={() => copyToClipboard(metadata.tags.join(', '), 'tags')}
                className="text-[10px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer font-medium"
              >
                {copiedKey === 'tags' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Salin (Koma)</span>
              </button>
            </div>
            <input
              type="text"
              value={metadata.tags.join(', ')}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="Tag 1, Tag 2, Tag 3..."
              className="w-full text-xs text-[#1F1720] bg-white px-2.5 py-1.5 rounded-lg border border-[#F1DDE2] focus:border-[#FE4C6F] focus:outline-hidden"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {metadata.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-white border border-[#F1DDE2] text-[10px] text-[#1F1720] rounded-full flex items-center gap-1"
                >
                  <Hash className="w-2.5 h-2.5 text-[#FE4C6F]" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Baris Bawah: Meta Title & Meta Description dengan Character Counter & Input Editable */}
      <div className="pt-3 border-t border-[#F1DDE2] grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Meta Title */}
        <div className="p-3.5 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-bold text-[#1F1720]">
              <span>Meta Title (SERP Title Tag)</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                  metaTitleLen > 60
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-[#FFE8EE] text-[#E83E60]'
                }`}
                title="Acuan referensi SERP ~60 karakter. Boleh melebihi selama tetap nyaman dibaca dan sinkron dengan Focus Keyword."
              >
                {metaTitleLen} karakter (acuan: ~60)
              </span>
              <button
                onClick={() => copyToClipboard(metadata.metaTitle, 'meta_title')}
                className="text-[11px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'meta_title' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Salin</span>
              </button>
            </div>
          </div>
          <textarea
            rows={2}
            value={metadata.metaTitle}
            onChange={(e) => handleMetaTitleChange(e.target.value)}
            placeholder="Ketik Meta Title..."
            className="w-full text-xs text-[#1F1720] font-medium bg-white p-2.5 rounded-lg border border-[#F1DDE2] focus:border-[#FE4C6F] focus:outline-hidden leading-relaxed resize-none"
          />
          {!isSynced(metadata.metaTitle) && (
            <p className="text-[10px] text-amber-700 font-medium">
              ⚠️ Belum memuat frasa Focus Keyword "{metadata.focusKeyword}"
            </p>
          )}
        </div>

        {/* Meta Description */}
        <div className="p-3.5 bg-[#FAF8F9] border border-[#F1DDE2] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-bold text-[#1F1720]">
              <span>Meta Description (SERP Snippet)</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                  metaDescLen > 158
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-[#FFE8EE] text-[#E83E60]'
                }`}
                title="Acuan referensi SERP ~120-158 karakter. Boleh melebihi selama tetap nyaman dibaca dan sinkron dengan Focus Keyword."
              >
                {metaDescLen} karakter (acuan: ~158)
              </span>
              <button
                onClick={() => copyToClipboard(metadata.metaDescription, 'meta_desc')}
                className="text-[11px] text-[#6F6670] hover:text-[#FE4C6F] flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'meta_desc' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Salin</span>
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={metadata.metaDescription}
            onChange={(e) => handleMetaDescChange(e.target.value)}
            placeholder="Ketik Meta Description..."
            className="w-full text-xs text-[#1F1720] bg-white p-2.5 rounded-lg border border-[#F1DDE2] focus:border-[#FE4C6F] focus:outline-hidden leading-relaxed resize-none"
          />
          {!isSynced(metadata.metaDescription) && (
            <p className="text-[10px] text-amber-700 font-medium">
              ⚠️ Belum memuat frasa Focus Keyword "{metadata.focusKeyword}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
