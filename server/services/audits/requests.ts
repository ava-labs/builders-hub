import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { deriveRequestStatus } from "@/lib/audits/status";
import { QUOTE_DEADLINE_DEFAULT_DAYS } from "@/lib/audits/constants";
import { logAuditEvent } from "@/server/services/audits/events";
import {
  deliverFanoutEmails,
  FANOUT_FIRM_SELECT,
  toFanoutRequest,
  type FanoutFirm,
} from "@/server/services/audits/fanout";
import type { FanoutRequest } from "@/server/services/audits/emails/sendFanoutNotification";
import type { AuditDraftInput } from "@/types/audits";

const DAY = 24 * 60 * 60 * 1000;

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

/**
 * Pull a request back out of the review queue. Nothing has been sent to any
 * firm at this point, so the safe and useful move is not deletion but a
 * return to draft: the project fixes whatever was wrong and resubmits, or
 * deletes the draft outright with the affordance that already exists there.
 */
export async function returnToDraft(
  userId: string,
  requestId: string,
): Promise<MutationResult> {
  const result = await prisma.auditRequest.updateMany({
    where: { id: requestId, user_id: userId, status: "pending_review" },
    data: { status: "draft", submitted_at: null },
  });
  if (result.count === 0) return { success: false, code: "not_found" };

  await logAuditEvent(prisma, {
    request_id: requestId,
    actor_type: "project_user",
    actor_id: userId,
    action: "request_returned_to_draft",
  });
  return { success: true };
}

export type ReopenResult =
  | { success: true; auditorCount: number; emailFailures: number }
  | { success: false; code: "not_found" | "not_reopenable" | "already_reopened" };

type ReopenTxOutcome =
  | { kind: "not_found" | "not_reopenable" | "already_reopened" }
  | {
      kind: "ok";
      auditors: FanoutFirm[];
      request: FanoutRequest;
    };

/**
 * One more round for a derived-expired request (deadline passed, zero
 * quotes): fresh +10d deadline, re-fanout to every active firm. Deliveries
 * upsert via skipDuplicates so history stays intact, and exactly ONE reopen
 * is allowed, enforced by counting request_reopened events.
 */
export async function reopen(userId: string, requestId: string): Promise<ReopenResult> {
  const outcome = await prisma.$transaction(async (tx): Promise<ReopenTxOutcome> => {
    const row = await tx.auditRequest.findFirst({
      where: { id: requestId, user_id: userId },
      include: { _count: { select: { quotes: true } } },
    });
    if (!row) return { kind: "not_found" };
    if (deriveRequestStatus(row, row._count.quotes) !== "expired") {
      return { kind: "not_reopenable" };
    }
    const priorReopens = await tx.auditEventLog.count({
      where: { request_id: requestId, action: "request_reopened" },
    });
    if (priorReopens >= 1) return { kind: "already_reopened" };

    const quote_deadline = new Date(Date.now() + QUOTE_DEADLINE_DEFAULT_DAYS * DAY);
    await tx.auditRequest.update({ where: { id: row.id }, data: { quote_deadline } });

    const auditors = await tx.auditor.findMany({
      where: { active: true },
      select: FANOUT_FIRM_SELECT,
    });
    if (auditors.length > 0) {
      await tx.auditFanoutDelivery.createMany({
        data: auditors.map((auditor) => ({ request_id: row.id, auditor_id: auditor.id })),
        skipDuplicates: true,
      });
    }
    await tx.auditEventLog.create({
      data: {
        request_id: row.id,
        actor_type: "project_user",
        actor_id: userId,
        action: "request_reopened",
        meta: { auditor_count: auditors.length },
      },
    });

    return { kind: "ok", auditors, request: toFanoutRequest({ ...row, quote_deadline }) };
  });

  if (outcome.kind !== "ok") return { success: false, code: outcome.kind };

  const { emailFailures } = await deliverFanoutEmails(requestId, outcome.auditors, outcome.request);
  return { success: true, auditorCount: outcome.auditors.length, emailFailures };
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
