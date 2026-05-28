import { prisma } from '@/prisma/prisma';
import { firstUrl } from '@/lib/ecosystem-careers/firstUrl';

export interface PendingProjectRow {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  fullDescription: string | null;
  website: string | null;
  xAccount: string | null;
  linkedinAccount: string | null;
  githubAccount: string | null;
  demoLink: string | null;
  tags: string[];
  categories: string[];
  techStack: string | null;
  createdAt: Date;
  members: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    image: string | null;
  }[];
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

function readSocial(socials: unknown, key: string): string | null {
  if (!socials || typeof socials !== 'object') return null;
  const value = (socials as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
      full_description: true,
      logo_url: true,
      website: true,
      socials: true,
      tags: true,
      tracks: true,
      categories: true,
      tech_stack: true,
      github_repository: true,
      demo_link: true,
      created_at: true,
      members: {
        where: { status: 'Confirmed' },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
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
    fullDescription: p.full_description || null,
    website: firstUrl(p.website),
    xAccount: readSocial(p.socials, 'x'),
    linkedinAccount: readSocial(p.socials, 'linkedin'),
    // Prefer the social-form value; fall back to the older hackathon-era
    // github_repository column so projects created via the older flows
    // still expose their repo link.
    githubAccount: readSocial(p.socials, 'github') ?? p.github_repository ?? null,
    demoLink: p.demo_link || null,
    tags: Array.from(new Set([...(p.tags ?? []), ...(p.tracks ?? [])])).slice(0, 10),
    categories: p.categories ?? [],
    techStack: p.tech_stack || null,
    createdAt: p.created_at,
    members: p.members
      .filter((m) => m.user !== null)
      .map((m) => ({
        id: m.user!.id,
        name: m.user!.name,
        email: m.user!.email,
        role: m.role,
        image: m.user!.image ?? null,
      })),
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
