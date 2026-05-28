import { prisma } from '@/prisma/prisma';
import { cleanApplyUrl } from '@/lib/ecosystem-careers/cleanApplyUrl';
import { htmlToPlainText, sanitizeJobHtml } from '@/lib/ecosystem-careers/sanitizeJobHtml';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { captureServerEvent } from '@/lib/posthog-server';

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

async function loadProjectCareersApproved(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { careers_approved: true },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.careers_approved;
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

  const approved = await loadProjectCareersApproved(input.project_id);

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
      apply_url: cleanApplyUrl(input.apply_url.trim()),
      source_url: null,
      posted_at: new Date(),
      last_seen_at: new Date(),
      // Hidden until devrel approves the project; flipped live in bulk on approve.
      is_active: approved,
    },
    select: { id: true },
  });

  void captureServerEvent(
    'careers_listing_submitted',
    {
      listing_id: job.id,
      project_id: input.project_id,
      requires_review: !approved,
      remote_type: input.remote_type ?? null,
      employment_type: input.employment_type ?? null,
    },
    userId,
  );

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

  const approved = await loadProjectCareersApproved(projectId);

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
      is_active: approved,
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

// Admin action — devrel-gated. Approves the project for careers and
// activates every queued community listing under it in one shot.
export async function approveProjectForCareers(
  projectId: string,
): Promise<{ activated: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new Error('Project not found');

  await prisma.project.update({
    where: { id: projectId },
    data: { careers_approved: true },
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

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
