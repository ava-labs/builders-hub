import 'server-only';
import { briefMarkdown, planImport, type Need, type RawFile } from '@/lib/studio/import';
import { prisma } from '@/prisma/prisma';
import { MAX_STUDIO_FILES } from '@/types/studio';
import { StudioError } from './errors';
import { getOwnedProject, sha256Hex } from './projects';

export const BRIEF_PATH = 'docs/BRIEF.md';
/** What one upload may carry before it is filtered, so a whole repo with its dependencies is refused early. */
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

/**
 * Writes an existing project into a Studio project: its contracts, tests,
 * scripts and docs, plus docs/BRIEF.md with what the builder needs and what
 * Studio could and could not take. Files at the same path are replaced, since
 * a re-import is the builder bringing their newer work.
 */
export async function importProject(
  userId: string,
  projectId: string,
  input: { files: RawFile[]; about: string; needs: Need[] },
) {
  const project = await getOwnedProject(userId, projectId);
  const bytes = input.files.reduce((sum, f) => sum + Buffer.byteLength(f.content, 'utf8'), 0);
  if (bytes > MAX_IMPORT_BYTES) {
    throw new StudioError(
      413,
      `That upload is ${(bytes / 1024 / 1024).toFixed(1)} MB. Leave out lib/, node_modules/ and build output; Studio keeps up to 8 MB of source.`,
    );
  }

  const plan = planImport(input.files);
  if (plan.counts.contracts === 0) {
    throw new StudioError(400, 'No Solidity contracts found. Studio looks in src/, contracts/ or the top folder.');
  }
  const previous = await prisma.studioFile.findUnique({
    where: { project_id_path: { project_id: project.id, path: BRIEF_PATH } },
    select: { content: true },
  });
  const brief = briefMarkdown(plan, input.about, input.needs, previous?.content);
  const writes = [...plan.files, { path: BRIEF_PATH, content: brief, from: '' }];

  const existing = new Set(
    (await prisma.studioFile.findMany({ where: { project_id: project.id }, select: { path: true } })).map(
      (f) => f.path,
    ),
  );
  const added = writes.filter((f) => !existing.has(f.path)).length;
  if (existing.size + added > MAX_STUDIO_FILES) {
    throw new StudioError(
      400,
      `A project holds at most ${MAX_STUDIO_FILES} files; this import would make ${existing.size + added}.`,
    );
  }

  await prisma.$transaction([
    ...writes.map((f) => {
      const sha256 = sha256Hex(f.content);
      return prisma.studioFile.upsert({
        where: { project_id_path: { project_id: project.id, path: f.path } },
        create: { project_id: project.id, path: f.path, content: f.content, sha256 },
        update: { content: f.content, sha256 },
      });
    }),
    prisma.studioProject.update({
      where: { id: project.id },
      data: {
        updated_at: new Date(),
        ...(input.about && !project.description ? { description: input.about.slice(0, 500) } : {}),
      },
    }),
  ]);

  return {
    framework: plan.framework,
    imported: plan.files.map((f) => ({ path: f.path, from: f.from, replaced: existing.has(f.path) })),
    skipped: plan.skipped,
    counts: plan.counts,
    imports: plan.imports,
    pragmaConflicts: plan.pragmaConflicts,
    openZeppelin: plan.openZeppelin,
    brief: BRIEF_PATH,
  };
}

export type ImportResult = Awaited<ReturnType<typeof importProject>>;
