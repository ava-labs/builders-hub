import { prisma } from "@/prisma/prisma";
import { auditSubmitSchema } from "@/types/audits";
import { QUOTE_DEADLINE_DEFAULT_DAYS } from "@/lib/audits/constants";
import { sendFanoutNotification } from "@/server/services/audits/emails/sendFanoutNotification";

const DAY = 24 * 60 * 60 * 1000;

export type SubmitResult =
  | { success: true; auditorCount: number; emailFailures: number }
  | { success: false; code: "not_found" }
  | { success: false; code: "invalid"; errors: Record<string, string[] | undefined> };

type TxOutcome =
  | { kind: "not_found" }
  | { kind: "invalid"; errors: Record<string, string[] | undefined> }
  | {
      kind: "ok";
      auditors: { id: string; firm_name: string; quote_email: string }[];
      request: {
        project_name: string;
        quote_deadline: Date;
        services: string[];
        nsloc: number | null;
      };
    };

/**
 * Submission = one transaction (validate the stored row, flip it to
 * collecting, create one AuditFanoutDelivery per ACTIVE firm, log events),
 * then emails AFTER commit. An email failure NEVER fails the submission: it
 * degrades that delivery to email_status "failed", visible in the admin
 * drill-down. Quotes are not pre-created; auditors create their own.
 */
export async function submitRequestAndFanout(
  requestId: string,
  userId: string,
): Promise<SubmitResult> {
  const outcome = await prisma.$transaction(async (tx): Promise<TxOutcome> => {
    // Owner + draft pinned in the where clause: nobody submits someone
    // else's request, and nothing already submitted can be resubmitted.
    const row = await tx.auditRequest.findFirst({
      where: { id: requestId, user_id: userId, status: "draft" },
    });
    if (!row) return { kind: "not_found" };

    // The completeness gate runs against the STORED row, never client input.
    const parsed = auditSubmitSchema.safeParse(row);
    if (!parsed.success) {
      return { kind: "invalid", errors: parsed.error.flatten().fieldErrors };
    }

    const quote_deadline =
      row.quote_deadline ?? new Date(Date.now() + QUOTE_DEADLINE_DEFAULT_DAYS * DAY);

    await tx.auditRequest.update({
      where: { id: row.id },
      data: {
        status: "collecting",
        submitted_at: new Date(),
        quote_deadline,
        // Store the normalized (lowercased) contact email from the gate.
        contact_email: parsed.data.contact_email,
      },
    });

    const auditors = await tx.auditor.findMany({
      where: { active: true },
      select: { id: true, firm_name: true, quote_email: true },
    });

    if (auditors.length > 0) {
      await tx.auditFanoutDelivery.createMany({
        data: auditors.map((auditor) => ({ request_id: row.id, auditor_id: auditor.id })),
        skipDuplicates: true,
      });
    }

    await tx.auditEventLog.createMany({
      data: [
        {
          request_id: row.id,
          actor_type: "project_user",
          actor_id: userId,
          action: "request_submitted",
          meta: { project_name: row.project_name },
        },
        {
          request_id: row.id,
          actor_type: "system",
          actor_id: null,
          action: "fanout_created",
          meta: { auditor_count: auditors.length },
        },
      ],
    });

    return {
      kind: "ok",
      auditors,
      request: {
        project_name: row.project_name,
        quote_deadline,
        services: row.services,
        nsloc: row.nsloc,
      },
    };
  });

  if (outcome.kind === "not_found") return { success: false, code: "not_found" };
  if (outcome.kind === "invalid") return { success: false, code: "invalid", errors: outcome.errors };

  const { emailFailures } = await deliverFanoutEmails(requestId, outcome.auditors, outcome.request);
  return { success: true, auditorCount: outcome.auditors.length, emailFailures };
}

/**
 * Post-commit best-effort sends with one delivery-row status update each.
 * Shared by submission and reopen; an email failure NEVER fails the caller,
 * it degrades that delivery to email_status "failed".
 */
export async function deliverFanoutEmails(
  requestId: string,
  auditors: { id: string; firm_name: string; quote_email: string }[],
  request: { project_name: string; quote_deadline: Date; services: string[]; nsloc: number | null },
): Promise<{ emailFailures: number }> {
  const sends = await Promise.allSettled(
    auditors.map((auditor) => sendFanoutNotification(auditor, request)),
  );
  const emailFailures = sends.filter((send) => send.status === "rejected").length;

  await Promise.all(
    sends.map((send, index) => {
      const auditor = auditors[index];
      return prisma.auditFanoutDelivery.update({
        where: {
          request_id_auditor_id: { request_id: requestId, auditor_id: auditor.id },
        },
        data:
          send.status === "rejected"
            ? { email_status: "failed" }
            : { email_status: "sent", emailed_at: new Date() },
      });
    }),
  );

  return { emailFailures };
}
