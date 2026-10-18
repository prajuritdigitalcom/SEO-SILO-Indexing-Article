import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { Level1Workspace } from './components/Level1Workspace.tsx';
import { Level1OutputPanel } from './components/Level1OutputPanel.tsx';
import { Level2Workspace } from './components/Level2Workspace.tsx';
import { AccessGateModal } from './components/AccessGateModal.tsx';
import { PromptModal } from './components/PromptModal.tsx';
import { HistoryWorkspace } from './components/HistoryWorkspace.tsx';
import { SettingsWorkspace } from './components/SettingsWorkspace.tsx';
import {
  AddPagesFromKeywordsBatchResult,
  ApiKeyItem,
  AppView,
  BulkVerificationSummary,
  GeneratedPromptResult,
  HistoryItem,
  InternalLinkRec,
  KeyPoolStats,
  Level1Result,
  Level2CheckboxState,
  Level2Result,
  PageSiloItem,
  VerifyKeyResult,
  WebsiteType,
} from './types.ts';
import { clientKeyPool } from './lib/key-pool.ts';
import {
  getOrCreateLocalVisitorId,
  removeKeyFromStorage,
} from './lib/api-key-storage.ts';
import {
  deleteLocalHistoryItem,
  loadLocalHistory,
  saveLocalHistoryItem,
} from './lib/history-storage.ts';
import { readApiResponse } from './lib/api-client.ts';
import { slugify } from './lib/slug-utils.ts';

const MAX_KEYWORDS_PER_BATCH = 5;

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('generate');
  const [activeLevelMode, setActiveLevelMode] = useState<'level1' | 'level2'>('level1');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // App Access Gate State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return !!localStorage.getItem('prajurit_gate_auth_token');
  });

  // Data States
  const [level1Result, setLevel1Result] = useState<Level1Result | null>(null);
  const [level2Data, setLevel2Data] = useState<Level2Result | null>(null);
  const [promptResult, setPromptResult] = useState<GeneratedPromptResult | null>(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [lastAddPagesBatchResult, setLastAddPagesBatchResult] = useState<AddPagesFromKeywordsBatchResult | null>(null);

  // Loading States
  const [lvl1Loading, setLvl1Loading] = useState(false);
  const [lvl2Loading, setLvl2Loading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [addPagesLoading, setAddPagesLoading] = useState(false);

  // History & Key States
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [visitorKeys, setVisitorKeys] = useState<ApiKeyItem[]>([]);
  const [keyStats, setKeyStats] = useState<KeyPoolStats | null>(null);
  const [hasServerFallback, setHasServerFallback] = useState<boolean>(true);

  // Refresh client-side keys and stats
  const refreshKeyPoolData = useCallback(async () => {
    const keys = clientKeyPool.getPublicKeys();
    setVisitorKeys(keys);

    try {
      const healthRes = await fetch('/api/health');
      const healthData = await readApiResponse(healthRes);
      const serverFallback = healthData.hasSystemFallback ?? true;
      setHasServerFallback(serverFallback);
      setKeyStats(clientKeyPool.getStats(serverFallback));
    } catch {
      setKeyStats(clientKeyPool.getStats(hasServerFallback));
    }
  }, [hasServerFallback]);

  // Refresh local history
  const refreshHistoryData = useCallback(() => {
    const items = loadLocalHistory();
    setHistoryItems(items);
  }, []);

  // Initial load
  useEffect(() => {
    getOrCreateLocalVisitorId();
    refreshKeyPoolData();
    refreshHistoryData();
  }, [refreshKeyPoolData, refreshHistoryData]);

  // Level 1 Generator with Client-Side Key Selection & Failover
  const handleGenerateLevel1 = async (params: {
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
  }): Promise<Level1Result> => {
    // Check if user has keys but none are ready
    if (visitorKeys.length > 0 && !visitorKeys.some((k) => k.status === 'READY')) {
      throw new Error(
        'Semua API Key lokal Anda saat ini berstatus COOLDOWN atau belum terverifikasi valid. Buka tab Pengaturan untuk memverifikasi atau menambahkan API Key baru.'
      );
    }

    setLvl1Loading(true);

    const maxAttempts = Math.max(2, visitorKeys.filter((k) => k.status === 'READY').length + 1);
    let lastError: any = null;
    let lastKeyRelatedError: any = null;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { rawKey, keyId, isSystemFallback } = clientKeyPool.getNextExecutableKey();

        try {
          const res = await fetch('/api/generate/level1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...params,
              apiKey: rawKey,
            }),
          });

          const apiResponse = await readApiResponse<{ result: Level1Result }>(res);

          if (!apiResponse.success || !apiResponse.result) {
            const errObj: any = new Error(apiResponse.error || `Error status ${res.status}`);
            errObj.classification = apiResponse.classification;
            throw errObj;
          }

          // Success on this key
          if (!isSystemFallback && keyId) {
            clientKeyPool.reportSuccess(keyId);
          }

          const result = apiResponse.result;
          setLevel1Result(result);
          setActiveLevelMode('level1');
          setCurrentView('output');

          // Persist to local history
          const historyItem: HistoryItem = {
            id: result.id,
            visitorId: getOrCreateLocalVisitorId(),
            type: 'level1',
            title: result.topic,
            topic: result.topic,
            createdAt: result.createdAt,
            updatedAt: result.createdAt,
            engineVersion: result.engineVersion,
            qualityRulesVersion: result.qualityRulesVersion,
            level1Data: result,
          };
          saveLocalHistoryItem(historyItem);

          refreshHistoryData();
          refreshKeyPoolData();
          return result;
        } catch (err: any) {
          lastError = err;
          const classification = err?.classification;
          if (classification === 'RATE_LIMIT' || classification === 'INVALID_KEY') {
            lastKeyRelatedError = err;
          }
          if (!isSystemFallback && keyId) {
            clientKeyPool.reportError(keyId, err);
          }
          refreshKeyPoolData();

          // Hanya retry ganti key jika error terkait API key (INVALID_KEY / RATE_LIMIT).
          // Untuk timeout atau error lainnya, hentikan retry agar user tidak menunggu berulang kali.
          if (classification && classification !== 'INVALID_KEY' && classification !== 'RATE_LIMIT') {
            break;
          }
        }
      }

      throw lastKeyRelatedError || lastError || new Error('Gagal menghasilkan Level 1 Architecture');
    } finally {
      setLvl1Loading(false);
      refreshKeyPoolData();
    }
  };

  // Level 2 Generator with Client-Side Key Selection & Failover
  const handleSelectPageForLevel2 = async (page: PageSiloItem) => {
    if (!level1Result) return;

    // Check if user has keys but none are ready
    if (visitorKeys.length > 0 && !visitorKeys.some((k) => k.status === 'READY')) {
      alert(
        'Semua API Key lokal Anda saat ini berstatus COOLDOWN atau belum terverifikasi valid. Buka tab Pengaturan untuk memverifikasi atau menambahkan API Key baru.'
      );
      return;
    }

    setLvl2Loading(true);
    setActiveLevelMode('level2');

    const maxAttempts = Math.max(2, visitorKeys.filter((k) => k.status === 'READY').length + 1);
    let lastError: any = null;
    let lastKeyRelatedError: any = null;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { rawKey, keyId, isSystemFallback } = clientKeyPool.getNextExecutableKey();

        try {
          const res = await fetch('/api/generate/level2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: rawKey,
              topic: level1Result.topic,
              selectedPageTitle: page.title,
              selectedPageRole: page.pageRole,
              pageSlug: page.suggestedSlug,
              lockedFocusKeyword: page.suggestedFocusKeyword || page.primaryEntity || page.title,
              cluster: page.cluster,
              parentPage: page.parentPage,
              childPages: page.childPages,
              relatedPages: page.relatedPages,
              sourceLevel1Id: level1Result.id,
              referenceMaterials: level1Result.referenceMaterials || [],
              writingVoiceSample: level1Result.writingVoiceSample,
              websiteUrl: level1Result.websiteUrl,
              knownPages: level1Result.siloPages.map((p) => ({
                title: p.title,
                slug: p.suggestedSlug,
                scopeSummary: p.scopeSummary,
              })),
              targetAudience: level1Result.targetAudience,
              websiteType: level1Result.websiteType,
              businessContext: level1Result.businessContext,
              location: level1Result.location,
              authorExpertise: level1Result.authorExpertise,
              lockedIntent: page.intent,
              lockedPrimaryEntity: page.primaryEntity,
              lockedSupportingEntities: page.supportingEntities,
              pageRationale: page.rationale,
            }),
          });

          const apiResponse = await readApiResponse<{ result: Level2Result }>(res);

          if (!apiResponse.success || !apiResponse.result) {
            const errObj: any = new Error(apiResponse.error || `Error status ${res.status}`);
            errObj.classification = apiResponse.classification;
            throw errObj;
          }

          if (!isSystemFallback && keyId) {
            clientKeyPool.reportSuccess(keyId);
          }

          const result = apiResponse.result;
          setLevel2Data(result);

          // Persist to local history
          const historyItem: HistoryItem = {
            id: result.id,
            visitorId: getOrCreateLocalVisitorId(),
            type: 'level2',
            title: `${result.selectedPageTitle} (${result.topic})`,
            topic: result.topic,
            createdAt: result.createdAt,
            updatedAt: result.createdAt,
            engineVersion: result.engineVersion,
            qualityRulesVersion: result.qualityRulesVersion,
            level2Data: result,
          };
          saveLocalHistoryItem(historyItem);

          refreshHistoryData();
          refreshKeyPoolData();
          return;
        } catch (err: any) {
          lastError = err;
          const classification = err?.classification;
          if (classification === 'RATE_LIMIT' || classification === 'INVALID_KEY') {
            lastKeyRelatedError = err;
          }
          if (!isSystemFallback && keyId) {
            clientKeyPool.reportError(keyId, err);
          }
          refreshKeyPoolData();

          // Hanya retry ganti key jika error terkait API key (INVALID_KEY / RATE_LIMIT).
          // Untuk timeout atau error lainnya, hentikan retry agar user tidak menunggu berulang kali.
          if (classification && classification !== 'INVALID_KEY' && classification !== 'RATE_LIMIT') {
            break;
          }
        }
      }

      alert(`Error: ${lastKeyRelatedError?.message || lastError?.message || 'Gagal membuat Level 2 Architecture'}`);
    } finally {
      setLvl2Loading(false);
      refreshKeyPoolData();
    }
  };

  // Prompt Generator
  const handleGeneratePrompt = async (checkboxes: Level2CheckboxState) => {
    if (!level2Data) return;
    setPromptLoading(true);
    try {
      const activeReferences = level1Result?.referenceMaterials || [];
      const res = await fetch('/api/generate/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level2Data,
          checkboxes,
          referenceMaterials: activeReferences,
        }),
      });

      const apiResponse = await readApiResponse<{ promptResult: GeneratedPromptResult }>(res);

      if (!apiResponse.success || !apiResponse.promptResult) {
        throw new Error(apiResponse.error || 'Gagal menghasilkan prompt');
      }

      const generated = apiResponse.promptResult;
      setPromptResult(generated);
      setIsPromptModalOpen(true);

      // Update local history
      if (level2Data.id) {
        const historyItem: HistoryItem = {
          id: level2Data.id,
          visitorId: getOrCreateLocalVisitorId(),
          type: 'prompt',
          title: `${level2Data.selectedPageTitle} (${level2Data.topic})`,
          topic: level2Data.topic,
          createdAt: level2Data.createdAt,
          updatedAt: new Date().toISOString(),
          engineVersion: level2Data.engineVersion,
          qualityRulesVersion: level2Data.qualityRulesVersion,
          level2Data,
          checkboxState: checkboxes,
          promptResult: generated,
        };
        saveLocalHistoryItem(historyItem);
        refreshHistoryData();
      }
    } catch (err: any) {
      console.error('Error generating prompt:', err);
      alert(`Error: ${err?.message || 'Gagal memproses prompt'}`);
    } finally {
      setPromptLoading(false);
    }
  };

  // Update Page Slug Action
  const handleUpdatePageSlug = (pageId: string, newSlug: string) => {
    if (!level1Result) return;
    const sanitized = slugify(newSlug);
    const updatedSiloPages = level1Result.siloPages.map((p) =>
      p.pageId === pageId ? { ...p, suggestedSlug: sanitized } : p
    );
    const updatedLevel1: Level1Result = {
      ...level1Result,
      siloPages: updatedSiloPages,
    };
    setLevel1Result(updatedLevel1);

    // Update history item in localStorage if active
    if (updatedLevel1.id) {
      const historyItem: HistoryItem = {
        id: updatedLevel1.id,
        visitorId: getOrCreateLocalVisitorId(),
        type: 'level1',
        title: `${updatedLevel1.topic} (${updatedLevel1.websiteType})`,
        topic: updatedLevel1.topic,
        createdAt: updatedLevel1.createdAt,
        updatedAt: new Date().toISOString(),
        engineVersion: updatedLevel1.engineVersion,
        qualityRulesVersion: updatedLevel1.qualityRulesVersion,
        level1Data: updatedLevel1,
      };
      saveLocalHistoryItem(historyItem);
      refreshHistoryData();
    }
  };

  // Update Page Focus Keyword Action
  const handleUpdatePageFocusKeyword = (pageId: string, newFocusKeyword: string) => {
    if (!level1Result) return;
    const updatedSiloPages = level1Result.siloPages.map((p) =>
      p.pageId === pageId ? { ...p, suggestedFocusKeyword: newFocusKeyword.trim() } : p
    );
    const updatedLevel1: Level1Result = {
      ...level1Result,
      siloPages: updatedSiloPages,
    };
    setLevel1Result(updatedLevel1);

    if (updatedLevel1.id) {
      const historyItem: HistoryItem = {
        id: updatedLevel1.id,
        visitorId: getOrCreateLocalVisitorId(),
        type: 'level1',
        title: `${updatedLevel1.topic} (${updatedLevel1.websiteType})`,
        topic: updatedLevel1.topic,
        createdAt: updatedLevel1.createdAt,
        updatedAt: new Date().toISOString(),
        engineVersion: updatedLevel1.engineVersion,
        qualityRulesVersion: updatedLevel1.qualityRulesVersion,
        level1Data: updatedLevel1,
      };
      saveLocalHistoryItem(historyItem);
      refreshHistoryData();
    }
  };

  // Delete Page Action — hapus rancangan halaman SILO + bersihkan semua referensi silangnya
  const handleDeletePage = (pageId: string) => {
    if (!level1Result) return;

    // 1. Buang halaman dari daftar siloPages
    const updatedSiloPages = level1Result.siloPages
      .filter((p) => p.pageId !== pageId)
      // 2. Bersihkan referensi "hantu" ke pageId yang dihapus pada halaman lain
      .map((p) => ({
        ...p,
        parentPage: p.parentPage === pageId ? undefined : p.parentPage,
        childPages: p.childPages ? p.childPages.filter((id) => id !== pageId) : p.childPages,
        relatedPages: p.relatedPages ? p.relatedPages.filter((id) => id !== pageId) : p.relatedPages,
      }));

    // 3. Buang entri internalLinks yang source/target-nya adalah halaman yang dihapus,
    //    supaya tab "Internal Links" tetap konsisten dan aman dipakai di Level 2.
    const updatedInternalLinks = level1Result.internalLinks.filter(
      (link) => link.sourcePageId !== pageId && link.targetPageId !== pageId
    );

    const updatedLevel1: Level1Result = {
      ...level1Result,
      siloPages: updatedSiloPages,
      internalLinks: updatedInternalLinks,
    };
    setLevel1Result(updatedLevel1);

    // Sinkronkan ke history localStorage (pola sama seperti handleUpdatePageSlug)
    if (updatedLevel1.id) {
      const historyItem: HistoryItem = {
        id: updatedLevel1.id,
        visitorId: getOrCreateLocalVisitorId(),
        type: 'level1',
        title: `${updatedLevel1.topic} (${updatedLevel1.websiteType})`,
        topic: updatedLevel1.topic,
        createdAt: updatedLevel1.createdAt,
        updatedAt: new Date().toISOString(),
        engineVersion: updatedLevel1.engineVersion,
        qualityRulesVersion: updatedLevel1.qualityRulesVersion,
        level1Data: updatedLevel1,
      };
      saveLocalHistoryItem(historyItem);
      refreshHistoryData();
    }
  };

  // Tambah Rancangan Halaman dari List Kata Kunci (maks 5 per proses)
  const handleAddPagesFromKeywords = async (rawKeywords: string[]): Promise<boolean> => {
    if (!level1Result) return false;

    // Deduplikasi case-insensitive
    const seen = new Set<string>();
    const cleanedKeywords: string[] = [];
    for (const raw of rawKeywords) {
      const trimmed = raw.trim();
      const norm = trimmed.toLowerCase().replace(/\s+/g, ' ');
      if (trimmed.length > 0 && !seen.has(norm)) {
        seen.add(norm);
        cleanedKeywords.push(trimmed);
        if (cleanedKeywords.length >= MAX_KEYWORDS_PER_BATCH) break;
      }
    }

    if (cleanedKeywords.length === 0) return false;

    if (visitorKeys.length > 0 && !visitorKeys.some((k) => k.status === 'READY')) {
      alert(
        'Semua API Key lokal Anda saat ini berstatus COOLDOWN atau belum terverifikasi valid. Buka tab Pengaturan untuk memverifikasi atau menambahkan API Key baru.'
      );
      return false;
    }

    setAddPagesLoading(true);
    const maxAttempts = Math.max(2, visitorKeys.filter((k) => k.status === 'READY').length + 1);
    let lastError: any = null;
    let lastKeyRelatedError: any = null;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { rawKey, keyId, isSystemFallback } = clientKeyPool.getNextExecutableKey();

        try {
          const res = await fetch('/api/generate/level1/add-pages-from-keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: rawKey,
              keywords: cleanedKeywords,
              topic: level1Result.topic,
              websiteType: level1Result.websiteType,
              targetAudience: level1Result.targetAudience,
              businessContext: level1Result.businessContext,
              location: level1Result.location,
              authorExpertise: level1Result.authorExpertise,
              referenceText: level1Result.referenceNotes,
              writingVoiceSample: level1Result.writingVoiceSample,
              websiteUrl: level1Result.websiteUrl,
              existingSiloPages: level1Result.siloPages.map((p) => ({
                pageId: p.pageId,
                title: p.title,
                suggestedSlug: p.suggestedSlug,
                suggestedFocusKeyword: p.suggestedFocusKeyword || p.primaryEntity || p.title,
                pageRole: p.pageRole,
                cluster: p.cluster,
                scopeSummary: p.scopeSummary,
              })),
              existingClusters: level1Result.clusters.map((c) => ({
                name: c.name,
                purpose: c.purpose,
              })),
            }),
          });

          const apiResponse = await readApiResponse<{
            result: AddPagesFromKeywordsBatchResult;
          }>(res);

          if (!apiResponse.success || !apiResponse.result) {
            const errObj: any = new Error(apiResponse.error || `Error status ${res.status}`);
            errObj.classification = apiResponse.classification;
            throw errObj;
          }

          if (!isSystemFallback && keyId) {
            clientKeyPool.reportSuccess(keyId);
          }

          const batchResult = apiResponse.result;
          setLastAddPagesBatchResult(batchResult);

          const { newPages, newInternalLinks, rejectedKeywords, warnings: addPagesWarnings } = batchResult;

          // Buat catatan ringkas untuk warnings umum (history)
          const newWarnings: string[] = [];
          if (addPagesWarnings && addPagesWarnings.length > 0) {
            newWarnings.push(...addPagesWarnings);
          }
          if (rejectedKeywords && rejectedKeywords.length > 0) {
            const rejectSummary = `${rejectedKeywords.length} kata kunci ditolak (${rejectedKeywords
              .map((r) => `"${r.keyword}": ${r.reason}`)
              .join('; ')})`;
            newWarnings.push(rejectSummary);
          }

          const updatedLevel1: Level1Result = {
            ...level1Result,
            siloPages: newPages.length > 0 ? [...level1Result.siloPages, ...newPages] : level1Result.siloPages,
            internalLinks:
              newInternalLinks.length > 0
                ? [...level1Result.internalLinks, ...newInternalLinks]
                : level1Result.internalLinks,
            warnings:
              newWarnings.length > 0
                ? [...(level1Result.warnings || []), ...newWarnings]
                : level1Result.warnings,
          };
          setLevel1Result(updatedLevel1);

          if (updatedLevel1.id) {
            const historyItem: HistoryItem = {
              id: updatedLevel1.id,
              visitorId: getOrCreateLocalVisitorId(),
              type: 'level1',
              title: `${updatedLevel1.topic} (${updatedLevel1.websiteType})`,
              topic: updatedLevel1.topic,
              createdAt: updatedLevel1.createdAt,
              updatedAt: new Date().toISOString(),
              engineVersion: updatedLevel1.engineVersion,
              qualityRulesVersion: updatedLevel1.qualityRulesVersion,
              level1Data: updatedLevel1,
            };
            saveLocalHistoryItem(historyItem);
            refreshHistoryData();
          }

          refreshKeyPoolData();
          return true;
        } catch (err: any) {
          lastError = err;
          const classification = err?.classification;
          if (classification === 'RATE_LIMIT' || classification === 'INVALID_KEY') {
            lastKeyRelatedError = err;
          }
          if (!isSystemFallback && keyId) {
            clientKeyPool.reportError(keyId, err);
          }
          refreshKeyPoolData();

          if (classification && classification !== 'INVALID_KEY' && classification !== 'RATE_LIMIT') {
            break;
          }
        }
      }

      alert(`Error: ${lastKeyRelatedError?.message || lastError?.message || 'Gagal membuat rancangan halaman baru dari kata kunci'}`);
      return false;
    } finally {
      setAddPagesLoading(false);
      refreshKeyPoolData();
    }
  };

  // Update Level 2 SEO Metadata Action
  const handleUpdateSeoMetadata = (updatedSeo: any) => {
    if (!level2Data) return;
    const updatedLevel2: Level2Result = {
      ...level2Data,
      seoMetadata: updatedSeo,
    };
    setLevel2Data(updatedLevel2);

    if (updatedLevel2.id) {
      const historyItem: HistoryItem = {
        id: updatedLevel2.id,
        visitorId: getOrCreateLocalVisitorId(),
        type: 'level2',
        title: `${updatedLevel2.selectedPageTitle} (${updatedLevel2.selectedPageRole})`,
        topic: updatedLevel2.topic,
        createdAt: updatedLevel2.createdAt,
        updatedAt: new Date().toISOString(),
        engineVersion: updatedLevel2.engineVersion,
        qualityRulesVersion: updatedLevel2.qualityRulesVersion,
        level2Data: updatedLevel2,
      };
      saveLocalHistoryItem(historyItem);
      refreshHistoryData();
    }
  };

  // History Actions
  const handleOpenHistoryItem = (item: HistoryItem) => {
    if (item.level1Data) {
      const cleanL1: Level1Result = {
        ...item.level1Data,
        siloPages: (item.level1Data.siloPages || []).map((p) => ({
          ...p,
          suggestedSlug: typeof p.suggestedSlug === 'string' ? slugify(p.suggestedSlug) : p.suggestedSlug,
        })),
      };
      setLevel1Result(cleanL1);
      setActiveLevelMode('level1');
      setCurrentView('output');
    } else if (item.level2Data) {
      const cleanL2: Level2Result = {
        ...item.level2Data,
        internalLinkOpportunities: (item.level2Data.internalLinkOpportunities || []).map((link) => ({
          ...link,
          targetSlug: typeof link.targetSlug === 'string' ? slugify(link.targetSlug) : link.targetSlug,
        })),
      };
      setLevel2Data(cleanL2);
      if (cleanL2.referenceMaterials && cleanL2.referenceMaterials.length > 0) {
        if (!level1Result || !level1Result.referenceMaterials?.length) {
          setLevel1Result({
            id: cleanL2.sourceLevel1Id || 'hist_l1',
            topic: cleanL2.topic,
            summary: '',
            websiteType: 'General',
            coverageScore: 100,
            knowledgeArchitecture: [],
            clusters: [],
            siloPages: [],
            internalLinks: [],
            gaps: [],
            roadmap: [],
            referenceMaterials: cleanL2.referenceMaterials,
            createdAt: item.createdAt,
            engineVersion: item.engineVersion,
            qualityRulesVersion: item.qualityRulesVersion,
          });
        }
      }
      if (item.promptResult) {
        setPromptResult(item.promptResult);
      }
      setActiveLevelMode('level2');
      setCurrentView('output');
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    deleteLocalHistoryItem(id);
    refreshHistoryData();
  };

  // Verified Local Keys Actions
  const handleAddKey = async (
    keyInput: string,
    onProgress?: (current: number, total: number, currentMasked: string) => void
  ): Promise<BulkVerificationSummary> => {
    const summary = await clientKeyPool.verifyAndSaveBulkKeys(keyInput, onProgress);
    refreshKeyPoolData();
    return summary;
  };

  const handleDeleteKey = async (id: string) => {
    removeKeyFromStorage(id);
    refreshKeyPoolData();
  };

  const handleTestKey = async (keyId: string): Promise<VerifyKeyResult> => {
    const res = await clientKeyPool.testAndSyncStoredKey(keyId);
    refreshKeyPoolData();
    return res;
  };

  const handleGateSuccess = (token: string) => {
    setIsUnlocked(true);
  };

  const handleLockApp = () => {
    localStorage.removeItem('prajurit_gate_auth_token');
    setIsUnlocked(false);
  };

  return (
    <div className="min-h-screen flex bg-[#FFF9FA] text-[#1F1720]">
      {/* Access Gate Lock Modal */}
      <AccessGateModal
        isOpen={!isUnlocked}
        onSuccess={handleGateSuccess}
      />

      {/* Collapsible Left Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentView={currentView}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          keyStats={keyStats}
          onOpenSettings={() => setCurrentView('settings')}
          onLockApp={handleLockApp}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* VIEW 1: GENERATE WORKSPACE — Fokus Input Bahan */}
          {currentView === 'generate' && (
            <Level1Workspace
              onGenerateLevel1={handleGenerateLevel1}
              loading={lvl1Loading}
            />
          )}

          {/* VIEW 2: HASIL / OUTPUT WORKSPACE — Fokus Output Level 1 & Level 2 */}
          {currentView === 'output' && (
            <div className="space-y-6">
              {/* Level Mode Switcher Tabs */}
              <div className="flex items-center gap-2 border-b border-[#F1DDE2] pb-3">
                <button
                  onClick={() => setActiveLevelMode('level1')}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                    activeLevelMode === 'level1'
                      ? 'bg-[#FE4C6F] text-white shadow-xs'
                      : 'bg-white text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2]'
                  }`}
                >
                  <span>Level 1 — Topic Architecture</span>
                </button>

                <button
                  onClick={() => setActiveLevelMode('level2')}
                  disabled={!level2Data && activeLevelMode !== 'level2'}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                    activeLevelMode === 'level2'
                      ? 'bg-[#FE4C6F] text-white shadow-xs'
                      : 'bg-white text-[#6F6670] hover:bg-[#FFE8EE] hover:text-[#FE4C6F] border border-[#F1DDE2] disabled:opacity-50'
                  }`}
                >
                  <span>Level 2 — Page Architecture & Blueprint</span>
                  {level2Data && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </button>
              </div>

              {/* LEVEL 1 OUTPUT VIEW */}
              {activeLevelMode === 'level1' && (
                <Level1OutputPanel
                  level1Result={level1Result}
                  onSelectPageForLevel2={handleSelectPageForLevel2}
                  onUpdatePageSlug={handleUpdatePageSlug}
                  onUpdatePageFocusKeyword={handleUpdatePageFocusKeyword}
                  onGoToGenerate={() => setCurrentView('generate')}
                  onDeletePage={handleDeletePage}
                  onAddPagesFromKeywords={handleAddPagesFromKeywords}
                  addPagesLoading={addPagesLoading}
                  lastAddPagesBatchResult={lastAddPagesBatchResult}
                  onDismissAddPagesBatchResult={() => setLastAddPagesBatchResult(null)}
                />
              )}

              {/* LEVEL 2 OUTPUT VIEW */}
              {activeLevelMode === 'level2' && (
                <Level2Workspace
                  level2Data={level2Data}
                  loading={lvl2Loading}
                  onBackToLevel1={() => setActiveLevelMode('level1')}
                  onGeneratePrompt={handleGeneratePrompt}
                  promptLoading={promptLoading}
                  allReferenceSnippets={level1Result?.referenceMaterials || []}
                  onUpdateSeoMetadata={handleUpdateSeoMetadata}
                />
              )}
            </div>
          )}

          {/* VIEW 3: RIWAYAT / HISTORY WORKSPACE */}
          {currentView === 'history' && (
            <HistoryWorkspace
              items={historyItems}
              onOpenHistoryItem={handleOpenHistoryItem}
              onDeleteHistoryItem={handleDeleteHistoryItem}
            />
          )}

          {/* VIEW 4: PENGATURAN / SETTINGS WORKSPACE */}
          {currentView === 'settings' && (
            <SettingsWorkspace
              visitorKeys={visitorKeys}
              keyStats={keyStats}
              onAddKey={handleAddKey}
              onDeleteKey={handleDeleteKey}
              onTestKey={handleTestKey}
              onRefreshStats={refreshKeyPoolData}
            />
          )}
        </main>
      </div>

      {/* Prompt Result Modal */}
      {level2Data && promptResult && (
        <PromptModal
          level2Data={level2Data}
          promptResult={promptResult}
          isOpen={isPromptModalOpen}
          onClose={() => setIsPromptModalOpen(false)}
        />
      )}
    </div>
  );
}
