import { prisma } from "@/prisma/prisma";
import { logAuditEvent } from "@/server/services/audits/events";
import { getAcceptanceParticipants } from "@/server/services/audits/visibility";
import { firmContact } from "@/server/services/audits/emails/recipients";
import { sendNotSelectedNotice } from "@/server/services/audits/emails/sendNotSelectedNotice";
import { sendQuoteAcceptedNotice } from "@/server/services/audits/emails/sendQuoteAcceptedNotice";

export type AcceptResult =
  | { success: true; firm_name: string; quote_email: string }
  | { success: false; code: "not_acceptable" };

/**
 * The decisive moment: one transaction flips the winner to accepted, the
 * siblings to not_selected, and the request to engaged. The winner write
 * CARRIES every guard in its where clause (own request, stored "collecting"
 * which allows both early accepts and quotes-ready, quote belongs, quote
 * still submitted), so this module never reads quotes: reads stay in
 * visibility.ts per the source guard, and two racing accepts settle by
 * whichever guard matches first. Events and the losing notices follow after
 * commit; a failed notice is never fatal.
 */
export async function acceptQuote(
  requestId: string,
  quoteId: string,
  userId: string,
): Promise<AcceptResult> {
  const outcome = await prisma.$transaction(async (tx) => {
    const winner = await tx.auditQuote.updateMany({
      where: {
        id: quoteId,
        request_id: requestId,
        status: "submitted",
        request: { user_id: userId, status: "collecting" },
      },
      data: { status: "accepted" },
    });
    if (winner.count === 0) return "rejected" as const;

    await tx.auditRequest.updateMany({
      where: { id: requestId, user_id: userId, status: "collecting" },
      data: { status: "engaged", accepted_quote_id: quoteId, closed_at: new Date() },
    });
    await tx.auditQuote.updateMany({
      where: { request_id: requestId, id: { not: quoteId }, status: "submitted" },
      data: { status: "not_selected" },
    });
    return "accepted" as const;
  });

  if (outcome !== "accepted") return { success: false, code: "not_acceptable" };

  const participants = await getAcceptanceParticipants(requestId);
  const winner = participants?.winner ?? null;

  if (participants && winner) {
    await logAuditEvent(prisma, {
      request_id: requestId,
      actor_type: "project_user",
      actor_id: userId,
      action: "quote_accepted",
      meta: { firm_name: winner.auditor.firm_name, price_usd: winner.price_usd },
    });
    await logAuditEvent(prisma, {
      request_id: requestId,
      actor_type: "system",
      actor_id: null,
      action: "contacts_revealed",
      meta: { firm_name: winner.auditor.firm_name, both_ways: true },
    });

    const notices = await Promise.allSettled([
      sendQuoteAcceptedNotice(winner.auditor, {
        id: requestId,
        project_name: participants.project_name,
      }),
      ...participants.losers.map((loser) =>
        sendNotSelectedNotice(loser.auditor, { project_name: participants.project_name }),
      ),
    ]);
    const failed = notices.filter((notice) => notice.status === "rejected").length;
    if (failed > 0) {
      console.error(`[Audits] ${failed} acceptance notice(s) failed for ${requestId}`);
    }
  }

  return {
    success: true,
    firm_name: winner?.auditor.firm_name ?? "",
    // The teammate who saved the winning quote is the contact (2026-09-02) while
    // that address is still approved; otherwise the firm's quote email.
    quote_email: winner ? firmContact(winner.auditor, winner.submitted_by_email) : "",
  };
}
