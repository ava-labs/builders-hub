import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { auditSubmitSchema } from "@/types/audits";
import { QUOTE_DEADLINE_DEFAULT_DAYS } from "@/lib/audits/constants";
import { sendFanoutNotification } from "@/server/services/audits/emails/sendFanoutNotification";
import type { FanoutRequest } from "@/server/services/audits/emails/sendFanoutNotification";

const DAY = 24 * 60 * 60 * 1000;

/**
 * The active firms a request fans out to: the id for the delivery rows, the
 * addresses for the mail. Teammates ride along so every approved address is
 * notified (team emails, 2026-09-02). Shared with reopen in requests.ts.
 */
export const FANOUT_FIRM_SELECT = {
  id: true,
  firm_name: true,
  quote_email: true,
  members: { select: { email: true } },
} as const;
export type FanoutFirm = Prisma.AuditorGetPayload<{ select: typeof FANOUT_FIRM_SELECT }>;

export type SubmitResult =
  | { success: true }
  | { success: false; code: "not_found" }
  | { success: false; code: "invalid"; errors: Record<string, string[] | undefined> };

export type ApprovalResult =
  | { success: true; auditorCount: number; emailFailures: number }
  | { success: false; code: "not_found" };

type SubmitOutcome =
  | { kind: "not_found" }
  | { kind: "invalid"; errors: Record<string, string[] | undefined> }
  | { kind: "ok" };

type ApproveOutcome =
  | { kind: "not_found" }
  | {
      kind: "ok";
      auditors: FanoutFirm[];
      request: FanoutRequest;
    };

/** Everything the fan-out mail needs, selected once and reused. */
const FANOUT_REQUEST_SELECT = {
  id: true,
  project_name: true,
  quote_deadline: true,
  services: true,
  nsloc: true,
  description: true,
  scope: true,
  project_types: true,
  languages: true,
  frameworks: true,
  repos: true,
  deployment_target: true,
  multichain: true,
  needed_by: true,
  urgency: true,
} as const;

type FanoutRow = {
  id: string;
  project_name: string;
  quote_deadline: Date | null;
  services: string[];
  nsloc: number | null;
  description: string;
  scope: string;
  project_types: string[];
  languages: string[];
  frameworks: string[];
  repos: unknown;
  deployment_target: string;
  multichain: boolean;
  needed_by: Date | null;
  urgency: string | null;
};

export function toFanoutRequest(row: FanoutRow): FanoutRequest {
  return {
    id: row.id,
    project_name: row.project_name,
    quote_deadline: row.quote_deadline,
    services: row.services,
    nsloc: row.nsloc,
    description: row.description,
    scope: row.scope,
    project_types: row.project_types,
    languages: row.languages,
    frameworks: row.frameworks,
    repo_count: Array.isArray(row.repos) ? row.repos.length : 0,
    deployment_target: row.deployment_target,
    multichain: row.multichain,
    needed_by: row.needed_by,
    urgency: row.urgency,
  };
}

/**
 * Submission validates the stored row and parks it in "pending_review".
 * NOTHING reaches an auditor here: no delivery rows, no email. An admin has
 * to approve first, which is what stops the whitelist being spammed by
 * low-quality or hostile requests. The quote deadline is deliberately NOT
 * stamped yet, so a slow review never eats into the firms' quoting window.
 */
export async function submitRequestForReview(
  requestId: string,
  userId: string,
): Promise<SubmitResult> {
  const outcome = await prisma.$transaction(async (tx): Promise<SubmitOutcome> => {
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

    await tx.auditRequest.update({
      where: { id: row.id },
      data: {
        status: "pending_review",
        submitted_at: new Date(),
        // Consent is given by sending, so it carries the submission time.
        contact_consent_at: new Date(),
        // Store the normalized values the gate produced, not the raw draft:
        // the email lowercased, and the URLs with their scheme filled in, so
        // a bare "avax.network" is not what firms end up clicking.
        contact_email: parsed.data.contact_email,
        website: parsed.data.website,
        doc_links: parsed.data.doc_links,
        repos: parsed.data.repos,
        contact_calendar_url: parsed.data.contact_calendar_url ?? null,
      },
    });

    await tx.auditEventLog.create({
      data: {
        request_id: row.id,
        actor_type: "project_user",
        actor_id: userId,
        action: "request_submitted",
        meta: { project_name: row.project_name },
      },
    });

    return { kind: "ok" };
  });

  if (outcome.kind === "not_found") return { success: false, code: "not_found" };
  if (outcome.kind === "invalid") return { success: false, code: "invalid", errors: outcome.errors };
  return { success: true };
}

/**
 * The admin decision that actually opens a request to the market: flip to
 * collecting, START the quote window here (board B-4), create one delivery
 * per ACTIVE firm, then email AFTER commit. An email failure NEVER fails the
 * approval: it degrades that delivery to email_status "failed", visible in
 * the drill-down. Quotes are not pre-created; auditors create their own.
 */
export async function approveRequestAndFanout(
  requestId: string,
  adminUserId: string,
  adminName: string,
): Promise<ApprovalResult> {
  const outcome = await prisma.$transaction(async (tx): Promise<ApproveOutcome> => {
    // Status pinned in the where clause: a second approval is a no-op, so a
    // double click can never fan out twice.
    const row = await tx.auditRequest.findFirst({
      where: { id: requestId, status: "pending_review" },
      select: FANOUT_REQUEST_SELECT,
    });
    if (!row) return { kind: "not_found" };

    const quote_deadline =
      row.quote_deadline ?? new Date(Date.now() + QUOTE_DEADLINE_DEFAULT_DAYS * DAY);

    await tx.auditRequest.update({
      where: { id: row.id, status: "pending_review" },
      data: { status: "collecting", quote_deadline },
    });

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

    await tx.auditEventLog.createMany({
      data: [
        {
          request_id: row.id,
          actor_type: "admin",
          actor_id: adminUserId,
          action: "request_approved",
          meta: { admin_name: adminName },
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

    return { kind: "ok", auditors, request: toFanoutRequest({ ...row, quote_deadline }) };
  });

  if (outcome.kind === "not_found") return { success: false, code: "not_found" };

  const { emailFailures } = await deliverFanoutEmails(requestId, outcome.auditors, outcome.request);
  return { success: true, auditorCount: outcome.auditors.length, emailFailures };
}

/**
 * The other side of the decision. Writes nothing to any firm: a rejected
 * request never had delivery rows to begin with. The reason is admin-side
 * context on the trail, not project-facing copy.
 */
export async function rejectRequest(
  requestId: string,
  adminUserId: string,
  adminName: string,
  reason: string,
): Promise<{ success: boolean }> {
  const updated = await prisma.auditRequest.updateMany({
    where: { id: requestId, status: "pending_review" },
    data: { status: "rejected", closed_at: new Date() },
  });
  if (updated.count === 0) return { success: false };

  await prisma.auditEventLog.create({
    data: {
      request_id: requestId,
      actor_type: "admin",
      actor_id: adminUserId,
      action: "request_rejected",
      meta: { admin_name: adminName, reason },
    },
  });

  return { success: true };
}

/**
 * Post-commit best-effort sends with one delivery-row status update each.
 * Shared by submission and reopen; an email failure NEVER fails the caller,
 * it degrades that delivery to email_status "failed".
 */
export async function deliverFanoutEmails(
  requestId: string,
  auditors: FanoutFirm[],
  request: FanoutRequest,
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
