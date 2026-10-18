export type PageRole =
  | 'Pillar'
  | 'Definition'
  | 'Guide'
  | 'Process'
  | 'Comparison'
  | 'Application'
  | 'Evaluation'
  | 'Commercial Investigation'
  | 'Buying Guide'
  | 'Problem/Solution'
  | 'Maintenance'
  | 'Reference'
  | 'FAQ';

export type WebsiteType =
  | 'General'
  | 'Company Profile'
  | 'Ecommerce'
  | 'Blog'
  | 'Affiliate'
  | 'Educational'
  | 'Service Business'
  | 'Product Website'
  | 'Publisher';

export type AppView = 'generate' | 'output' | 'history' | 'settings';

export type SearchIntentType =
  | 'informational'
  | 'navigational'
  | 'transactional'
  | 'commercial investigation'
  | 'problem-solving'
  | 'comparison'
  | 'reference'
  | 'application';

export interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  purpose: string;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  parentId?: string;
  children?: KnowledgeNode[];
}

export interface TopicCluster {
  id: string;
  name: string;
  purpose: string;
  parentTopic: string;
  searchIntentCoverage: string[];
  candidatePages: string[];
  relevantEntities: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PageSiloItem {
  pageId: string;
  title: string;
  suggestedSlug: string;
  suggestedFocusKeyword: string;
  pageRole: PageRole;
  cluster: string;
  intent: SearchIntentType;
  primaryEntity: string;
  supportingEntities: string[];
  parentPage?: string;
  childPages?: string[];
  relatedPages?: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
  scopeSummary?: string;
  sourceKeyword?: string;
  isNewCluster?: boolean;
  clusterFitReason?: string;
}

export interface RejectedKeywordItem {
  keyword: string;
  reasonCode: 'OFF_TOPIC' | 'CANNIBALIZATION' | 'TOO_VAGUE';
  reason: string;
  conflictingPageId?: string;
}

export interface AddPagesFromKeywordsBatchResult {
  newPages: PageSiloItem[];
  newInternalLinks: InternalLinkRec[];
  rejectedKeywords: RejectedKeywordItem[];
  warnings?: string[];
}

export interface InternalLinkRec {
  sourcePageId: string;
  targetPageId: string;
  suggestedAnchor: string;
  linkPurpose: string;
  relationship: 'parent' | 'child' | 'sibling' | 'cross-cluster';
}

export interface LinkTarget {
  title: string;
  slug: string;
  /** URL penuh. Jika websiteUrl kosong, berisi path relatif "/slug". */
  url: string;
  focusKeyword: string;
  scopeSummary?: string;
}

export interface PageLinkPlan {
  role: 'pillar' | 'supporting';
  /** Hanya untuk role 'supporting': target link wajib ke artikel pilar. */
  pillar?: LinkTarget;
  /** Hanya untuk role 'pillar': SEMUA artikel pendukung yang wajib ditautkan. */
  supportingTargets?: LinkTarget[];
  /** Hanya untuk role 'supporting': jatah outbound link halaman ini. Bisa kosong. */
  outboundLinks: string[];
  /** true jika websiteUrl kosong sehingga URL internal memakai path relatif. */
  websiteUrlMissing?: boolean;
}

/** Ringkasan halaman SILO (judul + slug) yang dikirim sebagai referensi ke Level 2, agar AI mencocokkan target link ke slug yang benar-benar ada. */
export interface KnownSiloPage {
  title: string;
  slug: string;
  scopeSummary?: string;
}

export interface ArchitectureGap {
  topicArea: string;
  description: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedPageRole?: PageRole;
}

export interface ContentRoadmapItem {
  step: number;
  pageTitle: string;
  pageRole: PageRole;
  rationale: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ReferenceSnippet {
  id: string;
  title: string;
  content: string;
  category?: string;
}

export interface Level1Result {
  id: string;
  schemaVersion: string;
  engineVersion: string;
  qualityRulesVersion: string;
  topic: string;
  summary: string;
  targetAudience?: string;
  websiteType?: WebsiteType;
  businessContext?: string;
  location?: string;
  /** Latar belakang keahlian praktis/bisnis (E-E-A-T signal). */
  authorExpertise?: string;
  /** URL website utama (root domain), mis. https://contohsitus.com — dipakai untuk menyusun internal link otomatis (URL + slug) tanpa perlu diedit manual. */
  websiteUrl?: string;
  /** Teks referensi mentah bebas format, apa adanya yang ditempel pengguna. */
  referenceNotes?: string;
  /** Struktur SILO hasil riset manual pengguna sendiri (Pillar, kategori, judul halaman, slug), apa adanya seperti yang ditempel pengguna. Jika terisi, siloPages di bawah disusun mengikuti struktur ini, bukan hasil riset AI dari nol. */
  manualSiloStructure?: string;
  /** @deprecated Tidak dipakai lagi. Dipertahankan agar history lama tetap terbaca. */
  writingVoiceSample?: string;
  /** Daftar outbound link (sudah divalidasi & dibersihkan dari duplikat). Hanya dipakai untuk artikel pendukung. */
  outboundLinks?: string[];
  /** Fakta-fakta yang diekstrak & distrukturkan oleh AI dari referenceNotes. */
  referenceMaterials?: ReferenceSnippet[];
  knowledgeArchitecture: KnowledgeNode[];
  clusters: TopicCluster[];
  siloPages: PageSiloItem[];
  internalLinks: InternalLinkRec[];
  architectureCoverageScore: number;
  gaps: ArchitectureGap[];
  roadmap: ContentRoadmapItem[];
  warnings?: string[];
  createdAt: string;
}

export interface SectionRequirement {
  sectionId: string;
  heading: string;
  level: 'H1' | 'H2' | 'H3';
  purpose: string;
  mustExplain: string[];
  questions: string[];
  entities: string[];
  evidenceRequirements: string[];
  internalLinks: string[];
  notes?: string;
}

export interface RecommendedReferenceUsage {
  snippetId: string;
  relevanceReason: string;
}

export interface SeoTitleOption {
  title: string;
  rationale: string;
}

export interface SeoMetadata {
  /** 3-5 variasi judul H1 untuk halaman yang SAMA (bukan topik lain). */
  titleOptions: SeoTitleOption[];
  /** Index (0-based) opsi judul yang direkomendasikan sebagai default. */
  recommendedTitleIndex: number;
  /** Slug final. Diprioritaskan pass-through deterministik dari Level 1. */
  slug: string;
  /** Satu label kategori CMS yang ringkas & presentable. */
  category: string;
  /** 5-8 tag/keyword pendukung untuk taksonomi CMS. */
  tags: string[];
  /** Title tag SEO untuk SERP, target 50-60 karakter. */
  metaTitle: string;
  /** Meta description, target 120-158 karakter. */
  metaDescription: string;
  /** Frasa kata kunci utama (target query pencarian realistis). */
  focusKeyword: string;
  /** 3-6 frasa kata kunci semantik pendukung (LSI), bukan duplikat focusKeyword. */
  secondaryKeywords: string[];
}

export interface Level2Result {
  id: string;
  schemaVersion: string;
  engineVersion: string;
  qualityRulesVersion: string;
  sourceLevel1Id?: string;
  /** URL website utama, diteruskan dari Level 1 (bila diisi pengguna). Dipakai untuk membangun href internal link otomatis. */
  websiteUrl?: string;
  topic: string;
  selectedPageTitle: string;
  selectedPageRole: PageRole;
  searchIntent: SearchIntentType;
  userGoal: string;
  primaryEntity: string;
  supportingEntities: string[];
  questions: string[];
  conceptsToUnderstand: string[];
  includedScope: string[];
  excludedScope: {
    topic: string;
    handledByPage: string;
  }[];
  sections: SectionRequirement[];
  evidenceRequirements: string[];
  internalLinkOpportunities: {
    targetPage: string;
    /** Slug halaman target, dicocokkan AI dari daftar siloPages yang sudah ada (bila ditemukan). */
    targetSlug?: string;
    suggestedAnchor: string;
    context: string;
  }[];
  recommendedReferenceUsage?: RecommendedReferenceUsage[];
  referenceMaterials?: ReferenceSnippet[];
  /** @deprecated Tidak dipakai lagi. Dipertahankan agar history lama tetap terbaca. */
  writingVoiceSample?: string;
  /** Rencana penautan deterministik (pilar <-> pendukung & jatah outbound link). Selalu masuk prompt. */
  linkPlan?: PageLinkPlan;
  /** Latar belakang keahlian praktis/bisnis (E-E-A-T signal). */
  authorExpertise?: string;
  peopleFirstQualityGuidance: string[];
  searchEngineFirstWarnings: string[];
  seoMetadata?: SeoMetadata;
  warnings?: string[];
  createdAt: string;
}

export interface Level2CheckboxState {
  searchIntent: boolean;
  userGoal: boolean;
  primaryEntity: boolean;
  supportingEntities: boolean;
  questions: boolean;
  conceptsToUnderstand: boolean;
  includedScope: boolean;
  excludedScope: boolean;
  evidenceRequirements: boolean;
  internalLinks: boolean;
  qualityGuidance: boolean;
  searchEngineFirstWarnings: boolean;
  referenceMaterials: boolean;
  selectedReferenceSnippetIds: Record<string, boolean>;
  selectedSectionIds: Record<string, boolean>;
}

export interface GeneratedPromptResult {
  id: string;
  version: number;
  promptText: string;
  selectedComponentIdsCount: number;
  includedCount: number;
  missingCount: number;
  createdAt: string;
  isOutdated?: boolean;
}

export interface HistoryItem {
  id: string;
  visitorId: string;
  type: 'level1' | 'level2' | 'prompt';
  title: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  engineVersion: string;
  qualityRulesVersion: string;
  level1Data?: Level1Result;
  level2Data?: Level2Result;
  checkboxState?: Level2CheckboxState;
  promptResult?: GeneratedPromptResult;
}

export type KeyStatus = 'READY' | 'IN_USE' | 'COOLDOWN' | 'DISABLED' | 'INVALID';

export type VerificationStatus = 'VALID' | 'INVALID' | 'RATE_LIMIT' | 'UNAVAILABLE';

export interface VerifyKeyResult {
  valid: boolean;
  status:
    | 'valid'
    | 'valid_unverified'
    | 'invalid'
    | 'quota_limited'
    | 'provider_unavailable'
    | 'network_error'
    | 'model_unavailable';
  classification?: string;
  message: string;
  requestId?: string;
}

export interface BulkVerificationItemResult {
  rawKey: string;
  maskedKey: string;
  valid: boolean;
  status:
    | 'valid'
    | 'valid_unverified'
    | 'invalid'
    | 'quota_limited'
    | 'provider_unavailable'
    | 'network_error'
    | 'model_unavailable';
  message: string;
  isExisting: boolean;
}

export interface BulkVerificationSummary {
  totalProcessed: number;
  validCount: number;
  invalidCount: number;
  rateLimitCount: number;
  unavailableCount: number;
  alreadyExistingCount: number;
  results: BulkVerificationItemResult[];
}

export interface StoredClientKey {
  id: string;
  rawKey: string;
  maskedKey: string;
  status: KeyStatus;
  verificationStatus: VerificationStatus;
  lastVerifiedAt?: string;
  failureCount: number;
  successCount: number;
  lastUsedAt?: string;
  lastFailureAt?: string;
  cooldownUntil?: string;
  lastErrorReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyItem {
  id: string;
  maskedKey: string;
  status: KeyStatus;
  verificationStatus?: VerificationStatus;
  lastVerifiedAt?: string;
  failureCount: number;
  successCount: number;
  lastUsedAt?: string;
  lastFailureAt?: string;
  cooldownUntil?: string;
  lastErrorReason?: string;
  isSystemFallback?: boolean;
  createdAt: string;
}

export interface KeyPoolStats {
  totalKeys: number;
  readyKeys: number;
  cooldownKeys: number;
  invalidKeys: number;
  hasSystemFallback: boolean;
  activeRoundRobinIndex: number;
  totalRequestsProcessed: number;
  totalFailoversTriggered: number;
}
