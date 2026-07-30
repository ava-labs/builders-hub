import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { logAuditEvent } from "@/server/services/audits/events";
import type { AuditDraftInput } from "@/types/audits";

export type MutationResult = { success: true } | { success: false; code: "not_found" };

// The two Json columns need an explicit InputJsonValue cast; everything else
// in AuditDraftInput maps 1:1 onto AuditRequest columns. undefined keys are
// skipped by Prisma, so a partial autosave only touches what it carries.
function toDraftData(input: AuditDraftInput) {
  const { repos, attachments, ...rest } = input;
  return {
    ...rest,
    ...(repos !== undefined ? { repos: repos as unknown as Prisma.InputJsonValue } : {}),
    ...(attachments !== undefined
      ? { attachments: attachments as unknown as Prisma.InputJsonValue }
      : {}),
  };
}

export async function createDraft(
  userId: string,
  input: AuditDraftInput,
): Promise<{ id: string }> {
  return prisma.auditRequest.create({
    data: { user_id: userId, ...toDraftData(input) },
    select: { id: true },
  });
}

/**
 * Autosave. updateMany with the owner + draft status pinned in the where
 * clause is the whole authorization story: a submitted or foreign request
 * matches nothing and reports not_found instead of leaking anything.
 */
export async function patchDraft(
  userId: string,
  requestId: string,
  input: AuditDraftInput,
): Promise<MutationResult> {
  const result = await prisma.auditRequest.updateMany({
    where: { id: requestId, user_id: userId, status: "draft" },
    data: toDraftData(input),
  });
  return result.count === 0 ? { success: false, code: "not_found" } : { success: true };
}

export async function deleteDraft(userId: string, requestId: string): Promise<MutationResult> {
  const result = await prisma.auditRequest.deleteMany({
    where: { id: requestId, user_id: userId, status: "draft" },
  });
  return result.count === 0 ? { success: false, code: "not_found" } : { success: true };
}

export async function withdraw(userId: string, requestId: string): Promise<MutationResult> {
  const result = await prisma.auditRequest.updateMany({
    where: { id: requestId, user_id: userId, status: "collecting" },
    data: { status: "withdrawn", closed_at: new Date() },
  });
  if (result.count === 0) return { success: false, code: "not_found" };

  await logAuditEvent(prisma, {
    request_id: requestId,
    actor_type: "project_user",
    actor_id: userId,
    action: "request_withdrawn",
  });
  return { success: true };
}
