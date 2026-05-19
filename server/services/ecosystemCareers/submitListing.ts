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

export class CompanyRejectedError extends Error {
  constructor(reason: string | null) {
    super(reason ?? 'This project has been rejected for ecosystem careers');
    this.name = 'CompanyRejectedError';
  }
}

export type CompanyAuthorizationStatus = 'pending' | 'approved' | 'rejected';

export interface EnsureCompanyResult {
  id: string;
  status: CompanyAuthorizationStatus;
  rejectionReason: string | null;
}

// Ensure a project-sourced EcosystemCompany row exists for this project and
// keep its denormalized fields in sync with the Project record. Called every
// time a user submits/edits a listing.
//
// New project-sourced rows start with authorization_status='pending'. The
// existing status is preserved on subsequent calls — denormalized fields are
// refreshed but the review state is left alone (admin owns transitions).
export async function ensureCompanyForProject(
  projectId: string,
): Promise<EnsureCompanyResult> {
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
      // New project-sourced rows enter the review queue.
      authorization_status: 'pending',
      last_seen_at: new Date(),
    },
    update: {
      name: project.project_name,
      logo_url: project.logo_url || null,
      description: project.short_description || null,
      website,
      tags,
      last_seen_at: new Date(),
      // NOTE: authorization_status is intentionally NOT touched on update —
      // only admins transition that.
    },
  });

  return {
    id: company.id,
    status: (company.authorization_status as CompanyAuthorizationStatus) ?? 'pending',
    rejectionReason: company.rejection_reason,
  };
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

  const company = await ensureCompanyForProject(input.project_id);
  if (company.status === 'rejected') {
    throw new CompanyRejectedError(company.rejectionReason);
  }

  const sanitizedDescription = sanitizeJobHtml(input.description) || null;
  const shortDescription = (input.short_description?.trim() ||
    htmlToPlainText(input.description, 280) ||
    input.title).slice(0, 280);

  const job = await prisma.jobListing.create({
    data: {
      source: 'project',
      company_id: company.id,
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
      // Listings under pending companies stay hidden until a devrel approves
      // the team; on approval, syncCompanyJobsCount is re-run and the
      // listings are flipped to active in one shot.
      is_active: company.status === 'approved',
    },
    select: { id: true },
  });

  await syncCompanyJobsCount(company.id);
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

  // Refresh denormalized company metadata in case the Project changed —
  // and inherit the company's current review status to decide whether the
  // edited listing publishes or stays queued.
  const company = await ensureCompanyForProject(projectId);
  if (company.status === 'rejected') {
    throw new CompanyRejectedError(company.rejectionReason);
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
      // If the company is still pending review, the listing stays hidden;
      // otherwise it's live.
      is_active: company.status === 'approved',
    },
  });
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

// Admin actions. Mutate the company's review state and propagate to its
// queued listings. Callers must enforce role checks (devrel) before invoking.

export async function approveCompany(
  companyId: string,
  reviewerUserId: string,
): Promise<{ activated: number }> {
  const company = await prisma.ecosystemCompany.findUnique({
    where: { id: companyId },
    select: { id: true, source: true, authorization_status: true },
  });
  if (!company) throw new Error('Company not found');
  if (company.source !== 'project') {
    throw new Error('Only project-sourced companies need approval');
  }

  await prisma.ecosystemCompany.update({
    where: { id: companyId },
    data: {
      authorization_status: 'approved',
      authorized_by_user_id: reviewerUserId,
      authorized_at: new Date(),
      rejection_reason: null,
    },
  });

  // Flip queued listings to active.
  const result = await prisma.jobListing.updateMany({
    where: { company_id: companyId, source: 'project', is_active: false },
    data: { is_active: true, last_seen_at: new Date() },
  });

  await syncCompanyJobsCount(companyId);
  return { activated: result.count };
}

export async function rejectCompany(
  companyId: string,
  reviewerUserId: string,
  reason: string | null,
): Promise<void> {
  const company = await prisma.ecosystemCompany.findUnique({
    where: { id: companyId },
    select: { id: true, source: true },
  });
  if (!company) throw new Error('Company not found');
  if (company.source !== 'project') {
    throw new Error('Only project-sourced companies can be rejected');
  }

  await prisma.ecosystemCompany.update({
    where: { id: companyId },
    data: {
      authorization_status: 'rejected',
      authorized_by_user_id: reviewerUserId,
      authorized_at: new Date(),
      rejection_reason: reason?.trim() || null,
    },
  });

  // Keep listings hidden — and freeze any active ones too.
  await prisma.jobListing.updateMany({
    where: { company_id: companyId, source: 'project', is_active: true },
    data: { is_active: false },
  });

  await syncCompanyJobsCount(companyId);
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
