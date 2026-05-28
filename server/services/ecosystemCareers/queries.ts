import { prisma } from '@/prisma/prisma';
import { firstUrl } from '@/lib/ecosystem-careers/firstUrl';

export type ListingSource = 'community' | 'external' | 'legacy' | 'getro';

const LEGACY_MAX_AGE_MS = 10 * 30 * 24 * 60 * 60 * 1000;

function legacyAgeCutoff(): Date {
  return new Date(Date.now() - LEGACY_MAX_AGE_MS);
}

function notStaleLegacy() {
  return {
    OR: [
      { source: { not: 'legacy' as const } },
      { posted_at: { gte: legacyAgeCutoff() } },
    ],
  };
}

export interface DisplayCompany {
  id: string | null;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  website: string | null;
  tags: string[];
  description: string | null;
}

export interface JobCard {
  id: string;
  source: ListingSource;
  title: string;
  shortDescription: string;
  location: string | null;
  remoteType: string | null;
  seniority: string | null;
  tags: string[];
  postedAt: Date | string | null;
  applyUrl: string;
  sourceUrl: string | null;
  company: DisplayCompany;
}

export type SerializableJobCard = Omit<JobCard, 'postedAt'> & {
  postedAt: string | null;
};

export interface JobDetail extends JobCard {
  description: string | null;
}

export function toSerializableJob(job: JobCard): SerializableJobCard {
  return {
    ...job,
    postedAt: job.postedAt instanceof Date ? job.postedAt.toISOString() : job.postedAt,
  };
}

type JobRow = Awaited<ReturnType<typeof prisma.jobListing.findFirst>> & {
  project: Awaited<ReturnType<typeof prisma.project.findFirst>> | null;
};

function projectTags(project: NonNullable<JobRow['project']>): string[] {
  const all = [...(project.tags ?? []), ...(project.tracks ?? [])];
  return Array.from(new Set(all.filter((t) => t && t.trim()))).slice(0, 10);
}

function toCompany(row: NonNullable<JobRow>): DisplayCompany {
  if (row.source === 'community' && row.project) {
    return {
      id: row.project.id,
      name: row.project.project_name,
      slug: null,
      logoUrl: row.project.logo_url || null,
      website: firstUrl(row.project.website),
      tags: projectTags(row.project),
      description: row.project.short_description || null,
    };
  }
  return {
    id: null,
    name: row.company_name ?? 'Unknown',
    slug: null,
    logoUrl: row.company_logo ?? null,
    website: row.company_website ?? null,
    tags: row.company_tags ?? [],
    description: null,
  };
}

function toJobCard(row: NonNullable<JobRow>): JobCard {
  return {
    id: row.id,
    source: row.source as ListingSource,
    title: row.title,
    shortDescription: row.short_description,
    location: row.location,
    remoteType: row.remote_type,
    seniority: row.seniority,
    tags: row.tags,
    postedAt: row.posted_at,
    applyUrl: row.apply_url,
    sourceUrl: row.source_url,
    company: toCompany(row),
  };
}

export interface ListActiveJobsOptions {
  search?: string;
  companyName?: string;
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

  const where: any = { is_active: true, rejected_at: null, AND: [notStaleLegacy()] };
  if (opts.remoteType) where.remote_type = opts.remoteType;
  if (opts.seniority) where.seniority = opts.seniority;

  if (opts.companyName?.trim()) {
    const name = opts.companyName.trim();
    where.OR = [
      { company_name: { equals: name, mode: 'insensitive' } },
      { project: { project_name: { equals: name, mode: 'insensitive' } } },
    ];
  }

  if (opts.search?.trim()) {
    const q = opts.search.trim();
    const searchClauses = [
      { title: { contains: q, mode: 'insensitive' as const } },
      { short_description: { contains: q, mode: 'insensitive' as const } },
      { location: { contains: q, mode: 'insensitive' as const } },
      { tags: { has: q } },
      { company_name: { contains: q, mode: 'insensitive' as const } },
      { project: { project_name: { contains: q, mode: 'insensitive' as const } } },
    ];
    if (where.OR) {
      where.AND.push({ OR: where.OR });
      delete where.OR;
      where.AND.push({ OR: searchClauses });
    } else {
      where.OR = searchClauses;
    }
  }

  const [rows, total] = await Promise.all([
    prisma.jobListing.findMany({
      where,
      orderBy: [{ posted_at: 'desc' }, { created_at: 'desc' }],
      take: limit,
      skip: offset,
      include: { project: true },
    }),
    prisma.jobListing.count({ where }),
  ]);

  return {
    total,
    jobs: rows.map((r) => toJobCard(r as NonNullable<JobRow>)),
  };
}

export interface CompanyOption {
  id: string;
  name: string;
  logoUrl: string | null;
  jobsCount: number;
}

export async function listCompaniesWithActiveJobs(): Promise<CompanyOption[]> {
  const cutoff = legacyAgeCutoff();
  const [byProject, byName] = await Promise.all([
    prisma.jobListing.groupBy({
      by: ['project_id'],
      where: { is_active: true, source: 'community', project_id: { not: null } },
      _count: { _all: true },
    }),
    prisma.jobListing.groupBy({
      by: ['company_name'],
      where: {
        is_active: true,
        source: { in: ['external', 'legacy', 'getro'] },
        company_name: { not: null },
        OR: [
          { source: { not: 'legacy' } },
          { posted_at: { gte: cutoff } },
        ],
      },
      _count: { _all: true },
    }),
  ]);

  const projectIds = byProject
    .map((g) => g.project_id)
    .filter((id): id is string => !!id);
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, project_name: true, logo_url: true },
      })
    : [];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const externalNames = byName
    .map((g) => g.company_name)
    .filter((n): n is string => !!n);
  const externalLogos = externalNames.length
    ? await prisma.jobListing.findMany({
        where: { company_name: { in: externalNames }, company_logo: { not: null } },
        select: { company_name: true, company_logo: true },
        distinct: ['company_name'],
      })
    : [];
  const logoByName = new Map(externalLogos.map((r) => [r.company_name!, r.company_logo!]));

  const out: CompanyOption[] = [];
  for (const g of byProject) {
    const p = g.project_id ? projectById.get(g.project_id) : null;
    if (!p) continue;
    out.push({
      id: p.id,
      name: p.project_name,
      logoUrl: p.logo_url || null,
      jobsCount: g._count._all,
    });
  }
  for (const g of byName) {
    if (!g.company_name) continue;
    out.push({
      id: `name:${g.company_name}`,
      name: g.company_name,
      logoUrl: logoByName.get(g.company_name) ?? null,
      jobsCount: g._count._all,
    });
  }
  return out.sort((a, b) => b.jobsCount - a.jobsCount || a.name.localeCompare(b.name));
}

export async function getJobById(id: string): Promise<JobDetail | null> {
  const row = await prisma.jobListing.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!row || !row.is_active || row.rejected_at) return null;
  if (
    row.source === 'legacy' &&
    (!row.posted_at || row.posted_at < legacyAgeCutoff())
  ) {
    return null;
  }
  return { ...toJobCard(row as NonNullable<JobRow>), description: row.description };
}

export async function listMoreJobsFromSameCompany(
  job: { id: string; source: ListingSource; project_id: string | null; company_name: string | null },
  limit = 5,
): Promise<JobCard[]> {
  let where: any;
  if (job.source === 'community' && job.project_id) {
    where = { source: 'community', project_id: job.project_id, is_active: true, rejected_at: null, NOT: { id: job.id } };
  } else if (job.company_name) {
    where = {
      source: { in: ['external', 'legacy', 'getro'] },
      company_name: job.company_name,
      is_active: true,
      rejected_at: null,
      NOT: { id: job.id },
      AND: [notStaleLegacy()],
    };
  } else {
    return [];
  }
  const rows = await prisma.jobListing.findMany({
    where,
    orderBy: [{ posted_at: 'desc' }, { created_at: 'desc' }],
    take: limit,
    include: { project: true },
  });
  return rows.map((r) => toJobCard(r as NonNullable<JobRow>));
}

export interface UserOwnedProject {
  id: string;
  project_name: string;
  logo_url: string | null;
  careers_approved: boolean;
}

export interface UserListingsResult {
  ownProjects: UserOwnedProject[];
  listings: (JobCard & {
    isActive: boolean;
    careersApproved: boolean;
  })[];
}

export async function listListingsForUser(userId: string): Promise<UserListingsResult> {
  const memberRows = await prisma.member.findMany({
    where: { user_id: userId, status: 'Confirmed' },
    select: {
      project: {
        select: {
          id: true,
          project_name: true,
          logo_url: true,
          careers_approved: true,
        },
      },
    },
  });
  type MemberProject = NonNullable<(typeof memberRows)[number]['project']>;
  const ownProjects: UserOwnedProject[] = memberRows
    .map((m) => m.project)
    .filter((p): p is MemberProject => p !== null)
    .map((p) => ({
      id: p.id,
      project_name: p.project_name,
      logo_url: p.logo_url || null,
      careers_approved: p.careers_approved,
    }));
  const projectIds = ownProjects.map((p) => p.id);

  const orClauses: any[] = [{ posted_by_user_id: userId }];
  if (projectIds.length > 0) {
    orClauses.push({ project_id: { in: projectIds } });
  }
  const rows = await prisma.jobListing.findMany({
    where: { source: 'community', OR: orClauses },
    include: { project: true },
    orderBy: [{ is_active: 'desc' }, { posted_at: 'desc' }, { created_at: 'desc' }],
  });

  return {
    ownProjects,
    listings: rows.map((row) => ({
      ...toJobCard(row as NonNullable<JobRow>),
      isActive: row.is_active,
      careersApproved: row.project?.careers_approved ?? false,
    })),
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
    include: { project: true },
  });
  if (!row || row.source !== 'community' || !row.project_id) return null;

  const isOwnPost = row.posted_by_user_id === userId;
  const member = await prisma.member.findFirst({
    where: { project_id: row.project_id, user_id: userId, status: 'Confirmed' },
  });
  if (!isOwnPost && !member) return null;

  return {
    ...toJobCard(row as NonNullable<JobRow>),
    description: row.description,
    projectId: row.project_id,
    isActive: row.is_active,
    employmentType: row.employment_type,
  };
}
