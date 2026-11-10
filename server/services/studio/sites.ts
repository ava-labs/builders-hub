import 'server-only';
import type { Prisma } from '@prisma/client';
import { PREVIEW_ENTRY } from '@/components/studio/preview';
import { REACT_ENTRY } from '@/components/studio/preview-react';
import { prisma } from '@/prisma/prisma';
import { StudioError } from './errors';
import { frontendContext, studioReactSource, type FrontendContract } from './frontend';
import { getOwnedProject } from './projects';

/*
 * Published frontends at /builder/{owner}/{site}. Publishing snapshots the
 * project's frontend/ files and the deployed contracts and chains the page
 * reads, so the public site only changes when the builder republishes. The
 * page is served inside a sandboxed frame by a Builder Hub shell, never as a
 * document on the Builder Hub origin: user code must not reach its cookies.
 */

export const SITE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const MAX_SITE_BYTES = 2 * 1024 * 1024;
const RESERVED = new Set([
  'api',
  'admin',
  'studio',
  'console',
  'new',
  'edit',
  'settings',
  'www',
  'builder',
  'avalanche',
]);

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export const sitePath = (site: { owner_slug: string; slug: string }) => `/builder/${site.owner_slug}/${site.slug}`;

const ownerTaken = async (owner: string, userId: string) =>
  !!(await prisma.studioSite.findFirst({
    where: { owner_slug: owner, NOT: { user_id: userId } },
    select: { id: true },
  }));

/**
 * The builder's name in their site addresses, kept across all their sites. It comes from their Builder Hub
 * username; a builder without one picks it on their first publish, after which it is fixed so links keep working.
 */
async function ownerFor(userId: string): Promise<{ owner: string; editable: boolean }> {
  const existing = await prisma.studioSite.findFirst({ where: { user_id: userId }, select: { owner_slug: true } });
  if (existing) return { owner: existing.owner_slug, editable: false };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { user_name: true, name: true, email: true },
  });
  const fromUsername = slugify(user?.user_name ?? '');
  const base = fromUsername || slugify(user?.name || user?.email?.split('@')[0] || '') || 'builder';
  const safe = RESERVED.has(base) ? `${base}-builder` : base;
  const owner = (await ownerTaken(safe, userId)) ? `${safe}-${userId.slice(-5).toLowerCase()}` : safe;
  return { owner, editable: !fromUsername };
}

export async function siteStatus(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  const site = await prisma.studioSite.findUnique({ where: { project_id: project.id } });
  if (site) {
    return { published: true as const, path: sitePath(site), slug: site.slug, publishedAt: site.updated_at };
  }
  const { owner, editable } = await ownerFor(userId);
  return { published: false as const, suggestedSlug: slugify(project.name) || 'app', owner, ownerEditable: editable };
}

export async function publishSite(userId: string, projectId: string, input: { slug?: string; owner?: string }) {
  const project = await getOwnedProject(userId, projectId);
  const context = await frontendContext(userId, project.id);
  if (!context.files.some((f) => f.path === REACT_ENTRY || f.path === PREVIEW_ENTRY)) {
    throw new StudioError(400, `Add ${REACT_ENTRY} before publishing; ask Studio to build the frontend.`);
  }
  const bytes = context.files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
  if (bytes > MAX_SITE_BYTES) throw new StudioError(400, 'The frontend is over 2 MB; trim it before publishing.');

  const current = await prisma.studioSite.findUnique({ where: { project_id: project.id } });
  const slug = input.slug?.trim().toLowerCase() || current?.slug || slugify(project.name) || 'app';
  if (!SITE_SLUG.test(slug) || RESERVED.has(slug)) {
    throw new StudioError(400, 'Use 1-40 lowercase letters, digits or dashes for the site address.');
  }
  let owner = current?.owner_slug;
  if (!owner) {
    const suggested = await ownerFor(userId);
    owner = suggested.owner;
    const chosen = input.owner?.trim().toLowerCase();
    if (suggested.editable && chosen && chosen !== owner) {
      if (!SITE_SLUG.test(chosen) || RESERVED.has(chosen)) {
        throw new StudioError(400, 'Use 1-40 lowercase letters, digits or dashes for your builder name.');
      }
      if (await ownerTaken(chosen, userId)) {
        throw new StudioError(409, `Another builder already publishes as "${chosen}". Pick another name.`);
      }
      owner = chosen;
    }
  }
  const clash = await prisma.studioSite.findUnique({ where: { owner_slug_slug: { owner_slug: owner, slug } } });
  if (clash && clash.project_id !== project.id) {
    throw new StudioError(409, `You already publish another project at ${sitePath(clash)}. Pick another address.`);
  }

  const data = {
    slug,
    title: project.name,
    files: context.files as unknown as Prisma.InputJsonValue,
    contracts: context.contracts as unknown as Prisma.InputJsonValue,
    chains: context.chains as unknown as Prisma.InputJsonValue,
    design_css: context.designCss,
  };
  const site = await prisma.studioSite.upsert({
    where: { project_id: project.id },
    create: { ...data, project_id: project.id, user_id: userId, owner_slug: owner },
    update: data,
  });
  return { published: true as const, path: sitePath(site), slug: site.slug, publishedAt: site.updated_at };
}

export async function unpublishSite(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  await prisma.studioSite.deleteMany({ where: { project_id: project.id } });
  return { published: false as const };
}

/** A published site as the public page needs it. Null when nothing is published at that address. */
export async function publicSite(owner: string, slug: string) {
  if (!/^[a-z0-9-]{1,48}$/.test(owner) || !SITE_SLUG.test(slug)) return null;
  const site = await prisma.studioSite.findUnique({ where: { owner_slug_slug: { owner_slug: owner, slug } } });
  if (!site) return null;
  return {
    title: site.title,
    files: site.files as unknown as { path: string; content: string }[],
    contracts: site.contracts as unknown as FrontendContract[],
    chains: site.chains as unknown as Record<string, { rpcUrl: string | null } & Record<string, unknown>>,
    designCss: site.design_css,
    // Current hooks, not a snapshot: they are platform code, and a fix to them reaches published apps too.
    studioReact: studioReactSource(),
    updatedAt: site.updated_at,
  };
}
