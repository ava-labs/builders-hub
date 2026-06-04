import { prisma } from '@/prisma/prisma';
import { isHttpUrl } from '@/lib/ecosystem-careers/isHttpUrl';
import { sanitizeJobHtml } from '@/lib/ecosystem-careers/sanitizeJobHtml';
import { pruneStaleExternalListings, upsertExternalListing } from './upsertExternalListing';

export interface IngestResult {
  source: 'external';
  inserted: number;
  updated: number;
  skipped: number;
  pruned: number;
  queriesRun: number;
  candidatesAfterFilter: number;
  error: string | null;
}

const WEB3_CAREER_BASE = 'https://web3.career/api/v1';
const LIMIT = 100;
const RELEVANT_TAGS = ['defi', 'layer-2', 'smart-contract', 'solidity', 'rust'];
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const AVAX_KEYWORDS = ['avalanche', 'avax', 'c-chain', 'p-chain'];

interface Web3CareerJob {
  id: string | number;
  title: string;
  company: string;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  is_remote?: boolean;
  description?: string | null;
  tags?: string[];
  apply_url: string;
  date?: string | null;
  date_epoch?: number | null;
  // Salary fields web3.career returns per job. The employer-stated exact
  // values (salary_*_value / salary_currency / salary_unit) are present only
  // when the listing provides them; the estimated_* trio is web3.career's own
  // annual-USD model output and is populated far more often.
  salary_min_value?: number | null;
  salary_max_value?: number | null;
  salary_currency?: string | null;
  salary_unit?: string | null;
  estimated_min_salary?: number | null;
  estimated_max_salary?: number | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

function compactMoney(value: number, symbol: string): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${symbol}${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `${symbol}${value}`;
}

function moneyRange(
  min: number | null | undefined,
  max: number | null | undefined,
  symbol: string,
): string | null {
  const lo = typeof min === 'number' && min > 0 ? min : null;
  const hi = typeof max === 'number' && max > 0 ? max : null;
  if (lo && hi) return `${compactMoney(lo, symbol)}–${compactMoney(hi, symbol)}`;
  if (lo) return `${compactMoney(lo, symbol)}+`;
  if (hi) return `Up to ${compactMoney(hi, symbol)}`;
  return null;
}

// Collapse web3.career's salary fields into the single human-readable `salary`
// string we store. Prefer the employer-stated exact range; fall back to the
// estimate (labelled so candidates know it isn't authoritative).
function web3CareerSalary(j: Web3CareerJob): string | null {
  const symbol =
    (j.salary_currency && CURRENCY_SYMBOLS[j.salary_currency.toUpperCase()]) || '$';
  const exact = moneyRange(j.salary_min_value, j.salary_max_value, symbol);
  if (exact) {
    const unit = j.salary_unit?.trim();
    return unit ? `${exact} / ${unit}` : exact;
  }
  const estimate = moneyRange(j.estimated_min_salary, j.estimated_max_salary, '$');
  return estimate ? `${estimate} (est.)` : null;
}

interface IngestOptions {
  dryRun?: boolean;
}

export interface DryRunResult {
  source: 'external';
  queriesRun: number;
  fetched: number;
  uniqueIds: number;
  afterAgeFilter: number;
  afterAvalancheFilter: number;
  sample: Web3CareerJob[];
  error: string | null;
}

async function fetchTag(apiKey: string, tag: string): Promise<Web3CareerJob[]> {
  const url = new URL(WEB3_CAREER_BASE);
  url.searchParams.set('token', apiKey);
  url.searchParams.set('tag', tag);
  url.searchParams.set('limit', String(LIMIT));
  url.searchParams.set('show_description', 'true');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`web3.career ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const payload = (await res.json()) as unknown;
  if (!Array.isArray(payload)) return [];
  const jobsArr = payload.find((x) => Array.isArray(x)) as unknown;
  return Array.isArray(jobsArr) ? (jobsArr as Web3CareerJob[]) : [];
}

async function loadAvalancheCompanyAllowList(): Promise<Set<string>> {
  const rows = await prisma.jobListing.findMany({
    where: { source: 'getro', company_name: { not: null } },
    select: { company_name: true },
    distinct: ['company_name'],
  });
  const set = new Set<string>();
  for (const r of rows) {
    const name = r.company_name?.trim().toLowerCase();
    if (name) set.add(name);
  }
  return set;
}

function passesAvalancheFilter(
  job: Web3CareerJob,
  allowList: Set<string>,
): { matched: boolean; reason: 'company' | 'keyword' | null } {
  const company = (job.company ?? '').trim().toLowerCase();
  if (company) {
    for (const a of allowList) {
      if (company.includes(a) || a.includes(company)) {
        return { matched: true, reason: 'company' };
      }
    }
  }
  const blob = `${job.title ?? ''} ${job.description ?? ''} ${(job.tags ?? []).join(' ')}`
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ');
  for (const kw of AVAX_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(blob)) return { matched: true, reason: 'keyword' };
  }
  return { matched: false, reason: null };
}

export async function fetchWeb3CareerDryRun(
  _opts: IngestOptions = {},
): Promise<DryRunResult> {
  const apiKey = process.env.WEB3_CAREER_API_KEY?.trim();
  if (!apiKey) {
    return {
      source: 'external',
      queriesRun: 0,
      fetched: 0,
      uniqueIds: 0,
      afterAgeFilter: 0,
      afterAvalancheFilter: 0,
      sample: [],
      error: 'WEB3_CAREER_API_KEY not configured',
    };
  }
  try {
    const allowList = await loadAvalancheCompanyAllowList();
    const all: Web3CareerJob[] = [];
    let queries = 0;
    for (const tag of RELEVANT_TAGS) {
      const items = await fetchTag(apiKey, tag);
      queries += 1;
      all.push(...items);
    }
    const byId = new Map<string, Web3CareerJob>();
    for (const j of all) {
      const id = j.id?.toString();
      if (id && !byId.has(id)) byId.set(id, j);
    }
    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh = Array.from(byId.values()).filter((j) => {
      const epoch = typeof j.date_epoch === 'number' ? j.date_epoch * 1000 : null;
      const dateParsed = j.date ? new Date(j.date).getTime() : null;
      const postedMs = epoch ?? dateParsed;
      return postedMs === null || Number.isNaN(postedMs) || postedMs >= cutoff;
    });
    const relevant = fresh.filter((j) => passesAvalancheFilter(j, allowList).matched);
    return {
      source: 'external',
      queriesRun: queries,
      fetched: all.length,
      uniqueIds: byId.size,
      afterAgeFilter: fresh.length,
      afterAvalancheFilter: relevant.length,
      sample: relevant.slice(0, 3),
      error: null,
    };
  } catch (err) {
    return {
      source: 'external',
      queriesRun: 0,
      fetched: 0,
      uniqueIds: 0,
      afterAgeFilter: 0,
      afterAvalancheFilter: 0,
      sample: [],
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

export async function ingestWeb3Career(
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const apiKey = process.env.WEB3_CAREER_API_KEY?.trim();
  if (!apiKey) {
    return {
      source: 'external',
      inserted: 0,
      updated: 0,
      skipped: 0,
      pruned: 0,
      queriesRun: 0,
      candidatesAfterFilter: 0,
      error: 'WEB3_CAREER_API_KEY not configured',
    };
  }

  const allowList = await loadAvalancheCompanyAllowList();
  let queries = 0;
  const byId = new Map<string, Web3CareerJob>();
  try {
    for (const tag of RELEVANT_TAGS) {
      const items = await fetchTag(apiKey, tag);
      queries += 1;
      for (const j of items) {
        const id = j.id?.toString();
        if (id && !byId.has(id)) byId.set(id, j);
      }
    }
  } catch (err) {
    return {
      source: 'external',
      inserted: 0,
      updated: 0,
      skipped: 0,
      pruned: 0,
      queriesRun: queries,
      candidatesAfterFilter: 0,
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }

  const relevant = Array.from(byId.values()).filter(
    (j) => passesAvalancheFilter(j, allowList).matched,
  );

  if (opts.dryRun) {
    return {
      source: 'external',
      inserted: 0,
      updated: 0,
      skipped: relevant.length,
      pruned: 0,
      queriesRun: queries,
      candidatesAfterFilter: relevant.length,
      error: null,
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();
  const ageCutoff = Date.now() - MAX_AGE_MS;

  for (const j of relevant) {
    const externalId = j.id?.toString();
    if (!externalId || !j.title || !isHttpUrl(j.apply_url)) {
      skipped += 1;
      continue;
    }

    const epoch = typeof j.date_epoch === 'number' ? j.date_epoch * 1000 : null;
    const dateParsed = j.date ? new Date(j.date).getTime() : null;
    const postedMs = epoch ?? dateParsed;
    if (postedMs !== null && !Number.isNaN(postedMs) && postedMs < ageCutoff) {
      skipped += 1;
      continue;
    }

    const outcome = await upsertExternalListing('external', externalId, now, () => {
      const locationDisplay =
        [j.city?.trim(), j.country?.trim()].filter(Boolean).join(', ') ||
        j.location?.trim() ||
        null;
      const postedAt =
        typeof j.date_epoch === 'number'
          ? new Date(j.date_epoch * 1000)
          : j.date
            ? new Date(j.date)
            : null;
      return {
        company_name: j.company ?? null,
        company_logo: null,
        company_website: null,
        company_tags: [],
        title: j.title.trim(),
        short_description: (j.description ?? j.title)
          .replace(/<[^>]*>/g, '')
          .slice(0, 280),
        description: sanitizeJobHtml(j.description) || null,
        location: locationDisplay,
        remote_type: j.is_remote ? 'remote' : null,
        employment_type: null,
        seniority: null,
        salary: web3CareerSalary(j),
        tags: (j.tags ?? []).slice(0, 10),
        // web3.career's ToS forbids modifying apply_url — its required tracking
        // params are already embedded, so store it verbatim (no cleanApplyUrl).
        apply_url: j.apply_url,
        source_url: null,
        posted_at: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
      };
    });
    if (outcome === 'updated') updated += 1;
    else inserted += 1;
  }

  const pruned = await pruneStaleExternalListings('external', MAX_AGE_MS);

  return {
    source: 'external',
    inserted,
    updated,
    skipped,
    pruned,
    queriesRun: queries,
    candidatesAfterFilter: relevant.length,
    error: null,
  };
}
