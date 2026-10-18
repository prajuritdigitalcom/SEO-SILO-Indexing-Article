import React, { useState, useEffect } from 'react';
import {
  Level2CheckboxState,
  Level2Result,
  ReferenceSnippet,
  SectionRequirement,
  SeoMetadata,
} from '../types.js';
import {
  Sparkles,
  CheckSquare,
  Square,
  HelpCircle,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Eye,
  BookmarkCheck,
  Info,
  BookOpen,
  CheckCircle2,
  Link,
} from 'lucide-react';
import { SeoMetadataPanel } from './SeoMetadataPanel';

interface Level2WorkspaceProps {
  level2Data: Level2Result | null;
  loading: boolean;
  onBackToLevel1: () => void;
  onGeneratePrompt: (checkboxes: Level2CheckboxState) => void;
  promptLoading: boolean;
  allReferenceSnippets?: ReferenceSnippet[];
  onUpdateSeoMetadata?: (updatedSeo: SeoMetadata) => void;
}

export const Level2Workspace: React.FC<Level2WorkspaceProps> = ({
  level2Data,
  loading,
  onBackToLevel1,
  onGeneratePrompt,
  promptLoading,
  allReferenceSnippets = [],
  onUpdateSeoMetadata,
}) => {
  const [checkboxes, setCheckboxes] = useState<Level2CheckboxState>({
    searchIntent: true,
    userGoal: true,
    primaryEntity: true,
    supportingEntities: true,
    questions: true,
    conceptsToUnderstand: true,
    includedScope: true,
    excludedScope: true,
    evidenceRequirements: true,
    internalLinks: true,
    qualityGuidance: true,
    searchEngineFirstWarnings: true,
    referenceMaterials: true,
    selectedSectionIds: {},
    selectedReferenceSnippetIds: {},
  });

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (level2Data && level2Data.sections) {
      const initialSections: Record<string, boolean> = {};
      level2Data.sections.forEach((sec) => {
        initialSections[sec.sectionId] = true;
      });

      const initialSnippets: Record<string, boolean> = {};
      if (level2Data.recommendedReferenceUsage) {
        level2Data.recommendedReferenceUsage.forEach((u) => {
          initialSnippets[u.snippetId] = true;
        });
      }

      setCheckboxes((prev) => ({
        ...prev,
        selectedSectionIds: initialSections,
        selectedReferenceSnippetIds: initialSnippets,
        referenceMaterials: true,
      }));
      if (level2Data.sections.length > 0) {
        setActiveSectionId(level2Data.sections[0].sectionId);
      }
    }
  }, [level2Data]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-12 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-[#FFE8EE] text-[#FE4C6F] rounded-2xl flex items-center justify-center mx-auto animate-pulse">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-base text-[#1F1720]">
            Membangun Page Architecture & Article Blueprint (Level 2)...
          </h3>
          <p className="text-xs text-[#6F6670] mt-1">
            Mengurai intent, entitas pendukung, pertanyaan wajib, batasan cannibalization, rekomendasi referensi resmi, dan struktur artikel detail.
          </p>
        </div>
      </div>
    );
  }

  if (!level2Data) {
    return (
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-8 text-center space-y-4 shadow-xs">
        <p className="text-sm text-[#6F6670]">
          Belum ada halaman yang dipilih dari Level 1.
        </p>
        <button
          onClick={onBackToLevel1}
          className="px-4 py-2 bg-[#FE4C6F] hover:bg-[#E83E60] text-white text-xs font-bold rounded-xl transition-colors"
        >
          Kembali ke Level 1
        </button>
      </div>
    );
  }

  // Calculate selected counts
  const sectionKeys = Object.keys(checkboxes.selectedSectionIds);
  const selectedSectionsCount = sectionKeys.filter((k) => checkboxes.selectedSectionIds[k]).length;

  const recommendedList = level2Data.recommendedReferenceUsage || [];
  const selectedSnippetsCount = recommendedList.filter(
    (u) => checkboxes.selectedReferenceSnippetIds?.[u.snippetId] !== false
  ).length;

  let baseSelectedCount = 0;
  if (checkboxes.searchIntent) baseSelectedCount++;
  if (checkboxes.userGoal) baseSelectedCount++;
  if (checkboxes.primaryEntity) baseSelectedCount++;
  if (checkboxes.supportingEntities) baseSelectedCount++;
  if (checkboxes.questions) baseSelectedCount++;
  if (checkboxes.conceptsToUnderstand) baseSelectedCount++;
  if (checkboxes.includedScope) baseSelectedCount++;
  if (checkboxes.excludedScope) baseSelectedCount++;
  if (checkboxes.evidenceRequirements) baseSelectedCount++;
  if (checkboxes.internalLinks) baseSelectedCount++;
  if (checkboxes.qualityGuidance) baseSelectedCount++;
  if (checkboxes.referenceMaterials && selectedSnippetsCount > 0) baseSelectedCount++;

  const totalSelected = baseSelectedCount + selectedSectionsCount;

  const handleSelectAll = () => {
    const allSecs: Record<string, boolean> = {};
    level2Data.sections.forEach((sec) => {
      allSecs[sec.sectionId] = true;
    });
    const allSnips: Record<string, boolean> = {};
    recommendedList.forEach((u) => {
      allSnips[u.snippetId] = true;
    });

    setCheckboxes({
      searchIntent: true,
      userGoal: true,
      primaryEntity: true,
      supportingEntities: true,
      questions: true,
      conceptsToUnderstand: true,
      includedScope: true,
      excludedScope: true,
      evidenceRequirements: true,
      internalLinks: true,
      qualityGuidance: true,
      referenceMaterials: true,
      selectedSectionIds: allSecs,
      selectedReferenceSnippetIds: allSnips,
    });
  };

  const handleClearAll = () => {
    const allSecs: Record<string, boolean> = {};
    level2Data.sections.forEach((sec) => {
      allSecs[sec.sectionId] = false;
    });
    const allSnips: Record<string, boolean> = {};
    recommendedList.forEach((u) => {
      allSnips[u.snippetId] = false;
    });

    setCheckboxes({
      searchIntent: false,
      userGoal: false,
      primaryEntity: false,
      supportingEntities: false,
      questions: false,
      conceptsToUnderstand: false,
      includedScope: false,
      excludedScope: false,
      evidenceRequirements: false,
      internalLinks: false,
      qualityGuidance: false,
      referenceMaterials: false,
      selectedSectionIds: allSecs,
      selectedReferenceSnippetIds: allSnips,
    });
  };

  const toggleSection = (id: string) => {
    setCheckboxes((prev) => ({
      ...prev,
      selectedSectionIds: {
        ...prev.selectedSectionIds,
        [id]: !prev.selectedSectionIds[id],
      },
    }));
  };

  const toggleSnippet = (snippetId: string) => {
    setCheckboxes((prev) => ({
      ...prev,
      selectedReferenceSnippetIds: {
        ...prev.selectedReferenceSnippetIds,
        [snippetId]: prev.selectedReferenceSnippetIds?.[snippetId] === false ? true : false,
      },
    }));
  };

  const activeSection = level2Data.sections.find((s) => s.sectionId === activeSectionId);

  // Map snippet details from allReferenceSnippets
  const getSnippetDetail = (snippetId: string): ReferenceSnippet | undefined => {
    return allReferenceSnippets.find((s) => s.id === snippetId);
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#6F6670] overflow-x-auto">
        <button
          onClick={onBackToLevel1}
          className="hover:text-[#FE4C6F] font-medium flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Level 1</span>
        </button>
        <ChevronRight className="w-3 h-3" />
        <span>{level2Data.topic}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="font-bold text-[#1F1720]">{level2Data.selectedPageTitle}</span>
      </div>

      {/* Warnings Banner if any */}
      {level2Data.warnings && level2Data.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Peringatan Evaluasi Struktur Artikel</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1">
            {level2Data.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Bar Header */}
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#FFE8EE] text-[#E83E60] font-bold text-xs rounded-full">
              {level2Data.selectedPageRole} Page
            </span>
            <span className="text-xs text-[#6F6670]">
              Intent: {level2Data.searchIntent}
            </span>
            {level2Data.authorExpertise && (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> E-E-A-T Aktif
              </span>
            )}
          </div>
          <h2 className="font-bold text-lg text-[#1F1720] mt-1">
            {level2Data.selectedPageTitle}
          </h2>
          <p className="text-xs text-[#6F6670] mt-0.5">
            Pilih komponen penelitian di bawah untuk dirangkai menjadi AI Production Prompt.
          </p>
        </div>

        {/* Global Controls & CTA */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 bg-[#FFF9FA] hover:bg-[#FFE8EE] border border-[#F1DDE2] text-[#1F1720] rounded-lg font-medium transition-colors"
            >
              Pilih Semua
            </button>
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1.5 bg-[#FFF9FA] hover:bg-gray-100 border border-[#F1DDE2] text-[#6F6670] rounded-lg font-medium transition-colors"
            >
              Hapus Semua
            </button>
          </div>

          <button
            onClick={() => onGeneratePrompt(checkboxes)}
            disabled={totalSelected === 0 || promptLoading}
            className="px-5 py-2.5 bg-[#FE4C6F] hover:bg-[#E83E60] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Proses Menjadi Prompt ({totalSelected})</span>
          </button>
        </div>
      </div>

      {/* SEO Publishing Metadata Panel (CMS Ready) */}
      {level2Data.seoMetadata && (
        <SeoMetadataPanel
          metadata={level2Data.seoMetadata}
          pageRole={level2Data.selectedPageRole}
          onChange={onUpdateSeoMetadata}
        />
      )}

      {/* Main Workspace: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 Cols): Checkbox Tree & Components */}
        <div className="lg:col-span-7 space-y-4">
          {/* Section 1: Overview & Scope */}
          <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#1F1720] border-b border-[#F1DDE2] pb-2">
              1. Maksud, Tujuan & Entitas Kunci
            </h3>

            <div className="space-y-3 text-xs">
              {/* Search Intent */}
              <label className="flex items-start gap-3 p-2.5 bg-[#FFF9FA] hover:bg-[#FFE8EE]/50 rounded-xl cursor-pointer transition-colors border border-[#F1DDE2]/60">
                <input
                  type="checkbox"
                  checked={checkboxes.searchIntent}
                  onChange={(e) => setCheckboxes({ ...checkboxes, searchIntent: e.target.checked })}
                  className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                />
                <div className="flex-1">
                  <span className="font-bold text-[#1F1720]">Search Intent: {level2Data.searchIntent}</span>
                  <p className="text-[#6F6670] mt-0.5">Informasi spesifik yang dicari pengguna.</p>
                </div>
              </label>

              {/* User Goal */}
              <label className="flex items-start gap-3 p-2.5 bg-[#FFF9FA] hover:bg-[#FFE8EE]/50 rounded-xl cursor-pointer transition-colors border border-[#F1DDE2]/60">
                <input
                  type="checkbox"
                  checked={checkboxes.userGoal}
                  onChange={(e) => setCheckboxes({ ...checkboxes, userGoal: e.target.checked })}
                  className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                />
                <div className="flex-1">
                  <span className="font-bold text-[#1F1720]">Tujuan Pembaca (User Goal)</span>
                  <p className="text-[#6F6670] mt-0.5">{level2Data.userGoal}</p>
                </div>
              </label>

              {/* Main & Supporting Entities */}
              <label className="flex items-start gap-3 p-2.5 bg-[#FFF9FA] hover:bg-[#FFE8EE]/50 rounded-xl cursor-pointer transition-colors border border-[#F1DDE2]/60">
                <input
                  type="checkbox"
                  checked={checkboxes.primaryEntity}
                  onChange={(e) => setCheckboxes({ ...checkboxes, primaryEntity: e.target.checked })}
                  className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                />
                <div className="flex-1">
                  <span className="font-bold text-[#1F1720]">Entitas Utama & Pendukung</span>
                  <p className="text-[#6F6670] mt-0.5">
                    <strong>Utama:</strong> {level2Data.primaryEntity} | <strong>Pendukung:</strong> {level2Data.supportingEntities.join(', ')}
                  </p>
                </div>
              </label>

              {/* Questions */}
              <label className="flex items-start gap-3 p-2.5 bg-[#FFF9FA] hover:bg-[#FFE8EE]/50 rounded-xl cursor-pointer transition-colors border border-[#F1DDE2]/60">
                <input
                  type="checkbox"
                  checked={checkboxes.questions}
                  onChange={(e) => setCheckboxes({ ...checkboxes, questions: e.target.checked })}
                  className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                />
                <div className="flex-1">
                  <span className="font-bold text-[#1F1720]">Pertanyaan Kunci ({level2Data.questions.length})</span>
                  <p className="text-[#6F6670] mt-0.5">{level2Data.questions.slice(0, 2).join('; ')}...</p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Scope Boundaries (Cannibalization Prevention) */}
          <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#1F1720] border-b border-[#F1DDE2] pb-2 flex items-center justify-between">
              <span>2. Batasan Halaman (Mencegah Cannibalization)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-3 p-2.5 bg-[#FFF9FA] hover:bg-[#FFE8EE]/50 rounded-xl cursor-pointer transition-colors border border-[#F1DDE2]/60">
                <input
                  type="checkbox"
                  checked={checkboxes.includedScope}
                  onChange={(e) => setCheckboxes({ ...checkboxes, includedScope: e.target.checked })}
                  className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                />
                <div className="flex-1">
                  <span className="font-bold text-emerald-700">Wajib Dibahas (Included Scope)</span>
                  <ul className="list-disc list-inside text-[#6F6670] mt-1 space-y-0.5">
                    {level2Data.includedScope.map((inc, i) => (
                      <li key={i}>{inc}</li>
                    ))}
                  </ul>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 bg-[#FFF9FA] hover:bg-[#FFE8EE]/50 rounded-xl cursor-pointer transition-colors border border-[#F1DDE2]/60">
                <input
                  type="checkbox"
                  checked={checkboxes.excludedScope}
                  onChange={(e) => setCheckboxes({ ...checkboxes, excludedScope: e.target.checked })}
                  className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                />
                <div className="flex-1">
                  <span className="font-bold text-rose-700">Batasan / Dialihkan (Excluded Scope)</span>
                  <p className="text-[#6F6670] mt-0.5">
                    Topik yang dialihkan ke halaman lain agar tidak terjadi persaingan internal (cannibalization):
                  </p>
                  <ul className="list-disc list-inside text-[#6F6670] mt-1 space-y-0.5">
                    {level2Data.excludedScope.map((exc, i) => (
                      <li key={i}>
                        <strong>{exc.topic}</strong> → Ditangani halaman: <em>{exc.handledByPage}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Recommended Reference Materials */}
          {recommendedList.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1DDE2] pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#FE4C6F]" />
                  <h3 className="font-bold text-sm text-[#1F1720]">
                    3. Rekomendasi Fakta & Referensi Resmi ({selectedSnippetsCount}/{recommendedList.length} terpilih)
                  </h3>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#6F6670] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkboxes.referenceMaterials}
                    onChange={(e) =>
                      setCheckboxes({ ...checkboxes, referenceMaterials: e.target.checked })
                    }
                    className="rounded-sm accent-[#FE4C6F]"
                  />
                  <span>Sertakan di Prompt</span>
                </label>
              </div>

              <p className="text-xs text-[#6F6670]">
                AI mendeteksi data/fakta resmi dari Bank Referensi yang relevan secara spesifik untuk halaman ini guna menjamin akurasi konten tanpa mengarang data palsu.
              </p>

              <div className="space-y-2.5">
                {recommendedList.map((rec) => {
                  const detail = getSnippetDetail(rec.snippetId);
                  const isChecked = checkboxes.selectedReferenceSnippetIds?.[rec.snippetId] !== false;

                  return (
                    <div
                      key={rec.snippetId}
                      className={`p-3 rounded-xl border transition-all text-xs ${
                        isChecked
                          ? 'bg-[#FFF9FA] border-[#FE4C6F]'
                          : 'bg-white border-[#F1DDE2] opacity-60'
                      }`}
                    >
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSnippet(rec.snippetId)}
                          className="mt-0.5 rounded-sm accent-[#FE4C6F]"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#1F1720]">
                              {detail ? detail.title : `Snippet #${rec.snippetId}`}
                            </span>
                            {detail?.category && (
                              <span className="px-2 py-0.2 bg-[#FFE8EE] text-[#FE4C6F] font-bold text-[10px] rounded-md">
                                {detail.category}
                              </span>
                            )}
                          </div>

                          <div className="p-2 bg-white border border-[#F1DDE2]/60 rounded-lg text-[#1F1720] font-medium text-[11px]">
                            <strong className="text-[#FE4C6F]">Alasan Relevansi:</strong> {rec.relevanceReason}
                          </div>

                          {detail && (
                            <p className="text-[#6F6670] text-[11px] leading-relaxed pt-0.5">
                              {detail.content}
                            </p>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Article Structure Sections Breakdown */}
          <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1DDE2] pb-2">
              <h3 className="font-bold text-sm text-[#1F1720]">
                {recommendedList.length > 0 ? '4.' : '3.'} Struktur & Seksi Artikel ({selectedSectionsCount}/{level2Data.sections.length} terpilih)
              </h3>
            </div>

            <div className="space-y-2">
              {level2Data.sections.map((sec) => {
                const isSelected = !!checkboxes.selectedSectionIds[sec.sectionId];
                const isActive = activeSectionId === sec.sectionId;

                return (
                  <div
                    key={sec.sectionId}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isActive
                        ? 'bg-[#FFF9FA] border-[#FE4C6F]'
                        : 'bg-white border-[#F1DDE2] hover:border-[#FE4C6F]'
                    }`}
                  >
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSection(sec.sectionId)}
                        className="rounded-sm accent-[#FE4C6F]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-md ${
                              sec.level === 'H1'
                                ? 'bg-[#FE4C6F] text-white'
                                : sec.level === 'H2'
                                ? 'bg-[#FFE8EE] text-[#E83E60]'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {sec.level}
                          </span>
                          <span className="font-bold text-[#1F1720]">{sec.heading}</span>
                        </div>
                        <p className="text-[#6F6670] text-[11px] mt-0.5 line-clamp-1">
                          {sec.purpose}
                        </p>
                      </div>
                    </label>

                    <button
                      onClick={() => setActiveSectionId(sec.sectionId)}
                      className="p-1.5 text-[#FE4C6F] hover:bg-[#FFE8EE] rounded-lg transition-colors flex-shrink-0"
                      title="Inspeksi Seksi Ini"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Internal Link Opportunities */}
          {level2Data.internalLinkOpportunities.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1DDE2] pb-2">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-[#FE4C6F]" />
                  <h3 className="font-bold text-sm text-[#1F1720]">
                    {recommendedList.length > 0 ? '5.' : '4.'} Peluang Tautan Internal ({level2Data.internalLinkOpportunities.length})
                  </h3>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#6F6670] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkboxes.internalLinks}
                    onChange={(e) =>
                      setCheckboxes({ ...checkboxes, internalLinks: e.target.checked })
                    }
                    className="rounded-sm accent-[#FE4C6F]"
                  />
                  <span>Sertakan di Prompt</span>
                </label>
              </div>

              <p className="text-xs text-[#6F6670]">
                Rekomendasi anchor text alami dan konteks penempatan tautan untuk memperkuat arsitektur SILO tanpa terkesan manipulatif.
              </p>

              <div className="space-y-2.5">
                {level2Data.internalLinkOpportunities.map((link, idx) => {
                  const href =
                    level2Data.websiteUrl && link.targetSlug
                      ? `${level2Data.websiteUrl}/${link.targetSlug}`
                      : null;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl text-xs space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#1F1720]">
                          Tautkan ke: <span className="text-[#FE4C6F] font-semibold">{link.targetPage}</span>
                        </span>
                        {link.targetSlug && (
                          <span className="px-2 py-0.5 bg-white border border-[#F1DDE2] font-mono text-[10px] text-[#6F6670] rounded-md">
                            /{link.targetSlug}
                          </span>
                        )}
                      </div>

                      {href && (
                        <div className="text-[11px] text-[#6F6670] font-mono bg-white px-2.5 py-1 rounded-lg border border-[#F1DDE2]/60 truncate">
                          href: <span className="text-[#FE4C6F]">{href}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-[#6F6670]">
                        <strong>Jangkar Teks:</strong> &quot;{link.suggestedAnchor}&quot;
                      </div>

                      <div className="text-[11px] text-[#6F6670]">
                        <strong>Konteks:</strong> {link.context}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 Cols): Node Inspector & Quality Guidance */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          {/* Active Section Inspector */}
          {activeSection ? (
            <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#F1DDE2] pb-2">
                <span className="px-2 py-0.5 bg-[#FE4C6F] text-white font-mono text-xs font-bold rounded-md">
                  {activeSection.level} Inspector
                </span>
                <span className="text-xs text-[#6F6670]">Section Details</span>
              </div>

              <h4 className="font-bold text-sm text-[#1F1720]">
                {activeSection.heading}
              </h4>

              <div className="text-xs space-y-2.5">
                <div>
                  <span className="font-bold text-[#6F6670]">Tujuan Seksi:</span>
                  <p className="text-[#1F1720] mt-0.5">{activeSection.purpose}</p>
                </div>

                {activeSection.mustExplain.length > 0 && (
                  <div>
                    <span className="font-bold text-[#6F6670]">Poin Wajib Dijelaskan:</span>
                    <ul className="list-disc list-inside text-[#1F1720] mt-0.5 space-y-0.5">
                      {activeSection.mustExplain.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeSection.questions.length > 0 && (
                  <div>
                    <span className="font-bold text-[#6F6670]">Pertanyaan Pembaca:</span>
                    <ul className="list-disc list-inside text-[#1F1720] mt-0.5 space-y-0.5">
                      {activeSection.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeSection.evidenceRequirements.length > 0 && (
                  <div className="p-2.5 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl">
                    <span className="font-bold text-[#E83E60] flex items-center gap-1">
                      <BookmarkCheck className="w-3.5 h-3.5" /> Evidence Recommended:
                    </span>
                    <p className="text-[#6F6670] mt-0.5">{activeSection.evidenceRequirements.join('; ')}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 text-center text-xs text-[#6F6670]">
              Pilih seksi di sebelah kiri untuk melihat rincian kriteria penulisan.
            </div>
          )}

          {/* Evidence Requirements */}
          <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-2 text-xs">
            <h4 className="font-bold text-sm text-[#1F1720] flex items-center gap-1.5">
              <BookmarkCheck className="w-4 h-4 text-[#FE4C6F]" /> Bukti / Evidence Recommended
            </h4>
            <p className="text-[#6F6670]">
              Data empiris dan bukti visual yang disarankan untuk ditambahkan ke artikel:
            </p>
            <ul className="list-disc list-inside text-[#1F1720] space-y-1 pt-1">
              {level2Data.evidenceRequirements.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          </div>

          {/* Google Quality Guardrails */}
          <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-2 text-xs">
            <h4 className="font-bold text-sm text-[#1F1720] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> People-First Quality Guardrails
            </h4>
            <ul className="list-disc list-inside text-[#6F6670] space-y-1">
              {level2Data.peopleFirstQualityGuidance.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>

          {/* P0 (§3.1): Search-Engine-First Warnings (Peringatan Khusus Halaman) */}
          {level2Data.searchEngineFirstWarnings && level2Data.searchEngineFirstWarnings.length > 0 && (
            <div className="bg-[#FFFBF2] rounded-2xl border border-[#FDE68A] p-5 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-[#FDE68A] pb-2">
                <h4 className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Peringatan Khusus Halaman (Hindari)
                </h4>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkboxes.searchEngineFirstWarnings}
                    onChange={(e) =>
                      setCheckboxes({
                        ...checkboxes,
                        searchEngineFirstWarnings: e.target.checked,
                      })
                    }
                    className="rounded-sm accent-amber-600"
                  />
                  <span>Sertakan</span>
                </label>
              </div>
              <p className="text-[11px] text-amber-800/80">
                Peringatan anti-cannibalization & jebakan thin-content yang dirancang khusus untuk topik halaman ini:
              </p>
              <ul className="list-disc list-inside text-amber-900 space-y-1 pt-0.5">
                {level2Data.searchEngineFirstWarnings.map((warning, i) => (
                  <li key={i} className="leading-relaxed">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reference Snippets Quick Card */}
          {recommendedList.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-2 text-xs">
              <h4 className="font-bold text-sm text-[#1F1720] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#FE4C6F]" /> Fakta Resmi Terkait ({selectedSnippetsCount} aktif)
              </h4>
              <p className="text-[#6F6670] text-[11px]">
                Snippet fakta ini akan disisipkan ke prompt artikel sebagai acuan akurasi data:
              </p>
              <div className="space-y-1.5 pt-1">
                {recommendedList
                  .filter((rec) => checkboxes.selectedReferenceSnippetIds?.[rec.snippetId] !== false)
                  .map((rec) => {
                    const detail = getSnippetDetail(rec.snippetId);
                    return (
                      <div
                        key={rec.snippetId}
                        className="p-2 bg-[#FFF9FA] border border-[#F1DDE2] rounded-lg text-[11px]"
                      >
                        <div className="font-bold text-[#1F1720] flex items-center justify-between">
                          <span>{detail?.title || `Snippet #${rec.snippetId}`}</span>
                          {detail?.category && (
                            <span className="text-[10px] text-[#FE4C6F] font-semibold">
                              {detail.category}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
