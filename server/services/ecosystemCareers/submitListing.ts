import { prisma } from '@/prisma/prisma';
import { cleanApplyUrl } from '@/lib/ecosystemCareers/cleanApplyUrl';
import { htmlToPlainText, sanitizeJobHtml } from '@/lib/ecosystemCareers/sanitizeJobHtml';
import { isUserProjectMember } from '@/server/services/fileValidation';

export const MAX_ACTIVE_LISTINGS_PER_PROJECT = 5;

export interface ListingInput {
  project_id: string;
  title: string;
  // Plain-text teaser (≤ 280 chars). If empty, derived from description.
  short_description?: string | null;
  // Rich HTML/markdown source. Sanitized server-side before storing.
  description: string;
  location?: string | null;
  remote_type?: 'remote' | 'onsite' | 'hybrid' | null;
  employment_type?: 'full_time' | 'contract' | 'part_time' | null;
  seniority?: string | null;
  tags?: string[];
  apply_url: string;
}

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized for this project') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class QuotaError extends Error {
  constructor(message = 'Too many active listings for this project') {
    super(message);
    this.name = 'QuotaError';
  }
}

// Ensure a project-sourced EcosystemCompany row exists for this project and
// keep its denormalized fields in sync with the Project record. Called every
// time a user submits/edits a listing.
export async function ensureCompanyForProject(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      project_name: true,
      short_description: true,
      logo_url: true,
      website: true,
      tags: true,
      tracks: true,
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const website =
    project.website && typeof project.website === 'object'
      ? extractFirstUrl(project.website as Record<string, unknown>)
      : null;
  const tags = dedupe([...(project.tags ?? []), ...(project.tracks ?? [])]).slice(0, 10);

  const company = await prisma.ecosystemCompany.upsert({
    where: { project_id: projectId },
    create: {
      source: 'project',
      project_id: projectId,
      name: project.project_name,
      logo_url: project.logo_url || null,
      description: project.short_description || null,
      website,
      tags,
      last_seen_at: new Date(),
    },
    update: {
      name: project.project_name,
      logo_url: project.logo_url || null,
      description: project.short_description || null,
      website,
      tags,
      last_seen_at: new Date(),
    },
  });

  return company.id;
}

export async function createListing(
  userId: string,
  input: ListingInput,
): Promise<{ id: string }> {
  if (!(await isUserProjectMember(userId, input.project_id))) {
    throw new AuthorizationError();
  }

  const activeCount = await prisma.jobListing.count({
    where: {
      source: 'project',
      is_active: true,
      company: { project_id: input.project_id },
    },
  });
  if (activeCount >= MAX_ACTIVE_LISTINGS_PER_PROJECT) {
    throw new QuotaError(
      `Each project can have at most ${MAX_ACTIVE_LISTINGS_PER_PROJECT} active listings`,
    );
  }

  const companyId = await ensureCompanyForProject(input.project_id);

  const sanitizedDescription = sanitizeJobHtml(input.description) || null;
  const shortDescription = (input.short_description?.trim() ||
    htmlToPlainText(input.description, 280) ||
    input.title).slice(0, 280);

  const job = await prisma.jobListing.create({
    data: {
      source: 'project',
      company_id: companyId,
      posted_by_user_id: userId,
      title: input.title.trim(),
      short_description: shortDescription,
      description: sanitizedDescription,
      location: trimOrNull(input.location),
      remote_type: input.remote_type ?? null,
      employment_type: input.employment_type ?? null,
      seniority: trimOrNull(input.seniority),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6),
      apply_url: cleanApplyUrl(input.apply_url.trim()),
      source_url: null,
      posted_at: new Date(),
      last_seen_at: new Date(),
      is_active: true,
    },
    select: { id: true },
  });

  await syncCompanyJobsCount(companyId);
  return job;
}

export async function updateListing(
  userId: string,
  listingId: string,
  input: ListingInput,
): Promise<void> {
  const existing = await prisma.jobListing.findUnique({
    where: { id: listingId },
    include: { company: { select: { project_id: true } } },
  });
  if (!existing) throw new AuthorizationError('Listing not found');
  if (existing.source !== 'project') {
    throw new AuthorizationError('Only project-sourced listings can be edited');
  }

  const projectId = existing.company.project_id;
  if (!projectId) throw new AuthorizationError('Listing has no linked project');

  const isOwnPost = existing.posted_by_user_id === userId;
  const isMember = await isUserProjectMember(userId, projectId);
  if (!isOwnPost && !isMember) throw new AuthorizationError();

  if (input.project_id !== projectId) {
    throw new AuthorizationError('Cannot move listing between projects');
  }

  const sanitizedDescription = sanitizeJobHtml(input.description) || null;
  const shortDescription = (input.short_description?.trim() ||
    htmlToPlainText(input.description, 280) ||
    input.title).slice(0, 280);

  await prisma.jobListing.update({
    where: { id: listingId },
    data: {
      title: input.title.trim(),
      short_description: shortDescription,
      description: sanitizedDescription,
      location: trimOrNull(input.location),
      remote_type: input.remote_type ?? null,
      employment_type: input.employment_type ?? null,
      seniority: trimOrNull(input.seniority),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6),
      apply_url: cleanApplyUrl(input.apply_url.trim()),
      last_seen_at: new Date(),
      is_active: true,
    },
  });

  // Refresh denormalized company metadata in case the Project changed.
  await ensureCompanyForProject(projectId);
}

export async function deactivateListing(
  userId: string,
  listingId: string,
): Promise<void> {
  const existing = await prisma.jobListing.findUnique({
    where: { id: listingId },
    include: { company: { select: { id: true, project_id: true } } },
  });
  if (!existing) throw new AuthorizationError('Listing not found');
  if (existing.source !== 'project') {
    throw new AuthorizationError('Only project-sourced listings can be deactivated here');
  }
  const projectId = existing.company.project_id;
  if (!projectId) throw new AuthorizationError('Listing has no linked project');

  const isOwnPost = existing.posted_by_user_id === userId;
  const isMember = await isUserProjectMember(userId, projectId);
  if (!isOwnPost && !isMember) throw new AuthorizationError();

  await prisma.jobListing.update({
    where: { id: listingId },
    data: { is_active: false },
  });

  await syncCompanyJobsCount(existing.company.id);
}

async function syncCompanyJobsCount(companyId: string): Promise<void> {
  const count = await prisma.jobListing.count({
    where: { company_id: companyId, is_active: true },
  });
  await prisma.ecosystemCompany.update({
    where: { id: companyId },
    data: { jobs_count: count },
  });
}

function extractFirstUrl(value: Record<string, unknown>): string | null {
  for (const v of Object.values(value)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v && v.trim())));
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
