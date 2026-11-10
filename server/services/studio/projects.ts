import { createHash } from "node:crypto";
import { prisma } from "@/prisma/prisma";
import { listBlueprintIds, loadBlueprint } from "@/lib/blueprints";
import type { CreateProjectInput, UpdateProjectInput } from "@/types/studio";
import { StudioError, projectNotFound } from "./errors";

export const sha256Hex = (content: string) => createHash("sha256").update(content).digest("hex");

/** The project, if `userId` owns it and it is not archived. Every Studio read and write goes through here. */
export async function getOwnedProject(userId: string, projectId: string) {
  const project = await prisma.studioProject.findFirst({ where: { id: projectId, user_id: userId, archived_at: null } });
  if (!project) throw projectNotFound();
  return project;
}

export async function listProjects(userId: string) {
  return prisma.studioProject.findMany({
    where: { user_id: userId, archived_at: null },
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      blueprint_ids: true,
      stage: true,
      created_at: true,
      updated_at: true,
      _count: { select: { files: true, deployments: true, chats: true } },
      deployments: { orderBy: { created_at: "desc" }, take: 1, select: { status: true, stage: true, created_at: true } },
    },
  });
}

/** Files to seed a project with: each blueprint's contracts and tests, first blueprint wins on a clash. */
export function blueprintFiles(blueprintIds: string[]): { path: string; content: string }[] {
  const files = new Map<string, string>();
  for (const id of blueprintIds) {
    const blueprint = loadBlueprint(id);
    for (const file of [...blueprint.sources, ...blueprint.tests]) {
      if (!files.has(file.path)) files.set(file.path, file.content);
    }
  }
  return [...files].map(([path, content]) => ({ path, content }));
}

export function defaultNetworks(blueprintIds: string[]): Record<string, string> {
  const networks: Record<string, string> = {};
  for (const id of blueprintIds) {
    for (const [role, spec] of Object.entries(loadBlueprint(id).manifest.networks)) networks[role] ??= spec.default;
  }
  return networks;
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const known = new Set(listBlueprintIds());
  const blueprintIds = [...new Set(input.blueprintIds ?? [])];
  const unknown = blueprintIds.filter((id) => !known.has(id));
  if (unknown.length) throw new StudioError(400, `Unknown blueprint: ${unknown.join(", ")}`);

  const files = blueprintFiles(blueprintIds);
  return prisma.studioProject.create({
    data: {
      user_id: userId,
      name: input.name,
      description: input.description ?? "",
      blueprint_ids: blueprintIds,
      networks: defaultNetworks(blueprintIds),
      files: { create: files.map((f) => ({ path: f.path, content: f.content, sha256: sha256Hex(f.content) })) },
      chats: { create: { title: "New chat" } },
    },
    include: { chats: { select: { id: true } } },
  });
}

export async function updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
  const project = await getOwnedProject(userId, projectId);
  if (input.networks) {
    const registryAllowed = new Set(project.blueprint_ids.flatMap((id) => Object.values(loadBlueprint(id).manifest.networks).flatMap((n) => n.allowed)));
    const bad = Object.values(input.networks).filter((n) => !registryAllowed.has(n));
    if (bad.length) throw new StudioError(400, `Not allowed by the project's blueprints: ${bad.join(", ")}`);
  }
  return prisma.studioProject.update({
    where: { id: project.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.networks ? { networks: { ...(project.networks as Record<string, string>), ...input.networks } } : {}),
      ...(input.params ? { params: { ...(project.params as Record<string, unknown>), ...input.params } as object } : {}),
    },
  });
}

export async function addBlueprint(userId: string, projectId: string, blueprintId: string) {
  const project = await getOwnedProject(userId, projectId);
  if (!listBlueprintIds().includes(blueprintId)) throw new StudioError(400, `Unknown blueprint: ${blueprintId}`);
  const existing = new Set((await prisma.studioFile.findMany({ where: { project_id: project.id }, select: { path: true } })).map((f) => f.path));
  const added = blueprintFiles([blueprintId]).filter((f) => !existing.has(f.path));
  await prisma.$transaction([
    ...added.map((f) => prisma.studioFile.create({ data: { project_id: project.id, path: f.path, content: f.content, sha256: sha256Hex(f.content) } })),
    prisma.studioProject.update({
      where: { id: project.id },
      data: {
        blueprint_ids: project.blueprint_ids.includes(blueprintId) ? project.blueprint_ids : [...project.blueprint_ids, blueprintId],
        networks: { ...defaultNetworks([blueprintId]), ...(project.networks as Record<string, string>) },
      },
    }),
  ]);
  return { added: added.map((f) => f.path) };
}

export async function archiveProject(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  await prisma.studioProject.update({ where: { id: project.id }, data: { archived_at: new Date() } });
}

/** Everything the workspace shows on load, in one round trip. */
export async function projectOverview(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  const [files, chats, builds, audits, deployments, promotions] = await Promise.all([
    prisma.studioFile.findMany({ where: { project_id: project.id }, orderBy: { path: "asc" }, select: { path: true, sha256: true, updated_at: true, content: true } }),
    prisma.studioChat.findMany({ where: { project_id: project.id }, orderBy: { updated_at: "desc" }, select: { id: true, title: true, updated_at: true } }),
    prisma.studioBuild.findMany({ where: { project_id: project.id }, orderBy: { created_at: "desc" }, take: 1 }),
    prisma.studioAuditReport.findMany({ where: { project_id: project.id }, orderBy: { created_at: "desc" }, take: 1 }),
    prisma.studioDeployment.findMany({ where: { project_id: project.id }, orderBy: { created_at: "desc" }, take: 20 }),
    prisma.studioPromotion.findMany({ where: { project_id: project.id }, orderBy: { created_at: "desc" }, take: 5 }),
  ]);
  return {
    project,
    files: files.map((f) => ({ path: f.path, sha256: f.sha256, updatedAt: f.updated_at, size: Buffer.byteLength(f.content) })),
    chats,
    build: builds[0] ?? null,
    audit: audits[0] ?? null,
    deployments,
    promotions,
  };
}
