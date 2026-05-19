import { prisma } from '@/prisma/prisma';

export interface JobCard {
  id: string;
  title: string;
  shortDescription: string;
  location: string | null;
  remoteType: string | null;
  seniority: string | null;
  tags: string[];
  // String when crossing the server→client boundary, Date when used server-side.
  postedAt: Date | string | null;
  applyUrl: string;
  source: string;
  sourceUrl: string | null;
  company: {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
    tags: string[];
  };
}

export type SerializableJobCard = Omit<JobCard, 'postedAt'> & {
  postedAt: string | null;
};

export interface JobDetail extends JobCard {
  description: string | null;
  company: JobCard['company'] & {
    description: string | null;
    website: string | null;
  };
}

export function toSerializableJob(job: JobCard): SerializableJobCard {
  return {
    ...job,
    postedAt: job.postedAt instanceof Date ? job.postedAt.toISOString() : job.postedAt,
  };
}

export interface ListActiveJobsOptions {
  search?: string;
  companyId?: string;
  remoteType?: string;
  seniority?: string;
  limit?: number;
  offset?: number;
}

export interface ListActiveJobsResult {
  total: number;
  jobs: JobCard[];
}

export async function listActiveJobs(
  opts: ListActiveJobsOptions = {},
): Promise<ListActiveJobsResult> {
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const where: any = { is_active: true };
  if (opts.companyId) where.company_id = opts.companyId;
  if (opts.remoteType) where.remote_type = opts.remoteType;
  if (opts.seniority) where.seniority = opts.seniority;

  if (opts.search?.trim()) {
    const q = opts.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { short_description: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
      { company: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.jobListing.findMany({
      where,
      orderBy: [{ posted_at: 'desc' }, { created_at: 'desc' }],
      take: limit,
      skip: offset,
      include: { company: true },
    }),
    prisma.jobListing.count({ where }),
  ]);

  return {
    total,
    jobs: rows.map(toJobCard),
  };
}

export interface CompanyOption {
  id: string;
  name: string;
  logoUrl: string | null;
  jobsCount: number;
}

export async function listCompaniesWithActiveJobs(): Promise<CompanyOption[]> {
  const groups = await prisma.jobListing.groupBy({
    by: ['company_id'],
    where: { is_active: true },
    _count: { _all: true },
  });
  const ids = groups.map((g) => g.company_id);
  if (ids.length === 0) return [];
  const companies = await prisma.ecosystemCompany.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, logo_url: true },
  });
  const byId = new Map(companies.map((c) => [c.id, c]));
  return groups
    .map((g) => {
      const c = byId.get(g.company_id);
      if (!c) return null;
      return {
        id: c.id,
        name: c.name,
        logoUrl: c.logo_url,
        jobsCount: g._count._all,
      };
    })
    .filter((x): x is CompanyOption => x !== null)
    .sort((a, b) => b.jobsCount - a.jobsCount || a.name.localeCompare(b.name));
}

export async function getJobById(id: string): Promise<JobDetail | null> {
  const row = await prisma.jobListing.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!row || !row.is_active) return null;
  const base = toJobCard(row);
  return {
    ...base,
    description: row.description,
    company: {
      ...base.company,
      description: row.company.description,
      website: row.company.website,
    },
  };
}

export interface UserListingsResult {
  ownProjects: { id: string; project_name: string; logo_url: string | null }[];
  listings: (JobCard & { isActive: boolean })[];
}

export async function listListingsForUser(userId: string): Promise<UserListingsResult> {
  // All Projects the user is a confirmed member of (used as the "post a job"
  // dropdown source AND as an auth signal for editing co-team listings).
  const memberRows = await prisma.member.findMany({
    where: { user_id: userId, status: 'Confirmed' },
    select: { project: { select: { id: true, project_name: true, logo_url: true } } },
  });
  const ownProjects = memberRows
    .map((m) => m.project)
    .filter((p): p is { id: string; project_name: string; logo_url: string | null } => p !== null);
  const projectIds = ownProjects.map((p) => p.id);

  const orClauses: any[] = [{ posted_by_user_id: userId }];
  if (projectIds.length > 0) {
    orClauses.push({ company: { project_id: { in: projectIds } } });
  }
  const rows = await prisma.jobListing.findMany({
    where: { source: 'project', OR: orClauses },
    include: { company: true },
    orderBy: [{ is_active: 'desc' }, { posted_at: 'desc' }, { created_at: 'desc' }],
  });

  return {
    ownProjects,
    listings: rows.map((row) => ({ ...toJobCard(row), isActive: row.is_active })),
  };
}

export async function getListingForEdit(
  listingId: string,
  userId: string,
): Promise<
  | (JobCard & {
      description: string | null;
      projectId: string | null;
      isActive: boolean;
      employmentType: string | null;
    })
  | null
> {
  const row = await prisma.jobListing.findUnique({
    where: { id: listingId },
    include: { company: true },
  });
  if (!row || row.source !== 'project') return null;
  const projectId = row.company.project_id;
  if (!projectId) return null;

  const isOwnPost = row.posted_by_user_id === userId;
  const member = await prisma.member.findFirst({
    where: { project_id: projectId, user_id: userId, status: 'Confirmed' },
  });
  if (!isOwnPost && !member) return null;

  return {
    ...toJobCard(row),
    description: row.description,
    projectId,
    isActive: row.is_active,
    employmentType: row.employment_type,
  };
}

export async function listMoreJobsFromCompany(
  companyId: string,
  excludeJobId: string,
  limit = 5,
): Promise<JobCard[]> {
  const rows = await prisma.jobListing.findMany({
    where: { company_id: companyId, is_active: true, NOT: { id: excludeJobId } },
    orderBy: [{ posted_at: 'desc' }, { created_at: 'desc' }],
    take: limit,
    include: { company: true },
  });
  return rows.map(toJobCard);
}

type JobRowWithCompany = Awaited<ReturnType<typeof prisma.jobListing.findFirst>> &
  { company: Awaited<ReturnType<typeof prisma.ecosystemCompany.findFirst>> };

function toJobCard(row: NonNullable<JobRowWithCompany>): JobCard {
  return {
    id: row.id,
    title: row.title,
    shortDescription: row.short_description,
    location: row.location,
    remoteType: row.remote_type,
    seniority: row.seniority,
    tags: row.tags,
    postedAt: row.posted_at,
    applyUrl: row.apply_url,
    source: row.source,
    sourceUrl: row.source_url,
    company: {
      id: row.company!.id,
      name: row.company!.name,
      slug: row.company!.external_slug,
      logoUrl: row.company!.logo_url,
      tags: row.company!.tags,
    },
  };
}
