import React, { useState } from 'react';
import {
  AddPagesFromKeywordsBatchResult,
  Level1Result,
  PageSiloItem,
} from '../types.ts';
import { slugify } from '../lib/slug-utils.ts';
import {
  Network,
  GitBranch,
  Link,
  AlertTriangle,
  ArrowRight,
  ListOrdered,
  CheckCircle2,
  PieChart,
  BookOpen,
  Pencil,
  Check,
  Target,
  Layers,
  Trash2,
  ListPlus,
  Sparkles,
  X,
  CheckCircle,
  XCircle,
  Info,
  CornerDownRight,
  ExternalLink,
} from 'lucide-react';
import { distributeOutboundLinks } from '../lib/outbound-links.ts';

interface Level1OutputPanelProps {
  level1Result: Level1Result | null;
  onSelectPageForLevel2: (page: PageSiloItem) => void;
  onUpdatePageSlug?: (pageId: string, newSlug: string) => void;
  onUpdatePageFocusKeyword?: (pageId: string, newFocusKeyword: string) => void;
  onGoToGenerate?: () => void;
  onDeletePage?: (pageId: string) => void;
  onAddPagesFromKeywords?: (keywords: string[]) => Promise<boolean>;
  addPagesLoading?: boolean;
  lastAddPagesBatchResult?: AddPagesFromKeywordsBatchResult | null;
  onDismissAddPagesBatchResult?: () => void;
}

export const Level1OutputPanel: React.FC<Level1OutputPanelProps> = ({
  level1Result,
  onSelectPageForLevel2,
  onUpdatePageSlug,
  onUpdatePageFocusKeyword,
  onGoToGenerate,
  onDeletePage,
  onAddPagesFromKeywords,
  addPagesLoading,
  lastAddPagesBatchResult,
  onDismissAddPagesBatchResult,
}) => {
  const [editingSlugPageId, setEditingSlugPageId] = useState<string | null>(null);
  const [tempSlugValue, setTempSlugValue] = useState<string>('');

  const handleStartEditSlug = (page: PageSiloItem) => {
    setEditingSlugPageId(page.pageId);
    setTempSlugValue(page.suggestedSlug);
  };

  const handleSaveEditSlug = (pageId: string) => {
    if (tempSlugValue.trim() && onUpdatePageSlug) {
      const cleaned = slugify(tempSlugValue);
      onUpdatePageSlug(pageId, cleaned);
    }
    setEditingSlugPageId(null);
  };

  const [editingFocusKeywordPageId, setEditingFocusKeywordPageId] = useState<string | null>(null);
  const [tempFocusKeywordValue, setTempFocusKeywordValue] = useState<string>('');

  const handleStartEditFocusKeyword = (page: PageSiloItem) => {
    setEditingFocusKeywordPageId(page.pageId);
    setTempFocusKeywordValue(page.suggestedFocusKeyword || page.primaryEntity || page.title);
  };

  const handleSaveEditFocusKeyword = (pageId: string) => {
    if (tempFocusKeywordValue.trim() && onUpdatePageFocusKeyword) {
      onUpdatePageFocusKeyword(pageId, tempFocusKeywordValue.trim());
    }
    setEditingFocusKeywordPageId(null);
  };

  // State konfirmasi hapus 2-klik (3 detik auto-reset)
  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);

  const handleDeleteClick = (pageId: string) => {
    if (!onDeletePage) return;
    if (confirmDeletePageId === pageId) {
      onDeletePage(pageId);
      setConfirmDeletePageId(null);
      return;
    }
    setConfirmDeletePageId(pageId);
    setTimeout(() => {
      setConfirmDeletePageId((current) => (current === pageId ? null : current));
    }, 3000);
  };

  // State Input List Kata Kunci
  const [keywordListInput, setKeywordListInput] = useState('');

  const parsedKeywords = keywordListInput
    .split('\n')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  const keywordCount = parsedKeywords.length;
  const isOverKeywordLimit = keywordCount > 5;

  const handleProcessKeywords = async () => {
    if (!onAddPagesFromKeywords || keywordCount === 0 || isOverKeywordLimit) return;
    const success = await onAddPagesFromKeywords(parsedKeywords);
    // Hanya kosongkan textarea bila request BENAR-BENAR sukses
    if (success) {
      setKeywordListInput('');
    }
  };

  const [activeTab, setActiveTab] = useState<
    'silo' | 'knowledge' | 'clusters' | 'links' | 'gaps' | 'roadmap' | 'references'
  >('silo');

  // Empty state: tampil saat menu "Hasil" dibuka tapi belum pernah generate Level 1.
  if (!level1Result) {
    return (
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-10 text-center space-y-3 shadow-xs">
        <p className="text-sm text-[#6F6670]">
          Belum ada hasil Level 1 Architecture. Silakan generate terlebih dahulu di menu Generate.
        </p>
        {onGoToGenerate && (
          <button
            onClick={onGoToGenerate}
            className="px-4 py-2 bg-[#FE4C6F] hover:bg-[#E83E60] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Ke Menu Generate
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warnings Banner if any */}
      {level1Result.warnings && level1Result.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Peringatan Evaluasi Struktur Arsitektur</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1">
            {level1Result.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary & Metrics Banner */}
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs">
        <div className="pb-4 border-b border-[#F1DDE2] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#FFE8EE] text-[#E83E60] font-bold text-xs rounded-full">
                Topik: {level1Result.topic}
              </span>
              <span className="text-xs text-[#6F6670]">
                {level1Result.siloPages.length} Halaman SILO • {level1Result.clusters.length} Topic Clusters
              </span>
              {level1Result.authorExpertise && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> E-E-A-T Terintegrasi
                </span>
              )}
              {level1Result.manualSiloStructure && (
                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Struktur dari Riset Sendiri
                </span>
              )}
            </div>

            {/* Estimasi Kelengkapan Arsitektur */}
            <div className="flex items-center gap-2 px-3 py-1 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl text-xs">
              <PieChart className="w-3.5 h-3.5 text-[#FE4C6F]" />
              <span className="text-[#6F6670]">Estimasi Kelengkapan:</span>
              <span className="font-bold text-[#1F1720]">
                {level1Result.architectureCoverageScore || 85}/100
              </span>
              <span
                className="text-[10px] text-[#6F6670]"
                title="Skor ini adalah perkiraan AI berdasarkan topik yang Anda berikan, bukan hasil analisis kompetitor nyata."
              >
                (Perkiraan AI)
              </span>
            </div>
          </div>
          <h3 className="font-bold text-base text-[#1F1720] pt-1">Ringkasan Strategi Konten</h3>
          <p className="text-xs text-[#6F6670] leading-relaxed">{level1Result.summary}</p>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('silo')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
              activeTab === 'silo'
                ? 'bg-[#FE4C6F] text-white'
                : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>SILO Architecture ({level1Result.siloPages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
              activeTab === 'knowledge'
                ? 'bg-[#FE4C6F] text-white'
                : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Knowledge Architecture ({level1Result.knowledgeArchitecture.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('clusters')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
              activeTab === 'clusters'
                ? 'bg-[#FE4C6F] text-white'
                : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Topic Clusters ({level1Result.clusters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('links')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
              activeTab === 'links'
                ? 'bg-[#FE4C6F] text-white'
                : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
            }`}
          >
            <Link className="w-4 h-4" />
            <span>Internal Links ({level1Result.internalLinks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('gaps')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
              activeTab === 'gaps'
                ? 'bg-[#FE4C6F] text-white'
                : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Architecture Gaps ({level1Result.gaps.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-[#FE4C6F] text-white'
                : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Content Roadmap ({level1Result.roadmap.length})</span>
          </button>

          {level1Result.referenceMaterials && level1Result.referenceMaterials.length > 0 && (
            <button
              onClick={() => setActiveTab('references')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors flex-shrink-0 cursor-pointer ${
                activeTab === 'references'
                  ? 'bg-[#FE4C6F] text-white'
                  : 'bg-[#FFF9FA] text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Bank Referensi ({level1Result.referenceMaterials.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: SILO Architecture View */}
      {activeTab === 'silo' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-sm text-[#1F1720]">Daftar Halaman SILO & Hierarchy</h4>
                <p className="text-xs text-[#6F6670] mt-0.5">
                  Pilih salah satu halaman untuk melanjutkan ke **Level 2 Page Architecture & Deep Blueprint**.
                </p>
              </div>
            </div>

            {/* Input List Kata Kunci */}
            {onAddPagesFromKeywords && (
              <div className="mb-5 p-4 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl space-y-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#1F1720]">
                  <ListPlus className="w-3.5 h-3.5 text-[#FE4C6F]" />
                  Tambah Rancangan Halaman dari List Kata Kunci
                </label>
                <p className="text-[11px] text-[#6F6670] leading-relaxed">
                  Satu kata kunci per baris (maksimal 5 kata kunci). Setiap kata kunci akan dipelajari relevansinya terhadap topik utama dan dicek anti-kanibalisasi terhadap halaman eksisting. Kata kunci yang di luar topik atau tumpang tindih akan otomatis ditolak dengan alasan spesifik — tidak dipaksakan menjadi halaman baru.
                </p>
                <textarea
                  rows={3}
                  value={keywordListInput}
                  onChange={(e) => setKeywordListInput(e.target.value)}
                  placeholder={'Contoh:\nharga kayu fjl per meter\ncara merawat kayu fjl\nkayu fjl vs kayu solid'}
                  disabled={addPagesLoading}
                  className="w-full px-3 py-2 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] focus:ring-1 focus:ring-[#FE4C6F] text-[#1F1720] leading-relaxed resize-none disabled:opacity-60 font-mono"
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`text-[11px] font-semibold ${
                      isOverKeywordLimit ? 'text-rose-600' : 'text-[#6F6670]'
                    }`}
                  >
                    {keywordCount}/5 kata kunci
                    {isOverKeywordLimit ? ' — kurangi jumlah baris terlebih dahulu' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleProcessKeywords}
                    disabled={addPagesLoading || keywordCount === 0 || isOverKeywordLimit}
                    className="px-4 py-2 bg-[#FE4C6F] hover:bg-[#E83E60] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {addPagesLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Mengevaluasi & Memproses Kata Kunci...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Proses Kata Kunci</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Panel Khusus Hasil Evaluasi Batch Kata Kunci Terakhir */}
            {lastAddPagesBatchResult && (
              <div className="mb-6 bg-white border border-[#F1DDE2] rounded-2xl p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#F1DDE2] pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-[#1F1720]">Hasil Evaluasi Batch Kata Kunci:</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-md flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {lastAddPagesBatchResult.newPages.length} Diterima
                    </span>
                    {lastAddPagesBatchResult.rejectedKeywords.length > 0 && (
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-md flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {lastAddPagesBatchResult.rejectedKeywords.length} Ditolak
                      </span>
                    )}
                  </div>
                  {onDismissAddPagesBatchResult && (
                    <button
                      onClick={onDismissAddPagesBatchResult}
                      className="text-gray-400 hover:text-[#1F1720] p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      title="Tutup ringkasan batch ini"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {/* List Halaman Diterima */}
                  {lastAddPagesBatchResult.newPages.map((page) => (
                    <div
                      key={page.pageId}
                      className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded-md">
                            DITERIMA
                          </span>
                          <span className="font-semibold text-[#1F1720]">
                            Kata Kunci: "{page.sourceKeyword || page.title}"
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#6F6670]">/{page.suggestedSlug}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#6F6670] pl-1">
                        <CornerDownRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Rancangan:</strong> "{page.title}" • <strong>Role:</strong> {page.pageRole} • <strong>Cluster:</strong> {page.cluster}
                        </span>
                      </div>

                      {page.isNewCluster && page.clusterFitReason && (
                        <div className="text-[10px] text-emerald-800 bg-emerald-100/60 p-1.5 rounded-md">
                          <strong>Usulan Cluster Baru:</strong> {page.clusterFitReason}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* List Kata Kunci Ditolak */}
                  {lastAddPagesBatchResult.rejectedKeywords.map((rej, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded-md">
                            DITOLAK ({rej.reasonCode})
                          </span>
                          <span className="font-semibold text-rose-900">
                            Kata Kunci: "{rej.keyword}"
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-[11px] text-rose-800/90 pl-1">
                        <Info className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Alasan:</strong> {rej.reason}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ringkasan Distribusi Outbound Link (jika ada outbound link di Level 1) */}
            {level1Result.outboundLinks && level1Result.outboundLinks.length > 0 && (() => {
              const supportingPages = level1Result.siloPages.filter((p) => p.pageRole !== 'Pillar');
              const linkDistribution = distributeOutboundLinks(
                level1Result.outboundLinks,
                supportingPages.map((p) => p.pageId)
              );

              return (
                <div className="mb-5 p-4 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-[#FE4C6F]" />
                      <h5 className="font-bold text-xs text-[#1F1720]">
                        Distribusi Outbound Link ({level1Result.outboundLinks.length} URL ke {supportingPages.length} Artikel Pendukung)
                      </h5>
                    </div>
                    <span className="text-[10px] text-[#6F6670] bg-white px-2 py-0.5 rounded-md border border-[#F1DDE2]">
                      Round-Robin • 1x per link
                    </span>
                  </div>

                  {supportingPages.length === 0 ? (
                    <p className="text-xs text-amber-700">
                      Belum ada artikel pendukung untuk menerima outbound link.
                    </p>
                  ) : (
                    <>
                      {level1Result.outboundLinks.length < supportingPages.length && (
                        <p className="text-[11px] text-[#6F6670]">
                          Sebagian artikel pendukung tidak mendapat outbound link. Setiap link hanya dipakai satu kali.
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {supportingPages.map((sp) => {
                          const count = linkDistribution[sp.pageId]?.length || 0;
                          return (
                            <div
                              key={sp.pageId}
                              className="p-2.5 bg-white border border-[#F1DDE2] rounded-lg flex items-center justify-between gap-2"
                            >
                              <span className="truncate text-[#1F1720] font-medium" title={sp.title}>
                                {sp.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  count > 0
                                    ? 'bg-[#FFE8EE] text-[#FE4C6F]'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {count} link
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {(() => {
              const supportingPages = level1Result.siloPages.filter((p) => p.pageRole !== 'Pillar');
              const cardLinkDistribution =
                level1Result.outboundLinks && level1Result.outboundLinks.length > 0
                  ? distributeOutboundLinks(
                      level1Result.outboundLinks,
                      supportingPages.map((p) => p.pageId)
                    )
                  : {};

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {level1Result.siloPages.map((page) => {
                    const isPillar = page.pageRole === 'Pillar';
                    const pageOutbound = cardLinkDistribution[page.pageId] || [];
                    return (
                  <div
                    key={page.pageId}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isPillar
                        ? 'bg-[#FFF9FA] border-[#FE4C6F] shadow-xs'
                        : 'bg-white border-[#F1DDE2] hover:border-[#FE4C6F]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                            isPillar ? 'bg-[#FE4C6F] text-white' : 'bg-[#FFE8EE] text-[#E83E60]'
                          }`}
                        >
                          Role: {page.pageRole}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Editable Slug Component */}
                          {editingSlugPageId === page.pageId ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-[#6F6670] font-mono">/</span>
                              <input
                                type="text"
                                autoFocus
                                value={tempSlugValue}
                                onChange={(e) => setTempSlugValue(e.target.value)}
                                onBlur={() => handleSaveEditSlug(page.pageId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditSlug(page.pageId);
                                  if (e.key === 'Escape') setEditingSlugPageId(null);
                                }}
                                className="px-1.5 py-0.5 bg-white border border-[#FE4C6F] rounded-md text-[10px] font-mono text-[#1F1720] focus:outline-hidden w-28"
                              />
                              <button
                                type="button"
                                onMouseDown={() => handleSaveEditSlug(page.pageId)}
                                className="text-emerald-600 hover:text-emerald-700 p-0.5 cursor-pointer"
                                title="Simpan slug"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleStartEditSlug(page)}
                              className="group flex items-center gap-1 cursor-pointer hover:text-[#FE4C6F] text-[10px] text-[#6F6670] font-mono px-1 py-0.5 rounded-md hover:bg-[#FFE8EE]/60 transition-colors"
                              title="Klik untuk mengedit slug URL manual"
                            >
                              <span>/{page.suggestedSlug}</span>
                              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-[#FE4C6F] transition-opacity" />
                            </div>
                          )}

                          {/* Tombol Hapus */}
                          {onDeletePage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(page.pageId)}
                              title={
                                confirmDeletePageId === page.pageId
                                  ? 'Klik sekali lagi untuk konfirmasi hapus'
                                  : 'Hapus rancangan halaman ini'
                              }
                              className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                                confirmDeletePageId === page.pageId
                                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                                  : 'text-gray-300 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h5 className="font-bold text-sm text-[#1F1720] leading-snug">{page.title}</h5>

                      {/* Editable Focus Keyword Component */}
                      <div className="flex items-center gap-1.5 text-xs text-[#6F6670] bg-[#FAF8F9] p-1.5 rounded-lg border border-[#F1DDE2]/60">
                        <Target className="w-3.5 h-3.5 text-[#FE4C6F] shrink-0" />
                        <span className="font-semibold text-[#1F1720] text-[11px] shrink-0">Focus Keyword:</span>
                        {editingFocusKeywordPageId === page.pageId ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input
                              type="text"
                              autoFocus
                              value={tempFocusKeywordValue}
                              onChange={(e) => setTempFocusKeywordValue(e.target.value)}
                              onBlur={() => handleSaveEditFocusKeyword(page.pageId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditFocusKeyword(page.pageId);
                                if (e.key === 'Escape') setEditingFocusKeywordPageId(null);
                              }}
                              className="px-2 py-0.5 bg-white border border-[#FE4C6F] rounded-md text-[11px] font-medium text-[#1F1720] focus:outline-hidden w-full"
                            />
                            <button
                              type="button"
                              onMouseDown={() => handleSaveEditFocusKeyword(page.pageId)}
                              className="text-emerald-600 hover:text-emerald-700 p-0.5 cursor-pointer shrink-0"
                              title="Simpan focus keyword"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditFocusKeyword(page)}
                            className="group flex items-center gap-1.5 cursor-pointer hover:text-[#FE4C6F] px-1.5 py-0.5 rounded-md hover:bg-[#FFE8EE]/60 transition-colors font-medium text-[#1F1720] text-[11px] truncate flex-1"
                            title="Klik untuk mengedit Focus Keyword target halaman ini"
                          >
                            <span className="truncate">
                              {page.suggestedFocusKeyword || page.primaryEntity || page.title}
                            </span>
                            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-[#FE4C6F] transition-opacity shrink-0" />
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-[#6F6670] line-clamp-2">{page.rationale}</p>

                      {page.scopeSummary && (
                        <div className="p-2 bg-[#FFF9FA] border border-[#F1DDE2] rounded-lg text-[11px] text-[#6F6670] leading-relaxed">
                          <span className="font-semibold text-[#1F1720] block mb-0.5">
                            Cakupan Anti-Kanibalisasi:
                          </span>
                          {page.scopeSummary}
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#F1DDE2]/60 text-[11px] space-y-1 text-[#6F6670]">
                        <div>
                          <strong>Cluster:</strong> {page.cluster}
                        </div>
                        <div>
                          <strong>Intent:</strong> {page.intent}
                        </div>
                        <div>
                          <strong>Primary Entity:</strong> {page.primaryEntity}
                        </div>
                      </div>

                      {/* Outbound Link Info on Card */}
                      {level1Result.outboundLinks && level1Result.outboundLinks.length > 0 && (
                        <div className="pt-2 border-t border-[#F1DDE2]/60 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#1F1720] flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 text-[#FE4C6F]" />
                              Outbound Link:
                            </span>
                            {isPillar ? (
                              <span className="text-[10px] text-gray-400 italic">0 link (Pilar)</span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                                  pageOutbound.length > 0
                                    ? 'bg-[#FFE8EE] text-[#FE4C6F]'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {pageOutbound.length} link
                              </span>
                            )}
                          </div>
                          {!isPillar && pageOutbound.length > 0 && (
                            <div className="space-y-1 pt-0.5 max-h-16 overflow-y-auto">
                              {pageOutbound.map((url, uIdx) => (
                                <div
                                  key={uIdx}
                                  className="text-[10px] font-mono text-[#6F6670] truncate flex items-center gap-1"
                                  title={url}
                                >
                                  <span className="text-[#FE4C6F] shrink-0">•</span>
                                  <span className="truncate">{url}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onSelectPageForLevel2(page)}
                      className="mt-4 w-full py-2 bg-[#FE4C6F] hover:bg-[#E83E60] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Build Level 2 Architecture</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
          </div>
        </div>
      )}

      {/* TAB 2: Knowledge Architecture Tree View */}
      {activeTab === 'knowledge' && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-[#1F1720]">Hierarki Pengetahuan (Taxonomy Decomposition)</h4>
          <p className="text-xs text-[#6F6670]">
            Dekomposisi struktur konsep dan domain pengetahuan topik ini.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {level1Result.knowledgeArchitecture.map((node) => (
              <div
                key={node.id}
                className="p-3.5 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#FE4C6F]">{node.type}</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      node.importance === 'HIGH'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {node.importance}
                  </span>
                </div>
                <h5 className="font-bold text-[#1F1720] text-sm">{node.name}</h5>
                <p className="text-[#6F6670] leading-snug">{node.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Topic Clusters View */}
      {activeTab === 'clusters' && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-[#1F1720]">Pengelompokan Topic Clusters</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {level1Result.clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="p-4 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F1720] text-sm">{cluster.name}</span>
                  <span className="px-2 py-0.5 bg-[#FFE8EE] text-[#E83E60] font-bold text-[10px] rounded-md">
                    Prioritas: {cluster.priority}
                  </span>
                </div>
                <p className="text-[#6F6670]">{cluster.purpose}</p>
                <div className="pt-2 border-t border-[#F1DDE2]/60 space-y-1 text-[#6F6670]">
                  <div>
                    <strong>Search Intents:</strong> {cluster.searchIntentCoverage.join(', ')}
                  </div>
                  <div>
                    <strong>Halaman Kandidat:</strong> {cluster.candidatePages.join('; ')}
                  </div>
                  <div>
                    <strong>Entitas Relevan:</strong> {cluster.relevantEntities.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Internal Links Matrix */}
      {activeTab === 'links' && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-[#1F1720]">
            Rekomendasi Tautan Internal & Anchor Text Alami
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#FFF9FA] text-[#1F1720] border-b border-[#F1DDE2]">
                  <th className="p-3 font-bold">Sumber Halaman</th>
                  <th className="p-3 font-bold">Target Halaman</th>
                  <th className="p-3 font-bold">Jangkar Teks (Anchor)</th>
                  <th className="p-3 font-bold">Tujuan Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1DDE2]">
                {level1Result.internalLinks.map((link, idx) => (
                  <tr key={idx} className="hover:bg-[#FFF9FA]">
                    <td className="p-3 font-medium text-[#1F1720]">{link.sourcePageId}</td>
                    <td className="p-3 font-medium text-[#FE4C6F]">{link.targetPageId}</td>
                    <td className="p-3 font-mono bg-[#FFF9FA] text-[#1F1720]">
                      "{link.suggestedAnchor}"
                    </td>
                    <td className="p-3 text-[#6F6670]">{link.linkPurpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Architecture Gaps Analysis */}
      {activeTab === 'gaps' && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-[#1F1720]">
            Analisis Area Celah Pengetahuan (Architecture Gaps)
          </h4>

          <div className="space-y-3">
            {level1Result.gaps.map((gap, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl flex items-start gap-3 text-xs"
              >
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1F1720] text-sm">{gap.topicArea}</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md">
                      Urgency: {gap.urgency}
                    </span>
                  </div>
                  <p className="text-[#6F6670]">{gap.description}</p>
                  {gap.suggestedPageRole && (
                    <div className="text-[11px] text-[#FE4C6F] font-semibold pt-1">
                      Saran Page Role: {gap.suggestedPageRole}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Content Roadmap */}
      {activeTab === 'roadmap' && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-[#1F1720]">Urutan Publikasi Konten (Roadmap)</h4>

          <div className="space-y-3">
            {level1Result.roadmap.map((step) => (
              <div
                key={step.step}
                className="p-3.5 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl flex items-center justify-between text-xs gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FE4C6F] text-white font-bold flex items-center justify-center flex-shrink-0">
                    {step.step}
                  </div>
                  <div>
                    <h5 className="font-bold text-[#1F1720] text-sm">{step.pageTitle}</h5>
                    <p className="text-[#6F6670]">{step.rationale}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#FFE8EE] text-[#E83E60] font-bold text-[11px] rounded-lg flex-shrink-0">
                  {step.pageRole}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: Bank Referensi */}
      {activeTab === 'references' && level1Result.referenceMaterials && (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-[#1F1720]">
                Bank Referensi & Fakta Resmi yang Diekstrak
              </h4>
              <p className="text-xs text-[#6F6670] mt-0.5">
                Fakta ini diekstrak otomatis oleh AI dari teks referensi yang Anda masukkan, dan akan digunakan untuk merekomendasikan bukti & fakta pada setiap halaman Level 2.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-[#FFE8EE] text-[#FE4C6F] font-bold text-xs rounded-xl">
              {level1Result.referenceMaterials.length} Fakta Diekstrak
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {level1Result.referenceMaterials.map((snippet) => (
              <div
                key={snippet.id}
                className="p-4 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-[#1F1720]">{snippet.title}</span>
                  {snippet.category && (
                    <span className="px-2 py-0.5 bg-[#FFE8EE] text-[#FE4C6F] font-bold text-[10px] rounded-md flex-shrink-0">
                      {snippet.category}
                    </span>
                  )}
                </div>
                <p className="text-[#6F6670] leading-relaxed whitespace-pre-wrap">
                  {snippet.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
