import { Prisma, type Auditor, type AuditorMember } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { logAuditEvent } from "@/server/services/audits/events";
import { sendAuditorInvite } from "@/server/services/audits/emails/sendAuditorInvite";
import type { AuditorCreateInput, AuditorUpdateInput } from "@/types/audits";

export type CreateAuditorResult =
  | { success: true; auditor: Auditor; inviteSent: boolean }
  | { success: false; code: "duplicate_email" };

/**
 * Add a firm to the whitelist and send the OTP invite. An invite send
 * failure never loses the firm: it is created either way and the response
 * carries inviteSent for the UI to offer a resend.
 */
export async function createAuditor(
  input: AuditorCreateInput,
  admin: { id: string; name: string },
): Promise<CreateAuditorResult> {
  let auditor: Auditor;
  try {
    // Serializable so the cross-table clash check cannot race a concurrent
    // teammate add: a conflicting pair fails with P2034 instead of giving one
    // address two firms.
    const created = await prisma.$transaction(
      async (tx): Promise<Auditor | null> => {
        // One address, one firm: a quote email may not double as a teammate
        // address on any firm. The members table's unique index cannot see
        // this table.
        const memberClash = await tx.auditorMember.findUnique({
          where: { email: input.quote_email },
          select: { id: true },
        });
        if (memberClash) return null;
        return tx.auditor.create({
          data: {
            firm_name: input.firm_name,
            quote_email: input.quote_email,
            services: input.services,
            attio_ref: input.attio_ref ?? null,
            created_by: admin.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!created) return { success: false, code: "duplicate_email" };
    auditor = created;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return { success: false, code: "duplicate_email" };
    }
    throw error;
  }

  let inviteSent = true;
  try {
    await sendAuditorInvite({ firm_name: auditor.firm_name, email: auditor.quote_email });
  } catch (error) {
    console.error("[Audits] invite send failed:", error);
    inviteSent = false;
  }

  await logAuditEvent(prisma, {
    actor_type: "admin",
    actor_id: admin.id,
    action: "auditor_added",
    meta: { firm_name: auditor.firm_name, invite_sent: inviteSent },
  });

  return { success: true, auditor, inviteSent };
}

export type UpdateAuditorResult =
  | { success: true; auditor: Auditor }
  | { success: false; code: "not_found" };

/**
 * Edit firm details or flip active. Deactivating stops future fan-outs and
 * stamps deactivated_at; history and past quotes stay intact by design.
 */
export async function updateAuditor(
  auditorId: string,
  input: AuditorUpdateInput,
  admin: { id: string; name: string },
): Promise<UpdateAuditorResult> {
  const current = await prisma.auditor.findUnique({ where: { id: auditorId } });
  if (!current) return { success: false, code: "not_found" };

  const activeFlips = input.active !== undefined && input.active !== current.active;
  const auditor = await prisma.auditor.update({
    where: { id: auditorId },
    data: {
      ...(input.firm_name !== undefined ? { firm_name: input.firm_name } : {}),
      ...(input.services !== undefined ? { services: input.services } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(activeFlips ? { deactivated_at: input.active ? null : new Date() } : {}),
    },
  });

  await logAuditEvent(prisma, {
    actor_type: "admin",
    actor_id: admin.id,
    action: activeFlips
      ? input.active
        ? "auditor_reactivated"
        : "auditor_deactivated"
      : "auditor_updated",
    meta: { firm_name: auditor.firm_name },
  });

  return { success: true, auditor };
}

export type ResendInviteResult =
  | { success: true; inviteSent: boolean }
  | { success: false; code: "not_found" };

export async function resendAuditorInvite(
  auditorId: string,
  admin: { id: string; name: string },
): Promise<ResendInviteResult> {
  const auditor = await prisma.auditor.findUnique({ where: { id: auditorId } });
  if (!auditor) return { success: false, code: "not_found" };

  let inviteSent = true;
  try {
    await sendAuditorInvite({ firm_name: auditor.firm_name, email: auditor.quote_email });
  } catch (error) {
    console.error("[Audits] invite resend failed:", error);
    inviteSent = false;
  }

  await logAuditEvent(prisma, {
    actor_type: "admin",
    actor_id: admin.id,
    action: "auditor_invite_resent",
    meta: { firm_name: auditor.firm_name, invite_sent: inviteSent },
  });

  return { success: true, inviteSent };
}

export interface AuditorIdentity {
  auditor: Auditor;
  /** Set when the address is an approved teammate rather than the quote email. */
  member: AuditorMember | null;
}

/**
 * Pure lookup, no stamping: the firm behind an address, whether it is the
 * firm's quote email or one of its approved teammates. Quote email wins the
 * tie by construction (the services keep the two sets disjoint).
 */
export async function findAuditorByEmail(email: string): Promise<AuditorIdentity | null> {
  const normalized = email.trim().toLowerCase();
  const byQuoteEmail = await prisma.auditor.findUnique({ where: { quote_email: normalized } });
  if (byQuoteEmail) return { auditor: byQuoteEmail, member: null };

  const member = await prisma.auditorMember.findUnique({
    where: { email: normalized },
    include: { auditor: true },
  });
  return member ? { auditor: member.auditor, member } : null;
}

/**
 * The auditor portal's identity resolution: session email -> whitelist row.
 * Sets first_login_at exactly once on the firm (the whitelist's Invited ->
 * Active flip) and once on the teammate row when a teammate signs in, so the
 * admin panel shows who has accepted their invite. Callers gate on `active`
 * themselves so a deactivated firm gets a clear 403 rather than a silent null.
 */
export async function resolveAuditorByEmail(email: string): Promise<Auditor | null> {
  const identity = await findAuditorByEmail(email);
  if (!identity) return null;

  const actorEmail = identity.member?.email ?? identity.auditor.quote_email;
  // Only an active firm's teammate counts as having accepted the invite; a
  // deactivated firm's read-only visit must not flip the row to active.
  if (identity.auditor.active && identity.member && !identity.member.first_login_at) {
    await prisma.auditorMember.update({
      where: { id: identity.member.id },
      data: { first_login_at: new Date() },
    });
  }

  if (identity.auditor.active && !identity.auditor.first_login_at) {
    const updated = await prisma.auditor.update({
      where: { id: identity.auditor.id },
      data: { first_login_at: new Date() },
    });
    await logAuditEvent(prisma, {
      actor_type: "auditor",
      actor_id: identity.auditor.id,
      action: "auditor_first_login",
      meta: { firm_name: identity.auditor.firm_name, actor_email: actorEmail },
    });
    return updated;
  }

  return identity.auditor;
}

/**
 * Whitelist flip history for the CSV export. Flip events carry no auditor id,
 * only meta.firm_name, so history is matched by firm name (rename caveat
 * accepted for v1 reporting).
 */
export async function getAuditorStatusHistory(): Promise<Map<string, string[]>> {
  const events = await prisma.auditEventLog.findMany({
    where: { action: { in: ["auditor_reactivated", "auditor_deactivated"] } },
    orderBy: { created_at: "asc" },
    select: { action: true, created_at: true, meta: true },
  });

  return events.reduce<Map<string, string[]>>((map, event) => {
    const meta = event.meta as Record<string, unknown> | null;
    const firm = meta && typeof meta.firm_name === "string" ? meta.firm_name : "";
    if (!firm) return map;
    const verb = event.action === "auditor_deactivated" ? "deactivated" : "reactivated";
    const entry = `${event.created_at.toISOString().slice(0, 10)} ${verb}`;
    return new Map(map).set(firm, [...(map.get(firm) ?? []), entry]);
  }, new Map());
}
