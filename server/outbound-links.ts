import { Level1Result, LinkTarget, PageLinkPlan, PageSiloItem } from '../src/types.js';

export interface ParseOutboundLinksResult {
  valid: string[];
  invalid: string[];
  duplicateCount: number;
}

/**
 * Mem-parse teks mentah outbound link baris demi baris, memvalidasi protokol http/https,
 * dan membuang duplikat dengan tetap mempertahankan urutan kemunculan pertama.
 */
export function parseOutboundLinks(raw: string): ParseOutboundLinksResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: [], invalid: [], duplicateCount: 0 };
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const line of lines) {
    let isValidUrl = false;
    try {
      const parsed = new URL(line);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        isValidUrl = true;
      }
    } catch {
      isValidUrl = false;
    }

    if (!isValidUrl) {
      invalid.push(line);
      continue;
    }

    if (seen.has(line)) {
      duplicateCount++;
    } else {
      seen.add(line);
      valid.push(line);
    }
  }

  return { valid, invalid, duplicateCount };
}

/**
 * Membagikan outbound link secara merata ke seluruh artikel pendukung dengan round-robin.
 * Setiap link muncul tepat 1 kali di seluruh SILO.
 */
export function distributeOutboundLinks(
  links: string[],
  supportingPageIds: string[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!supportingPageIds || supportingPageIds.length === 0) {
    return result;
  }

  for (const id of supportingPageIds) {
    result[id] = [];
  }

  if (!links || links.length === 0) {
    return result;
  }

  for (let i = 0; i < links.length; i++) {
    const targetId = supportingPageIds[i % supportingPageIds.length];
    result[targetId].push(links[i]);
  }

  return result;
}

/**
 * Menghitung rencana penautan deterministik (linkPlan) untuk sebuah halaman SILO.
 */
export function buildPageLinkPlan(
  page: PageSiloItem,
  level1: Level1Result
): PageLinkPlan {
  const pillarPage = level1.siloPages.find((p) => p.pageRole === 'Pillar');
  const supportingPages = level1.siloPages.filter((p) => p.pageRole !== 'Pillar');
  const baseUrl = level1.websiteUrl?.trim().replace(/\/+$/, '') || '';

  const toTarget = (p: PageSiloItem): LinkTarget => {
    const url = baseUrl ? `${baseUrl}/${p.suggestedSlug}` : `/${p.suggestedSlug}`;
    const focusKeyword = p.suggestedFocusKeyword || p.primaryEntity || p.title;
    return {
      title: p.title,
      slug: p.suggestedSlug,
      url,
      focusKeyword,
      scopeSummary: p.scopeSummary,
    };
  };

  if (page.pageRole === 'Pillar') {
    return {
      role: 'pillar',
      supportingTargets: supportingPages.map(toTarget),
      outboundLinks: [],
      websiteUrlMissing: !baseUrl,
    };
  }

  const assignment = distributeOutboundLinks(
    level1.outboundLinks ?? [],
    supportingPages.map((p) => p.pageId)
  );

  return {
    role: 'supporting',
    pillar: pillarPage ? toTarget(pillarPage) : undefined,
    outboundLinks: assignment[page.pageId] ?? [],
    websiteUrlMissing: !baseUrl,
  };
}

/**
 * Menghasilkan petunjuk topik bersih dari URL (mengabaikan nomor telepon dan ID angka panjang).
 */
export function deriveUrlTopicHint(url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const seg = [...segs].reverse().find((s) => /[a-zA-Z]{3,}/.test(s)) || '';
    const tokens = decodeURIComponent(seg)
      .replace(/\.(html?|php|aspx?)$/i, '')
      .split(/[-_]+/)
      .filter(Boolean);
    while (tokens.length && /^\d+$/.test(tokens[0])) tokens.shift();
    while (tokens.length && /^\d{5,}$/.test(tokens[tokens.length - 1])) tokens.pop();
    const hint = tokens.join(' ').trim();
    return hint || u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

