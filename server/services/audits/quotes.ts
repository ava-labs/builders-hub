import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { isQuoteWindowOpen } from "@/lib/audits/status";
import { logAuditEvent } from "@/server/services/audits/events";
import { getOwnQuote } from "@/server/services/audits/visibility";
import type { AuditQuoteInput } from "@/types/audits";

export type UpsertQuoteResult =
  | { success: true; updated: boolean }
  | { success: false; code: "not_invited" | "window_closed" | "not_active" };

/**
 * Create or edit the firm's OWN quote. Reads go through visibility (the sole
 * AuditQuote reader); this module is one of the two enumerated writers (see
 * tests/unit/audits/sourceGuard.test.ts). The window rule is shared with the
 * composer via isQuoteWindowOpen so UI and server can never disagree:
 * editable until the request's quote deadline, on a stored-collecting
 * request only.
 */
export async function upsertOwnQuote(
  auditor: { id: string; firm_name: string; active: boolean; actor_email: string },
  requestId: string,
  input: AuditQuoteInput,
): Promise<UpsertQuoteResult> {
  // Deactivated firms keep read-only portal access (N-4); writes stay shut
  // here too so the rule holds even if a route wrapper loosens.
  if (!auditor.active) return { success: false, code: "not_active" };

  // The fan-out delivery row is the invitation; without it this request does
  // not exist for the firm.
  const delivery = await prisma.auditFanoutDelivery.findUnique({
    where: { request_id_auditor_id: { request_id: requestId, auditor_id: auditor.id } },
    select: { request_id: true },
  });
  if (!delivery) return { success: false, code: "not_invited" };

  const request = await prisma.auditRequest.findUnique({
    where: { id: requestId },
    select: { status: true, quote_deadline: true, project_name: true },
  });
  if (!request || !isQuoteWindowOpen(request)) {
    return { success: false, code: "window_closed" };
  }

  const existing = await getOwnQuote(auditor.id, requestId);
  const data = {
    price_usd: input.price_usd,
    duration_weeks: input.duration_weeks,
    earliest_start: input.earliest_start,
    message: input.message,
    deal_doc_url: input.deal_doc_url ?? null,
    // Who saved it: the approved address behind this session. Revealed to the
    // project as the firm's contact once accepted (no main address per firm).
    submitted_by_email: auditor.actor_email,
  };

  let updated = Boolean(existing);
  if (existing) {
    await prisma.auditQuote.update({
      where: { request_id_auditor_id: { request_id: requestId, auditor_id: auditor.id } },
      data,
    });
  } else {
    try {
      await prisma.auditQuote.create({
        data: { request_id: requestId, auditor_id: auditor.id, ...data },
      });
    } catch (error) {
      // Two tabs racing the first submit: the unique (request, auditor) key
      // wins and the second write lands as an edit.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        await prisma.auditQuote.update({
          where: { request_id_auditor_id: { request_id: requestId, auditor_id: auditor.id } },
          data,
        });
        updated = true;
      } else {
        throw error;
      }
    }
  }

  await logAuditEvent(prisma, {
    request_id: requestId,
    actor_type: "auditor",
    actor_id: auditor.id,
    action: updated ? "quote_updated" : "quote_submitted",
    meta: {
      firm_name: auditor.firm_name,
      price_usd: input.price_usd,
      actor_email: auditor.actor_email,
    },
  });

  return { success: true, updated };
}
