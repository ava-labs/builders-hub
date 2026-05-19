import pLimit from 'p-limit';
import {
  GETRO_HOST,
  fetchGetroOrganizationsAll,
  fetchGetroPage,
  type GetroPageData,
} from '@/lib/ecosystemCareers/getroSsr';
import { cleanApplyUrl } from '@/lib/ecosystemCareers/cleanApplyUrl';
import { htmlToPlainText, sanitizeJobHtml } from '@/lib/ecosystemCareers/sanitizeJobHtml';
import type {
  GetroJobDetail,
  GetroJobSummary,
  GetroJobsListPage,
  ScrapeResult,
  ScrapedCompany,
  ScrapedJob,
} from '@/lib/ecosystemCareers/getroTypes';

interface JobsInitialState {
  total?: number;
  found?: GetroJobSummary[];
  currentJob?: GetroJobDetail;
}

function readJobsState(page: GetroPageData): JobsInitialState {
  return (page.props?.pageProps?.initialState?.jobs ?? {}) as JobsInitialState;
}

function mapWorkModeToRemoteType(workMode: string | null | undefined): string | null {
  if (!workMode) return null;
  switch (workMode) {
    case 'remote':
      return 'remote';
    case 'on_site':
      return 'onsite';
    case 'hybrid':
      return 'hybrid';
    default:
      return null;
  }
}

function buildSourceUrl(orgSlug: string, jobSlug: string): string {
  return `${GETRO_HOST}/companies/${orgSlug}/jobs/${jobSlug}`;
}

function pickLocation(job: GetroJobSummary): string | null {
  const list = job.locations ?? [];
  return list.length > 0 ? list[0] : null;
}

function pickIndustryTags(org: GetroJobSummary['organization']): string[] {
  return (org.industryTags ?? [])
    .map((t) => (typeof t === 'string' ? t : t?.name))
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .slice(0, 10);
}

function summarySkillTags(job: GetroJobSummary): string[] {
  return (job.skills ?? []).filter(Boolean).slice(0, 6);
}

export interface ScrapeOptions {
  // Concurrency for per-job detail fetches
  concurrency?: number;
  // If set, signals abort to all in-flight fetches
  signal?: AbortSignal;
}

export async function scrapeGetroJobs(opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));

  // 1. Seed company directory from the public organizations/all endpoint.
  //    This gives us every company id/name/slug, even ones without active
  //    jobs.
  const orgIndex = new Map<string, { id: number; name: string }>();
  try {
    const all = await fetchGetroOrganizationsAll({ signal: opts.signal });
    for (const o of all) {
      orgIndex.set(o.slug, { id: o.id, name: o.name });
    }
  } catch (err) {
    // Non-fatal — we'll still derive companies from the jobs list below.
    console.warn('scrapeGetroJobs: organizations/all failed:', err);
  }

  // 2. Pull the SSR'd /jobs page — the __NEXT_DATA__ payload gives us up to
  //    20 most-recent jobs with rich organization metadata embedded.
  const jobsPage = await fetchGetroPage<GetroPageData>('/jobs', { signal: opts.signal });
  const jobsState = readJobsState(jobsPage) as JobsInitialState & GetroJobsListPage;
  const summaries: GetroJobSummary[] = jobsState.found ?? [];
  const total = jobsState.total ?? summaries.length;

  // 3. Fan out to per-job detail pages to pick up the full description +
  //    canonical apply URL.
  const limit = pLimit(concurrency);
  const detailed = await Promise.all(
    summaries.map((summary) =>
      limit(async () => {
        try {
          const detailPage = await fetchGetroPage<GetroPageData>(
            `/companies/${summary.organization.slug}/jobs/${summary.slug}`,
            { signal: opts.signal },
          );
          const detail = readJobsState(detailPage).currentJob as
            | GetroJobDetail
            | undefined;
          return { summary, detail: detail ?? null };
        } catch (err) {
          console.warn(
            `scrapeGetroJobs: detail fetch failed for ${summary.id}:`,
            err,
          );
          return { summary, detail: null };
        }
      }),
    ),
  );

  // 4. Reduce into our normalized shapes.
  const companiesById = new Map<string, ScrapedCompany>();
  const jobs: ScrapedJob[] = [];

  for (const { summary, detail } of detailed) {
    const org = summary.organization;

    // Ensure the company is recorded.
    if (!companiesById.has(org.slug)) {
      companiesById.set(org.slug, {
        externalSlug: org.slug,
        externalId: org.id,
        name: org.name,
        logoUrl: org.logoUrl ?? null,
        description: null,
        website: null,
        tags: pickIndustryTags(org),
        jobsCount: 0,
      });
    }
    const company = companiesById.get(org.slug)!;
    company.jobsCount += 1;

    const descriptionHtml = sanitizeJobHtml(detail?.description ?? '');
    const shortDescription = htmlToPlainText(detail?.description ?? '', 280);

    jobs.push({
      externalId: String(summary.id),
      companyExternalSlug: org.slug,
      title: summary.title,
      shortDescription: shortDescription || summary.title,
      description: descriptionHtml || null,
      location: pickLocation(summary),
      remoteType: mapWorkModeToRemoteType(summary.workMode),
      seniority: summary.seniority ?? null,
      tags: summarySkillTags(summary),
      applyUrl: cleanApplyUrl(detail?.url ?? summary.url),
      sourceUrl: buildSourceUrl(org.slug, summary.slug),
      postedAt: summary.createdAt ? new Date(summary.createdAt * 1000) : null,
    });
  }

  // Companies present in /organizations/all but without active jobs are skipped
  // (a careers board shouldn't list empty companies). We could choose to
  // surface them later as a directory view.

  return {
    companies: Array.from(companiesById.values()),
    jobs,
    total,
    fetched: summaries.length,
    authedFetchUsed: false,
  };
}
