import { Prisma, type AuditorMember } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { AUDITOR_MEMBER_LIMIT } from "@/lib/audits/constants";
import { logAuditEvent, type AuditActor } from "@/server/services/audits/events";
import { sendAuditorInvite } from "@/server/services/audits/emails/sendAuditorInvite";
import { sendTeamChangeNotice } from "@/server/services/audits/emails/sendTeamChangeNotice";
import type { AuditorMemberCreateInput } from "@/types/audits";

export type AddMemberResult =
  | { success: true; member: AuditorMember; inviteSent: boolean }
  | { success: false; code: "not_found" | "duplicate_email" | "limit_reached" };

type AddMemberTxOutcome =
  | { kind: "not_found" | "limit_reached" | "duplicate_email" }
  | { kind: "ok"; member: AuditorMember; firm_name: string; quote_email: string };

/**
 * Approve one more sign-in address for a firm and invite it. Admins do it from
 * the whitelist sheet; the firm's quote-email identity does it from the firm
 * details page (v1.1). Same shape as createAuditor: an invite failure never
 * loses the row, the response carries inviteSent.
 */
export async function addAuditorMember(
  auditorId: string,
  input: AuditorMemberCreateInput,
  actor: AuditActor,
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
          data: {
            auditor_id: auditor.id,
            email: input.email,
            // added_by is a real FK to User; an OTP session id "pending_<email>"
            // is not a User row, so a portal (auditor) add stores null (5.5).
            added_by: actor.type === "admin" ? actor.id : null,
          },
        });
        return {
          kind: "ok",
          member,
          firm_name: auditor.firm_name,
          quote_email: auditor.quote_email,
        };
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
  const { member, firm_name, quote_email } = outcome;

  let inviteSent = true;
  try {
    await sendAuditorInvite({ firm_name, email: member.email });
  } catch (error) {
    console.error("[Audits] teammate invite send failed:", error);
    inviteSent = false;
  }

  await logAuditEvent(prisma, {
    actor_type: actor.type,
    actor_id: actor.id,
    action: "auditor_member_added",
    meta: {
      firm_name,
      email: member.email,
      invite_sent: inviteSent,
      ...(actor.type === "auditor" ? { actor_email: actor.email } : {}),
    },
  });

  if (actor.type === "auditor") {
    try {
      await sendTeamChangeNotice({
        quoteEmail: quote_email,
        firmName: firm_name,
        changedEmail: member.email,
        actorEmail: actor.email,
        change: "added",
      });
    } catch (error) {
      // A notice failure never loses the write (the invite's pattern).
      console.error("[Audits] team-change notice failed:", error);
    }
  }

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
  actor: AuditActor,
): Promise<RemoveMemberResult> {
  const member = await prisma.auditorMember.findFirst({
    where: { id: memberId, auditor_id: auditorId },
    include: { auditor: { select: { firm_name: true, quote_email: true } } },
  });
  if (!member) return { success: false, code: "not_found" };

  await prisma.auditorMember.delete({ where: { id: member.id } });
  await logAuditEvent(prisma, {
    actor_type: actor.type,
    actor_id: actor.id,
    action: "auditor_member_removed",
    meta: {
      firm_name: member.auditor.firm_name,
      email: member.email,
      ...(actor.type === "auditor" ? { actor_email: actor.email } : {}),
    },
  });

  if (actor.type === "auditor") {
    try {
      await sendTeamChangeNotice({
        quoteEmail: member.auditor.quote_email,
        firmName: member.auditor.firm_name,
        changedEmail: member.email,
        actorEmail: actor.email,
        change: "removed",
      });
    } catch (error) {
      console.error("[Audits] team-change notice failed:", error);
    }
  }

  return { success: true };
}
