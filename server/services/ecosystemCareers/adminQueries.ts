import { prisma } from '@/prisma/prisma';

export interface PendingCompanyRow {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  tags: string[];
  createdAt: Date;
  project: {
    id: string;
    name: string;
    githubRepository: string | null;
    demoLink: string | null;
  } | null;
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

export async function listCompaniesUnderReview(): Promise<PendingCompanyRow[]> {
  const rows = await prisma.ecosystemCompany.findMany({
    where: { source: 'project', authorization_status: 'pending' },
    orderBy: { created_at: 'asc' },
    include: {
      project: {
        select: {
          id: true,
          project_name: true,
          github_repository: true,
          demo_link: true,
        },
      },
      jobs: {
        where: { is_active: false },
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

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    logoUrl: r.logo_url,
    description: r.description,
    website: r.website,
    tags: r.tags,
    createdAt: r.created_at,
    project: r.project
      ? {
          id: r.project.id,
          name: r.project.project_name,
          githubRepository: r.project.github_repository,
          demoLink: r.project.demo_link,
        }
      : null,
    pendingListings: r.jobs.map((j) => ({
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
