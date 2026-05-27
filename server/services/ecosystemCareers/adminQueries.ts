import { prisma } from '@/prisma/prisma';

export interface PendingProjectRow {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  tags: string[];
  githubRepository: string | null;
  demoLink: string | null;
  createdAt: Date;
  pendingListings: {
    id: string;
    title: string;
    location: string | null;
    applyUrl: string;
    shortDescription: string;
    createdAt: Date;
    postedBy: { id: string; name: string | null; email: string | null } | null;
  }[];
}

function firstUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}

export async function listProjectsUnderReview(): Promise<PendingProjectRow[]> {
  // Surface unapproved projects that actually have a community listing waiting.
  // A project that just exists without a queued listing isn't a review item.
  return mapProjects(await loadPendingProjects());
}

export interface PendingListingRow {
  id: string;
  source: 'external' | 'getro';
  title: string;
  companyName: string | null;
  companyLogo: string | null;
  companyWebsite: string | null;
  location: string | null;
  applyUrl: string;
  shortDescription: string;
  postedAt: Date | null;
  createdAt: Date;
}

export async function listIngestedListingsUnderReview(): Promise<PendingListingRow[]> {
  const rows = await prisma.jobListing.findMany({
    where: {
      source: { in: ['external', 'getro'] },
      is_active: false,
    },
    orderBy: [{ posted_at: 'desc' }, { created_at: 'desc' }],
    select: {
      id: true,
      source: true,
      title: true,
      company_name: true,
      company_logo: true,
      company_website: true,
      location: true,
      apply_url: true,
      short_description: true,
      posted_at: true,
      created_at: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    source: r.source as 'external' | 'getro',
    title: r.title,
    companyName: r.company_name,
    companyLogo: r.company_logo,
    companyWebsite: r.company_website,
    location: r.location,
    applyUrl: r.apply_url,
    shortDescription: r.short_description,
    postedAt: r.posted_at,
    createdAt: r.created_at,
  }));
}

type ProjectQueryResult = Awaited<ReturnType<typeof loadPendingProjects>>;

async function loadPendingProjects() {
  return prisma.project.findMany({
    where: {
      careers_approved: false,
      jobListings: { some: { source: 'community', is_active: false } },
    },
    orderBy: { updated_at: 'asc' },
    select: {
      id: true,
      project_name: true,
      short_description: true,
      logo_url: true,
      website: true,
      tags: true,
      tracks: true,
      github_repository: true,
      demo_link: true,
      created_at: true,
      jobListings: {
        where: { source: 'community', is_active: false },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          title: true,
          location: true,
          apply_url: true,
          short_description: true,
          created_at: true,
          posted_by_user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

function mapProjects(projects: ProjectQueryResult): PendingProjectRow[] {
  return projects.map((p) => ({
    id: p.id,
    name: p.project_name,
    logoUrl: p.logo_url || null,
    description: p.short_description || null,
    website: firstUrl(p.website),
    tags: Array.from(new Set([...(p.tags ?? []), ...(p.tracks ?? [])])).slice(0, 10),
    githubRepository: p.github_repository || null,
    demoLink: p.demo_link || null,
    createdAt: p.created_at,
    pendingListings: p.jobListings.map((j) => ({
      id: j.id,
      title: j.title,
      location: j.location,
      applyUrl: j.apply_url,
      shortDescription: j.short_description,
      createdAt: j.created_at,
      postedBy: j.posted_by_user
        ? { id: j.posted_by_user.id, name: j.posted_by_user.name, email: j.posted_by_user.email }
        : null,
    })),
  }));
}
