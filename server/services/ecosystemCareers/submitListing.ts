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

export class ProjectRejectedError extends Error {
  constructor(reason: string | null) {
    super(reason ?? 'This project has been rejected for ecosystem careers');
    this.name = 'ProjectRejectedError';
  }
}

export type CareersAuthorizationStatus = 'pending' | 'approved' | 'rejected';

// Helper that resolves the Project's current careers review state. Side
// effect: if the project hasn't been through the careers funnel yet (still
// 'approved' by default but never marked pending/approved by a devrel for a
// careers submission), we leave it alone — the default keeps existing
// hackathon projects unaffected.
//
// First-time community submissions explicitly transition the project to
// 'pending' below.
async function loadProjectCareersStatus(
  projectId: string,
): Promise<{ status: CareersAuthorizationStatus; rejection_reason: string | null }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      careers_authorization_status: true,
      careers_rejection_reason: true,
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);
  return {
    status: (project.careers_authorization_status as CareersAuthorizationStatus) ?? 'approved',
    rejection_reason: project.careers_rejection_reason ?? null,
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
      source: 'community',
      is_active: true,
      project_id: input.project_id,
    },
  });
  if (activeCount >= MAX_ACTIVE_LISTINGS_PER_PROJECT) {
    throw new QuotaError(
      `Each project can have at most ${MAX_ACTIVE_LISTINGS_PER_PROJECT} active listings`,
    );
  }

  // First community submission for a project flips its careers status to
  // 'pending' (default is 'approved' for unrelated hackathon projects, so we
  // only narrow when we see an explicit non-pending/non-rejected state AND
  // no prior community listing). Subsequent submissions inherit the current
  // status.
  const existingCommunity = await prisma.jobListing.count({
    where: { source: 'community', project_id: input.project_id },
  });
  if (existingCommunity === 0) {
    await prisma.project.update({
      where: { id: input.project_id },
      data: { careers_authorization_status: 'pending' },
    });
  }

  const status = await loadProjectCareersStatus(input.project_id);
  if (status.status === 'rejected') {
    throw new ProjectRejectedError(status.rejection_reason);
  }

  const sanitizedDescription = sanitizeJobHtml(input.description) || null;
  const shortDescription = (input.short_description?.trim() ||
    htmlToPlainText(input.description, 280) ||
    input.title).slice(0, 280);

  const job = await prisma.jobListing.create({
    data: {
      source: 'community',
      project_id: input.project_id,
      posted_by_user_id: userId,
      title: input.title.trim(),
      short_description: shortDescription,
      description: sanitizedDescription,
      location: trimOrNull(input.location),
      remote_type: input.remote_type ?? null,
      employment_type: input.employment_type ?? null,
      seniority: trimOrNull(input.seniority),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6),
      // Community listings: apply URL is whatever the user provided; clean
      // it of typical UTM noise (cleanApplyUrl is the existing helper).
      apply_url: cleanApplyUrl(input.apply_url.trim()),
      source_url: null,
      posted_at: new Date(),
      last_seen_at: new Date(),
      // Hidden while the team is in review; flipped live in bulk on approve.
      is_active: status.status === 'approved',
    },
    select: { id: true },
  });

  return job;
}

export async function updateListing(
  userId: string,
  listingId: string,
  input: ListingInput,
): Promise<void> {
  const existing = await prisma.jobListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      source: true,
      project_id: true,
      posted_by_user_id: true,
    },
  });
  if (!existing) throw new AuthorizationError('Listing not found');
  if (existing.source !== 'community') {
    throw new AuthorizationError('Only community-sourced listings can be edited');
  }
  const projectId = existing.project_id;
  if (!projectId) throw new AuthorizationError('Listing has no linked project');

  const isOwnPost = existing.posted_by_user_id === userId;
  const isMember = await isUserProjectMember(userId, projectId);
  if (!isOwnPost && !isMember) throw new AuthorizationError();

  if (input.project_id !== projectId) {
    throw new AuthorizationError('Cannot move listing between projects');
  }

  const status = await loadProjectCareersStatus(projectId);
  if (status.status === 'rejected') {
    throw new ProjectRejectedError(status.rejection_reason);
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
      is_active: status.status === 'approved',
    },
  });
}

export async function deactivateListing(
  userId: string,
  listingId: string,
): Promise<void> {
  const existing = await prisma.jobListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      source: true,
      project_id: true,
      posted_by_user_id: true,
    },
  });
  if (!existing) throw new AuthorizationError('Listing not found');
  if (existing.source !== 'community') {
    throw new AuthorizationError('Only community-sourced listings can be deactivated here');
  }
  const projectId = existing.project_id;
  if (!projectId) throw new AuthorizationError('Listing has no linked project');

  const isOwnPost = existing.posted_by_user_id === userId;
  const isMember = await isUserProjectMember(userId, projectId);
  if (!isOwnPost && !isMember) throw new AuthorizationError();

  await prisma.jobListing.update({
    where: { id: listingId },
    data: { is_active: false },
  });
}

// Admin actions — devrel-gated. Mutate the Project's careers review state
// and propagate to all queued community listings under it.

export async function approveProjectForCareers(
  projectId: string,
  reviewerUserId: string,
): Promise<{ activated: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, careers_authorization_status: true },
  });
  if (!project) throw new Error('Project not found');

  await prisma.project.update({
    where: { id: projectId },
    data: {
      careers_authorization_status: 'approved',
      careers_authorized_by_user_id: reviewerUserId,
      careers_authorized_at: new Date(),
      careers_rejection_reason: null,
    },
  });

  const result = await prisma.jobListing.updateMany({
    where: {
      project_id: projectId,
      source: 'community',
      is_active: false,
    },
    data: { is_active: true, last_seen_at: new Date() },
  });
  return { activated: result.count };
}

export async function rejectProjectForCareers(
  projectId: string,
  reviewerUserId: string,
  reason: string | null,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new Error('Project not found');

  await prisma.project.update({
    where: { id: projectId },
    data: {
      careers_authorization_status: 'rejected',
      careers_authorized_by_user_id: reviewerUserId,
      careers_authorized_at: new Date(),
      careers_rejection_reason: reason?.trim() || null,
    },
  });

  await prisma.jobListing.updateMany({
    where: { project_id: projectId, source: 'community', is_active: true },
    data: { is_active: false },
  });
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
