import { prisma } from "@/prisma/prisma";
import {
  deriveQuoteDisplayStatus,
  deriveRequestStatus,
  type DisplayQuoteStatus,
  type DisplayRequestStatus,
} from "@/lib/audits/status";

/**
 * THE ONLY MODULE ALLOWED TO READ AuditQuote.
 *
 * Quote visibility is a query-layer rule, not UI hiding: every function here
 * is scope-shaped (owner / auditor / admin) and pins the caller's identity in
 * the where clause, so data another audience must not see is structurally
 * unreachable. A test walks the audit source tree and fails if any other file
 * mentions auditQuote (tests/unit/audits/visibility.test.ts, source guard,
 * lands with the auditor portal phase).
 */

// What the owner may see about a quoting firm. quote_email is stripped below
// unless that quote was accepted (contacts reveal only after acceptance).
const OWNER_QUOTE_AUDITOR_SELECT = {
  firm_name: true,
  services: true,
  quote_email: true,
} as const;

export interface OwnerRequestSummary {
  id: string;
  project_name: string;
  description: string;
  services: string[];
  nsloc: number | null;
  status: string;
  display_status: DisplayRequestStatus;
  quote_count: number;
  /** min/max of received quotes, for the "quotes ready" list cards. */
  quote_price_range: { min: number; max: number } | null;
  quote_deadline: Date | null;
  needed_by: Date | null;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface OwnerQuote {
  id: string;
  price_usd: number;
  duration_weeks: number;
  earliest_start: Date;
  message: string;
  reaudit_included: boolean;
  status: string;
  display_status: DisplayQuoteStatus;
  firm_name: string;
  services: string[];
  /** Present only on the accepted quote. */
  quote_email?: string;
}

export interface OwnerSubsidyOutcome {
  state: string;
  pct: number;
  program_amount_usd: number;
  project_amount_usd: number;
}

export async function getOwnerRequests(userId: string): Promise<OwnerRequestSummary[]> {
  const rows = await prisma.auditRequest.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    // Prices only: the list cards show count + range, never quote content.
    include: { quotes: { select: { price_usd: true } } },
  });

  return rows.map((row) => {
    const prices = row.quotes.map((quote) => quote.price_usd);
    return {
      id: row.id,
      project_name: row.project_name,
      description: row.description,
      services: row.services,
      nsloc: row.nsloc,
      status: row.status,
      display_status: deriveRequestStatus(row, prices.length),
      quote_count: prices.length,
      quote_price_range:
        prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      quote_deadline: row.quote_deadline,
      needed_by: row.needed_by,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

export async function getOwnerRequestDetail(userId: string, requestId: string) {
  const row = await prisma.auditRequest.findFirst({
    where: { id: requestId, user_id: userId },
    include: {
      quotes: {
        orderBy: { price_usd: "asc" },
        include: { auditor: { select: OWNER_QUOTE_AUDITOR_SELECT } },
      },
      // Latest decision wins (append-only history).
      subsidy_decisions: { orderBy: { decided_at: "desc" }, take: 1 },
      // "N of M firms have quoted" on the collecting banner.
      _count: { select: { fanout_deliveries: true } },
    },
  });
  if (!row) return null;

  const display_status = deriveRequestStatus(row, row.quotes.length);

  const quotes: OwnerQuote[] = row.quotes.map((quote) => ({
    id: quote.id,
    price_usd: quote.price_usd,
    duration_weeks: quote.duration_weeks,
    earliest_start: quote.earliest_start,
    message: quote.message,
    reaudit_included: quote.reaudit_included,
    status: quote.status,
    display_status: deriveQuoteDisplayStatus(quote.status, display_status),
    firm_name: quote.auditor.firm_name,
    services: quote.auditor.services,
    // Contacts reveal both ways only after acceptance.
    ...(quote.status === "accepted" ? { quote_email: quote.auditor.quote_email } : {}),
  }));

  // The project sees the OUTCOME only: never the deciding admin, never the note.
  const decision = row.subsidy_decisions[0];
  const subsidy: OwnerSubsidyOutcome | null = decision
    ? {
        state: decision.state,
        pct: decision.pct,
        program_amount_usd: decision.program_amount_usd,
        project_amount_usd: decision.project_amount_usd,
      }
    : null;

  const { quotes: _quotes, subsidy_decisions: _decisions, _count, ...request } = row;
  return {
    ...request,
    display_status,
    quote_count: quotes.length,
    fanout_count: _count.fanout_deliveries,
    quotes,
    subsidy,
  };
}

export type OwnerRequestDetail = NonNullable<Awaited<ReturnType<typeof getOwnerRequestDetail>>>;
