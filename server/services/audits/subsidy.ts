import { prisma } from "@/prisma/prisma";
import { SUBSIDY_MAX_PCT } from "@/lib/audits/subsidy";
import { logAuditEvent } from "@/server/services/audits/events";
import { getAcceptedQuoteForAdmin } from "@/server/services/audits/visibility";
import { sendSubsidyDecisionNotice } from "@/server/services/audits/emails/sendSubsidyDecisionNotice";
import type { SubsidyDecisionInput } from "@/types/audits";

export type DecideSubsidyResult =
  | { success: true; decision_id: string }
  | { success: false; code: "invalid_state" | "over_cap" };

/** What the transaction hands back: the decision plus who to notify. */
type CommitOutcome =
  | { success: false; code: "invalid_state" }
  | {
      success: true;
      decision_id: string;
      notify: { email: string | null; project_name: string };
    };

/**
 * Records a subsidy decision. APPEND-ONLY: every call creates a new row and
 * the latest by decided_at wins at read time; nothing ever updates or
 * deletes a decision. The split is computed here, at decision time, from the
 * accepted quote's price (immutable once engaged, so the pre-transaction
 * read is safe; the state guard re-runs inside the transaction). A decline
 * stores pct 0 regardless of where the slider sat.
 */
export async function decideSubsidy(
  requestId: string,
  input: SubsidyDecisionInput,
  admin: { id: string; name: string },
): Promise<DecideSubsidyResult> {
  const accepted = await getAcceptedQuoteForAdmin(requestId);
  if (!accepted) return { success: false, code: "invalid_state" };

  const cap = Math.floor((accepted.price_usd * SUBSIDY_MAX_PCT) / 100);
  const program_amount_usd = input.state === "declined" ? 0 : input.program_amount_usd;
  if (program_amount_usd > cap) return { success: false, code: "over_cap" };
  const split = {
    program_amount_usd,
    project_amount_usd: accepted.price_usd - program_amount_usd,
  };
  // Display-only: the exact amounts above are what count.
  const pct =
    accepted.price_usd > 0 ? Math.round((program_amount_usd / accepted.price_usd) * 100) : 0;

  const committed = await prisma.$transaction(async (tx): Promise<CommitOutcome> => {
    const request = await tx.auditRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        accepted_quote_id: true,
        project_name: true,
        // The account email, never the wizard's contact field: request input
        // must not be able to aim program mail at a third party.
        user: { select: { email: true } },
      },
    });
    if (!request || request.status !== "engaged" || request.accepted_quote_id !== accepted.id) {
      return { success: false, code: "invalid_state" as const };
    }

    const decision = await tx.auditSubsidyDecision.create({
      data: {
        request_id: requestId,
        quote_id: accepted.id,
        state: input.state,
        pct,
        program_amount_usd: split.program_amount_usd,
        project_amount_usd: split.project_amount_usd,
        decided_by: admin.id,
        note: input.note ?? null,
      },
    });

    // The approval is logged with the admin's name; the name stays
    // admin-side (the project only ever reads the outcome).
    await logAuditEvent(tx, {
      request_id: requestId,
      actor_type: "admin",
      actor_id: admin.id,
      action: input.state === "approved" ? "subsidy_approved" : "subsidy_declined",
      meta: {
        pct,
        program_amount_usd: split.program_amount_usd,
        admin_name: admin.name,
      },
    });

    return {
      success: true as const,
      decision_id: decision.id,
      notify: {
        email: request.user?.email ?? null,
        project_name: request.project_name,
      },
    };
  });

  if (!committed.success) return committed;

  // AFTER commit and non-fatal, like every other send in this program: a mail
  // failure must never undo a recorded decision. The admin sees the outcome
  // in the trail either way. Both sides hear it, and one recipient failing
  // must not stop the other, hence allSettled over a shared try.
  const notice = {
    request_id: requestId,
    project_name: committed.notify.project_name,
    state: input.state,
    program_amount_usd: split.program_amount_usd,
    project_amount_usd: split.project_amount_usd,
    pct,
  };
  const sends = await Promise.allSettled([
    committed.notify.email
      ? sendSubsidyDecisionNotice(committed.notify.email, notice, "project")
      : Promise.resolve(),
    ...accepted.recipient_emails.map((email) =>
      sendSubsidyDecisionNotice(email, notice, "auditor"),
    ),
  ]);
  sends
    .filter((send): send is PromiseRejectedResult => send.status === "rejected")
    .forEach((send) => console.error("[Audits] subsidy decision notice failed:", send.reason));

  return { success: true as const, decision_id: committed.decision_id };
}
