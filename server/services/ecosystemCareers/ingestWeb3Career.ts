import { prisma } from '@/prisma/prisma';
import { cleanApplyUrl } from '@/lib/ecosystemCareers/cleanApplyUrl';

export interface IngestResult {
  source: 'external';
  inserted: number;
  updated: number;
  skipped: number;
  queriesRun: number;
  error: string | null;
}

// web3.career API uses ?token=KEY query auth and returns a tri-element array:
// ["ok", "v1", [...jobs]]. No pagination — limit caps payload (max 100).
// We only fetch tag=avalanche so we don't end up promoting roles for other
// ecosystems (Ethereum-only / Polygon-only / Solana-only). If a company isn't
// deployed on Avalanche, web3.career won't have tagged it `avalanche`.
const WEB3_CAREER_BASE = 'https://web3.career/api/v1';
const LIMIT = 100;
const RELEVANT_TAGS = ['avalanche'];
// Drop anything more than a year old — stale listings clutter the queue.
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

// Shape confirmed empirically against the live API on 2026-05-27 — the OpenAPI
// spec from the public docs is out of date (claimed `remote`, `postedAt`;
// actual fields are `is_remote`, `date`).
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
  estimated_min_salary?: number | null;
  estimated_max_salary?: number | null;
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
  sample: Web3CareerJob[];
  error: string | null;
}

async function fetchTag(apiKey: string, tag: string): Promise<Web3CareerJob[]> {
  const url = new URL(WEB3_CAREER_BASE);
  url.searchParams.set('token', apiKey);
  url.searchParams.set('tag', tag);
  url.searchParams.set('limit', String(LIMIT));
  // show_description=true is non-negotiable: with it false, the response is a
  // flat array of jobs WITHOUT the `id` field, which breaks idempotent ingest.
  url.searchParams.set('show_description', 'true');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`web3.career ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const payload = (await res.json()) as unknown;
  // With show_description=true the shape is [meta_string, help_string, [...jobs]].
  // Find the first inner-array — robust against future preamble shape changes.
  if (!Array.isArray(payload)) return [];
  const jobsArr = payload.find((x) => Array.isArray(x)) as unknown;
  return Array.isArray(jobsArr) ? (jobsArr as Web3CareerJob[]) : [];
}

export async function fetchWeb3CareerDryRun(
  opts: IngestOptions = {},
): Promise<DryRunResult> {
  const apiKey = process.env.WEB3_CAREER_API_KEY?.trim();
  if (!apiKey) {
    return {
      source: 'external',
      queriesRun: 0,
      fetched: 0,
      uniqueIds: 0,
      afterAgeFilter: 0,
      sample: [],
      error: 'WEB3_CAREER_API_KEY not configured',
    };
  }
  try {
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
    return {
      source: 'external',
      queriesRun: queries,
      fetched: all.length,
      uniqueIds: byId.size,
      afterAgeFilter: fresh.length,
      sample: fresh.slice(0, 3),
      error: null,
    };
  } catch (err) {
    return {
      source: 'external',
      queriesRun: 0,
      fetched: 0,
      uniqueIds: 0,
      afterAgeFilter: 0,
      sample: [],
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

// Idempotent on (source='external', external_id). De-duplicates across the
// multi-tag fan-out: the same job may appear under both 'solidity' and 'defi'.
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
      queriesRun: 0,
      error: 'WEB3_CAREER_API_KEY not configured',
    };
  }

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
      queriesRun: queries,
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  }

  if (opts.dryRun) {
    return {
      source: 'external',
      inserted: 0,
      updated: 0,
      skipped: byId.size,
      queriesRun: queries,
      error: null,
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();

  const ageCutoff = new Date(Date.now() - MAX_AGE_MS);

  for (const j of byId.values()) {
    const externalId = j.id?.toString();
    if (!externalId || !j.title || !j.apply_url) {
      skipped += 1;
      continue;
    }

    const epoch = typeof j.date_epoch === 'number' ? j.date_epoch * 1000 : null;
    const dateParsed = j.date ? new Date(j.date).getTime() : null;
    const postedMs = epoch ?? dateParsed;
    if (postedMs !== null && !Number.isNaN(postedMs) && postedMs < ageCutoff.getTime()) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.jobListing.findFirst({
      where: { source: 'external', external_id: externalId },
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

    // Prefer the split city/country fields when available — they're cleaner
    // than the joined location string which often has leading whitespace.
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

    await prisma.jobListing.create({
      data: {
        source: 'external',
        external_id: externalId,
        // web3.career returns company as a bare string — no logo/website.
        company_name: j.company ?? null,
        company_logo: null,
        company_website: null,
        company_tags: [],
        title: j.title.trim(),
        short_description: (j.description ?? j.title)
          .replace(/<[^>]*>/g, '')
          .slice(0, 280),
        description: j.description ?? null,
        location: locationDisplay,
        remote_type: j.is_remote ? 'remote' : null,
        employment_type: null,
        seniority: null,
        tags: (j.tags ?? []).slice(0, 10),
        // ToS: use apply_url verbatim; do NOT add nofollow on the rendered link.
        apply_url: cleanApplyUrl(j.apply_url),
        source_url: null,
        posted_at: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
        last_seen_at: now,
        is_active: false,
      },
    });
    inserted += 1;
  }

  return {
    source: 'external',
    inserted,
    updated,
    skipped,
    queriesRun: queries,
    error: null,
  };
}
