import { prisma } from '@/prisma/prisma';
import { scrapeGetroJobs, type ScrapeOptions } from './scrapeGetro';
import type { ScrapedCompany, ScrapedJob } from '@/lib/ecosystemCareers/getroTypes';

const STALE_DAYS = 7;

export interface IngestResult {
  companiesUpserted: number;
  jobsUpserted: number;
  jobsDeactivated: number;
  totalAvailable: number;
  totalFetched: number;
  durationMs: number;
}

export async function ingestGetro(opts: ScrapeOptions = {}): Promise<IngestResult> {
  const t0 = Date.now();
  const scrape = await scrapeGetroJobs(opts);

  const companiesUpserted = await upsertCompanies(scrape.companies);
  const companyIdBySlug = await loadCompanyIdMap();
  const jobsUpserted = await upsertJobs(scrape.jobs, companyIdBySlug);
  const jobsDeactivated = await deactivateStaleJobs(STALE_DAYS);

  return {
    companiesUpserted,
    jobsUpserted,
    jobsDeactivated,
    totalAvailable: scrape.total,
    totalFetched: scrape.fetched,
    durationMs: Date.now() - t0,
  };
}

async function upsertCompanies(companies: ScrapedCompany[]): Promise<number> {
  let count = 0;
  for (const c of companies) {
    await prisma.ecosystemCompany.upsert({
      where: {
        source_external_slug: {
          source: 'getro',
          external_slug: c.externalSlug,
        },
      },
      create: {
        source: 'getro',
        external_slug: c.externalSlug,
        name: c.name,
        logo_url: c.logoUrl,
        description: c.description,
        website: c.website,
        tags: c.tags,
        jobs_count: c.jobsCount,
        last_seen_at: new Date(),
      },
      update: {
        name: c.name,
        logo_url: c.logoUrl,
        description: c.description,
        website: c.website,
        tags: c.tags,
        jobs_count: c.jobsCount,
        last_seen_at: new Date(),
      },
    });
    count++;
  }
  return count;
}

async function loadCompanyIdMap(): Promise<Map<string, string>> {
  const rows = await prisma.ecosystemCompany.findMany({
    where: { source: 'getro' },
    select: { id: true, external_slug: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.external_slug) map.set(r.external_slug, r.id);
  }
  return map;
}

async function upsertJobs(
  jobs: ScrapedJob[],
  companyIdBySlug: Map<string, string>,
): Promise<number> {
  let count = 0;
  for (const j of jobs) {
    const companyId = companyIdBySlug.get(j.companyExternalSlug);
    if (!companyId) {
      console.warn(`ingestGetro: no company row for slug ${j.companyExternalSlug}; skipping job ${j.externalId}`);
      continue;
    }
    await prisma.jobListing.upsert({
      where: {
        source_external_id: { source: 'getro', external_id: j.externalId },
      },
      create: {
        source: 'getro',
        external_id: j.externalId,
        company_id: companyId,
        title: j.title,
        short_description: j.shortDescription,
        description: j.description,
        location: j.location,
        remote_type: j.remoteType,
        seniority: j.seniority,
        tags: j.tags,
        apply_url: j.applyUrl,
        source_url: j.sourceUrl,
        posted_at: j.postedAt,
        last_seen_at: new Date(),
        is_active: true,
      },
      update: {
        company_id: companyId,
        title: j.title,
        short_description: j.shortDescription,
        description: j.description,
        location: j.location,
        remote_type: j.remoteType,
        seniority: j.seniority,
        tags: j.tags,
        apply_url: j.applyUrl,
        source_url: j.sourceUrl,
        posted_at: j.postedAt,
        last_seen_at: new Date(),
        is_active: true,
      },
    });
    count++;
  }
  return count;
}

async function deactivateStaleJobs(staleDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  const result = await prisma.jobListing.updateMany({
    where: {
      source: 'getro',
      is_active: true,
      last_seen_at: { lt: cutoff },
    },
    data: { is_active: false },
  });
  return result.count;
}
