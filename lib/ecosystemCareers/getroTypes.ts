// Shapes returned by jobs.avax.network's SSR'd Next.js pages (extracted from
// the __NEXT_DATA__ script tag). These are external; only the fields we
// actually consume are typed.

export interface GetroOrganization {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  headCount?: number | null;
  topics?: string[] | null;
  industryTags?: { id: number; name: string }[] | null;
  stage?: string | null;
}

export interface GetroJobSummary {
  id: number;
  slug: string;
  title: string;
  url: string;
  source?: string;
  workMode?: string | null;
  seniority?: string | null;
  skills?: string[] | null;
  locations?: string[] | null;
  searchableLocations?: string[] | null;
  createdAt?: number | null;
  hasDescription?: boolean;
  featured?: boolean;
  organization: GetroOrganization;
}

export interface GetroJobsListPage {
  total: number;
  found: GetroJobSummary[];
}

export interface GetroJobDetail extends GetroJobSummary {
  description?: string | null;
  applicationMethod?: string | null;
  applicationPath?: string | null;
}

export interface GetroCollectionOrganization {
  id: number;
  name: string;
  slug: string;
}

export interface ScrapedCompany {
  externalSlug: string;
  externalId: number | null;
  name: string;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  tags: string[];
  jobsCount: number;
}

export interface ScrapedJob {
  externalId: string;
  companyExternalSlug: string;
  title: string;
  shortDescription: string;
  description: string | null;
  location: string | null;
  remoteType: string | null;
  seniority: string | null;
  tags: string[];
  applyUrl: string;
  sourceUrl: string;
  postedAt: Date | null;
}

export interface ScrapeResult {
  companies: ScrapedCompany[];
  jobs: ScrapedJob[];
  total: number;
  fetched: number;
  authedFetchUsed: boolean;
}
