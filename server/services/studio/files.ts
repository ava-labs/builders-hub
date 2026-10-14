import { prisma } from '@/prisma/prisma';
import { isSafeUnitPath } from '@/lib/studio/sources';
import { MAX_STUDIO_FILES, STUDIO_FILE_PATH, STUDIO_FILE_RULE } from '@/types/studio';
import { StudioError } from './errors';
import { getOwnedProject, sha256Hex } from './projects';

function assertPath(path: string) {
  if (!STUDIO_FILE_PATH.test(path) || !isSafeUnitPath(path)) {
    throw new StudioError(400, `Invalid path "${path}". ${STUDIO_FILE_RULE}.`);
  }
}

export async function listFiles(userId: string, projectId: string, { withContent = false } = {}) {
  const project = await getOwnedProject(userId, projectId);
  return prisma.studioFile.findMany({
    where: { project_id: project.id },
    orderBy: { path: 'asc' },
    select: { path: true, sha256: true, updated_at: true, content: withContent },
  });
}

export async function readFile(userId: string, projectId: string, path: string) {
  assertPath(path);
  const project = await getOwnedProject(userId, projectId);
  const file = await prisma.studioFile.findUnique({ where: { project_id_path: { project_id: project.id, path } } });
  if (!file) throw new StudioError(404, `No file at ${path}`);
  return file;
}

export async function writeFile(userId: string, projectId: string, path: string, content: string) {
  assertPath(path);
  const project = await getOwnedProject(userId, projectId);
  const existing = await prisma.studioFile.findUnique({
    where: { project_id_path: { project_id: project.id, path } },
    select: { id: true },
  });
  if (!existing && (await prisma.studioFile.count({ where: { project_id: project.id } })) >= MAX_STUDIO_FILES) {
    throw new StudioError(400, `A project holds at most ${MAX_STUDIO_FILES} files`);
  }
  const sha256 = sha256Hex(content);
  const [file] = await prisma.$transaction([
    prisma.studioFile.upsert({
      where: { project_id_path: { project_id: project.id, path } },
      create: { project_id: project.id, path, content, sha256 },
      update: { content, sha256 },
    }),
    prisma.studioProject.update({ where: { id: project.id }, data: { updated_at: new Date() } }),
  ]);
  return { path: file.path, sha256: file.sha256, created: !existing };
}

export async function deleteFile(userId: string, projectId: string, path: string) {
  assertPath(path);
  const project = await getOwnedProject(userId, projectId);
  const { count } = await prisma.studioFile.deleteMany({ where: { project_id: project.id, path } });
  if (count === 0) throw new StudioError(404, `No file at ${path}`);
}

/** sha256 over sorted "path sha256" lines: identifies exactly which sources a build used. */
export function filesHash(files: { path: string; sha256: string }[]): string {
  return sha256Hex(
    [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => `${f.path} ${f.sha256}`)
      .join('\n'),
  );
}
