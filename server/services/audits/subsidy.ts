import { prisma } from "@/prisma/prisma";
import { SUBSIDY_MAX_PCT } from "@/lib/audits/subsidy";
import { logAuditEvent } from "@/server/services/audits/events";
import { getAcceptedQuoteForAdmin } from "@/server/services/audits/visibility";
import type { SubsidyDecisionInput } from "@/types/audits";

export type DecideSubsidyResult =
  | { success: true; decision_id: string }
  | { success: false; code: "invalid_state" | "over_cap" };

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

  return prisma.$transaction(async (tx) => {
    const request = await tx.auditRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, accepted_quote_id: true },
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

    return { success: true as const, decision_id: decision.id };
  });
}
