import { Prisma, type Auditor } from "@prisma/client";
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
    auditor = await prisma.auditor.create({
      data: {
        firm_name: input.firm_name,
        quote_email: input.quote_email,
        services: input.services,
        attio_ref: input.attio_ref ?? null,
        created_by: admin.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, code: "duplicate_email" };
    }
    throw error;
  }

  let inviteSent = true;
  try {
    await sendAuditorInvite(auditor);
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
    await sendAuditorInvite(auditor);
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

/**
 * The auditor portal's identity resolution: session email -> whitelist row.
 * Sets first_login_at exactly once (the whitelist's Invited -> Active flip).
 * Callers gate on `active` themselves so a deactivated firm gets a clear 403
 * rather than a silent null.
 */
export async function resolveAuditorByEmail(email: string): Promise<Auditor | null> {
  const auditor = await prisma.auditor.findUnique({
    where: { quote_email: email.trim().toLowerCase() },
  });
  if (!auditor) return null;

  if (auditor.active && !auditor.first_login_at) {
    const updated = await prisma.auditor.update({
      where: { id: auditor.id },
      data: { first_login_at: new Date() },
    });
    await logAuditEvent(prisma, {
      actor_type: "auditor",
      actor_id: auditor.id,
      action: "auditor_first_login",
      meta: { firm_name: auditor.firm_name },
    });
    return updated;
  }

  return auditor;
}
