import { Prisma, type AuditorMember } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { AUDITOR_MEMBER_LIMIT } from "@/lib/audits/constants";
import { logAuditEvent } from "@/server/services/audits/events";
import { sendAuditorInvite } from "@/server/services/audits/emails/sendAuditorInvite";
import type { AuditorMemberCreateInput } from "@/types/audits";

export type AddMemberResult =
  | { success: true; member: AuditorMember; inviteSent: boolean }
  | { success: false; code: "not_found" | "duplicate_email" | "limit_reached" };

type AddMemberTxOutcome =
  | { kind: "not_found" | "limit_reached" | "duplicate_email" }
  | { kind: "ok"; member: AuditorMember; firm_name: string };

/**
 * Approve one more sign-in address for a firm and invite it (Matthew's
 * 2026-09-01 ask, admin-managed by decision). Same shape as createAuditor: an
 * invite failure never loses the row, the response carries inviteSent.
 */
export async function addAuditorMember(
  auditorId: string,
  input: AuditorMemberCreateInput,
  admin: { id: string; name: string },
): Promise<AddMemberResult> {
  let outcome: AddMemberTxOutcome;
  try {
    // Serializable so the per-firm limit and the cross-table clash check
    // cannot race a concurrent add or firm creation: a conflicting pair fails
    // with P2034 instead of committing two homes for one address.
    outcome = await prisma.$transaction(
      async (tx): Promise<AddMemberTxOutcome> => {
        const auditor = await tx.auditor.findUnique({
          where: { id: auditorId },
          include: { _count: { select: { members: true } } },
        });
        if (!auditor) return { kind: "not_found" };
        if (auditor._count.members >= AUDITOR_MEMBER_LIMIT) return { kind: "limit_reached" };

        // One address, one firm: a teammate address may not be any firm's quote
        // email. The unique index on AuditorMember.email covers teammate vs
        // teammate; this covers teammate vs firm (no cross-table constraint exists).
        const firmClash = await tx.auditor.findUnique({
          where: { quote_email: input.email },
          select: { id: true },
        });
        if (firmClash) return { kind: "duplicate_email" };

        const member = await tx.auditorMember.create({
          data: { auditor_id: auditor.id, email: input.email, added_by: admin.id },
        });
        return { kind: "ok", member, firm_name: auditor.firm_name };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return { success: false, code: "duplicate_email" };
    }
    throw error;
  }
  if (outcome.kind !== "ok") return { success: false, code: outcome.kind };
  const { member, firm_name } = outcome;

  let inviteSent = true;
  try {
    await sendAuditorInvite({ firm_name, email: member.email });
  } catch (error) {
    console.error("[Audits] teammate invite send failed:", error);
    inviteSent = false;
  }

  await logAuditEvent(prisma, {
    actor_type: "admin",
    actor_id: admin.id,
    action: "auditor_member_added",
    meta: { firm_name, email: member.email, invite_sent: inviteSent },
  });

  return { success: true, member, inviteSent };
}

export type RemoveMemberResult = { success: true } | { success: false; code: "not_found" };

/**
 * Revoke a teammate's access. The row is deleted (re-adding is the undo) and
 * the trail keeps the address. Quotes the teammate saved stay with the firm:
 * their submitted_by_email remains as history, and visibility stops revealing
 * it to projects once the address is no longer approved (firmContact).
 */
export async function removeAuditorMember(
  auditorId: string,
  memberId: string,
  admin: { id: string; name: string },
): Promise<RemoveMemberResult> {
  const member = await prisma.auditorMember.findFirst({
    where: { id: memberId, auditor_id: auditorId },
    include: { auditor: { select: { firm_name: true } } },
  });
  if (!member) return { success: false, code: "not_found" };

  await prisma.auditorMember.delete({ where: { id: member.id } });
  await logAuditEvent(prisma, {
    actor_type: "admin",
    actor_id: admin.id,
    action: "auditor_member_removed",
    meta: { firm_name: member.auditor.firm_name, email: member.email },
  });
  return { success: true };
}
