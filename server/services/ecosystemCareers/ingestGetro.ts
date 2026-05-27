import { prisma } from '@/prisma/prisma';
import { cleanApplyUrl } from '@/lib/ecosystemCareers/cleanApplyUrl';

export interface IngestResult {
  source: 'getro';
  inserted: number;
  updated: number;
  skipped: number;
  pagesFetched: number;
  error: string | null;
}

// The Avalanche board on jobs.avax.network is Getro network 10223.
// Confirmed via the network metadata embedded in the public page HTML.
const AVALANCHE_NETWORK_ID = 10223;
const GETRO_BASE = 'https://api.getro.com/v2';
const PAGE_SIZE = 100; // API max
// Getro is rate-limited to 30 requests/minute. Hard-cap the loop so a runaway
// pagination doesn't burn the budget; 50 pages at 100/page is 5k jobs, well
// past anything realistic for this network.
const MAX_PAGES = 50;
// Drop anything more than a year old — stale listings clutter the queue.
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

interface GetroJob {
  id: number | string;
  title: string;
  url: string;
  description?: string | null;
  locations?: string[];
  work_mode?: 'remote' | 'on_site' | string | null;
  created_at?: string | null;
  job_functions?: string[];
  seniority?: string | null;
  employment_types?: string[];
  company?: {
    id?: number | string;
    name?: string | null;
    logo_url?: string | null;
    slug?: string | null;
    industry_tags?: string[];
  } | null;
}

interface GetroResponse {
  items?: GetroJob[];
  meta?: { total?: number; page?: number };
}

interface IngestOptions {
  includeDescriptions?: boolean;
  // Used by the test endpoint to short-circuit before writing to DB.
  dryRun?: boolean;
}

export interface DryRunResult {
  source: 'getro';
  pagesFetched: number;
  fetched: number;
  afterAgeFilter: number;
  sample: GetroJob[];
  error: string | null;
}

async function fetchPage(
  apiKey: string,
  page: number,
  includeDescriptions: boolean,
): Promise<{ items: GetroJob[]; total: number | null }> {
  const url = new URL(`${GETRO_BASE}/networks/${AVALANCHE_NETWORK_ID}/jobs`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(PAGE_SIZE));
  if (includeDescriptions) url.searchParams.set('include_descriptions', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Getro ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const payload = (await res.json()) as GetroResponse;
  return {
    items: payload.items ?? [],
    total: payload.meta?.total ?? null,
  };
}

export async function fetchGetroDryRun(opts: IngestOptions = {}): Promise<DryRunResult> {
  const apiKey = process.env.GETRO_CAREER_API_KEY?.trim();
  if (!apiKey) {
    return {
      source: 'getro',
      pagesFetched: 0,
      fetched: 0,
      afterAgeFilter: 0,
      sample: [],
      error: 'GETRO_CAREER_API_KEY not configured',
    };
  }
  try {
    const all: GetroJob[] = [];
    let page = 1;
    while (page <= MAX_PAGES) {
      const { items, total } = await fetchPage(apiKey, page, !!opts.includeDescriptions);
      all.push(...items);
      if (items.length < PAGE_SIZE) break;
      if (total !== null && all.length >= total) break;
      page += 1;
    }
    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh = all.filter((j) => {
      if (!j.created_at) return true;
      const ms = new Date(j.created_at).getTime();
      return Number.isNaN(ms) || ms >= cutoff;
    });
    return {
      source: 'getro',
      pagesFetched: page,
      fetched: all.length,
      afterAgeFilter: fresh.length,
      sample: fresh.slice(0, 3),
      error: null,
    };
  } catch (err) {
    return {
      source: 'getro',
      pagesFetched: 0,
      fetched: 0,
      afterAgeFilter: 0,
      sample: [],
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

// Idempotent on (source='getro', external_id). New rows land is_active=false
// so a devrel approves them in the admin queue. Existing rows are touched
// with last_seen_at so we can prune anything that stopped appearing.
export async function ingestGetro(opts: IngestOptions = {}): Promise<IngestResult> {
  const apiKey = process.env.GETRO_CAREER_API_KEY?.trim();
  if (!apiKey) {
    return {
      source: 'getro',
      inserted: 0,
      updated: 0,
      skipped: 0,
      pagesFetched: 0,
      error: 'GETRO_CAREER_API_KEY not configured',
    };
  }

  let allJobs: GetroJob[] = [];
  let pages = 0;
  try {
    while (pages < MAX_PAGES) {
      const { items, total } = await fetchPage(
        apiKey,
        pages + 1,
        opts.includeDescriptions ?? true,
      );
      pages += 1;
      allJobs.push(...items);
      if (items.length < PAGE_SIZE) break;
      if (total !== null && allJobs.length >= total) break;
    }
  } catch (err) {
    return {
      source: 'getro',
      inserted: 0,
      updated: 0,
      skipped: 0,
      pagesFetched: pages,
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }

  if (opts.dryRun) {
    return {
      source: 'getro',
      inserted: 0,
      updated: 0,
      skipped: allJobs.length,
      pagesFetched: pages,
      error: null,
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();

  const ageCutoff = Date.now() - MAX_AGE_MS;

  for (const j of allJobs) {
    const externalId = j.id?.toString();
    if (!externalId || !j.title || !j.url) {
      skipped += 1;
      continue;
    }

    if (j.created_at) {
      const ms = new Date(j.created_at).getTime();
      if (!Number.isNaN(ms) && ms < ageCutoff) {
        skipped += 1;
        continue;
      }
    }

    const existing = await prisma.jobListing.findFirst({
      where: { source: 'getro', external_id: externalId },
      select: { id: true },
    });

    if (existing) {
      await prisma.jobListing.update({
        where: { id: existing.id },
        data: { last_seen_at: now },
      });
      updated += 1;
      continue;
    }

    const remoteType =
      j.work_mode === 'remote'
        ? 'remote'
        : j.work_mode === 'on_site'
          ? 'onsite'
          : null;

    await prisma.jobListing.create({
      data: {
        source: 'getro',
        external_id: externalId,
        company_name: j.company?.name ?? null,
        company_logo: j.company?.logo_url ?? null,
        company_website: null,
        company_tags: j.company?.industry_tags ?? [],
        title: j.title.trim(),
        short_description: (j.description ?? j.title).replace(/<[^>]*>/g, '').slice(0, 280),
        description: j.description ?? null,
        location: (j.locations ?? []).filter(Boolean).join(' · ') || null,
        remote_type: remoteType,
        employment_type: j.employment_types?.[0] ?? null,
        seniority: j.seniority ?? null,
        tags: j.job_functions ?? [],
        apply_url: cleanApplyUrl(j.url),
        source_url: j.url,
        posted_at: j.created_at ? new Date(j.created_at) : null,
        last_seen_at: now,
        is_active: false,
      },
    });
    inserted += 1;
  }

  return {
    source: 'getro',
    inserted,
    updated,
    skipped,
    pagesFetched: pages,
    error: null,
  };
}
