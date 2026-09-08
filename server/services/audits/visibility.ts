import { prisma } from "@/prisma/prisma";
import { firmContact, recipientsOf } from "@/server/services/audits/emails/recipients";
import {
  deriveQuoteDisplayStatus,
  deriveRequestStatus,
  isQuoteWindowOpen,
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
// members feed the contact check only and are never projected.
const OWNER_QUOTE_AUDITOR_SELECT = {
  firm_name: true,
  services: true,
  quote_email: true,
  members: { select: { email: true } },
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
  /** The firm's own proposal or SOW, if it attached one. */
  deal_doc_url: string | null;
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
    deal_doc_url: quote.deal_doc_url,
    status: quote.status,
    display_status: deriveQuoteDisplayStatus(quote.status, display_status),
    firm_name: quote.auditor.firm_name,
    services: quote.auditor.services,
    // Contacts reveal both ways only after acceptance: the teammate who saved
    // the quote (2026-09-02) while that address is still approved, otherwise
    // the firm's quote email (removed teammates, pre-team-access quotes).
    ...(quote.status === "accepted"
      ? { quote_email: firmContact(quote.auditor, quote.submitted_by_email) }
      : {}),
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

// ── Auditor scope ───────────────────────────────────────────────────────────
// Every function pins auditor_id unconditionally; an auditor's inbox is
// exactly its AuditFanoutDelivery rows. These projections NEVER include
// contact_* or the requesting user; contacts attach only once the firm's own
// quote is accepted (both facts are pinned by tests).

// What an auditor may ever see about a request, before winning it.
const AUDITOR_SAFE_REQUEST_SELECT = {
  id: true,
  project_name: true,
  description: true,
  scope: true,
  project_types: true,
  deployment_target: true,
  multichain: true,
  services: true,
  repos: true,
  languages: true,
  frameworks: true,
  nsloc: true,
  doc_links: true,
  attachments: true,
  needed_by: true,
  quote_deadline: true,
  urgency: true,
  status: true,
  submitted_at: true,
  created_at: true,
} as const;

const AUDITOR_INBOX_REQUEST_SELECT = {
  id: true,
  project_name: true,
  description: true,
  services: true,
  nsloc: true,
  languages: true,
  frameworks: true,
  repos: true,
  needed_by: true,
  quote_deadline: true,
  urgency: true,
  status: true,
  submitted_at: true,
  // The won card's "engaged {date}" pill (board 1b); the request's own close
  // date, no contact or competitor data.
  closed_at: true,
} as const;

export interface AuditorOwnQuote {
  id: string;
  status: string;
  price_usd: number;
  updated_at: Date;
}

export async function getAuditorInbox(auditorId: string) {
  const [deliveries, ownQuotes] = await Promise.all([
    prisma.auditFanoutDelivery.findMany({
      where: { auditor_id: auditorId },
      orderBy: { created_at: "desc" },
      include: { request: { select: AUDITOR_INBOX_REQUEST_SELECT } },
    }),
    prisma.auditQuote.findMany({
      where: { auditor_id: auditorId },
      select: { id: true, request_id: true, status: true, price_usd: true, updated_at: true },
    }),
  ]);

  const quoteByRequest = new Map(ownQuotes.map((quote) => [quote.request_id, quote]));
  return deliveries.map((delivery) => {
    const quote = quoteByRequest.get(delivery.request_id) ?? null;
    return {
      request: delivery.request,
      own_quote: quote
        ? {
            id: quote.id,
            status: quote.status,
            price_usd: quote.price_usd,
            updated_at: quote.updated_at,
          }
        : null,
      window_open: isQuoteWindowOpen(delivery.request),
    };
  });
}

export type AuditorInboxItem = Awaited<ReturnType<typeof getAuditorInbox>>[number];

export interface AuditorContacts {
  contact_name: string;
  contact_email: string;
  contact_handle: string | null;
  contact_calendar_url: string | null;
}

export async function getRequestForAuditor(auditorId: string, requestId: string) {
  // The fan-out delivery row IS the invitation: without it the request does
  // not exist for this firm (routes 404).
  const delivery = await prisma.auditFanoutDelivery.findUnique({
    where: { request_id_auditor_id: { request_id: requestId, auditor_id: auditorId } },
    select: { request_id: true },
  });
  if (!delivery) return null;

  const request = await prisma.auditRequest.findFirst({
    where: { id: requestId },
    select: AUDITOR_SAFE_REQUEST_SELECT,
  });
  if (!request) return null;

  const own_quote = await getOwnQuote(auditorId, requestId);

  // Contacts reveal both ways only after acceptance.
  let contacts: AuditorContacts | null = null;
  // The winning firm also sees the funding split: part of its fee may be
  // coming from the program, which changes who it invoices. Latest decision
  // only, and only for the firm that won.
  let subsidy: { state: string; program_amount_usd: number; pct: number } | null = null;
  if (own_quote?.status === "accepted") {
    contacts = await prisma.auditRequest.findUnique({
      where: { id: requestId },
      select: {
        contact_name: true,
        contact_email: true,
        contact_handle: true,
        contact_calendar_url: true,
      },
    });
    const decision = await prisma.auditSubsidyDecision.findFirst({
      where: { request_id: requestId },
      orderBy: { decided_at: "desc" },
      select: { state: true, program_amount_usd: true, pct: true },
    });
    // A decline is the program's own business, not the firm's: only an
    // approved subsidy changes anything for them.
    subsidy = decision?.state === "approved" ? decision : null;
  }

  return {
    ...request,
    own_quote: own_quote
      ? {
          id: own_quote.id,
          status: own_quote.status,
          price_usd: own_quote.price_usd,
          duration_weeks: own_quote.duration_weeks,
          earliest_start: own_quote.earliest_start,
          message: own_quote.message,
          deal_doc_url: own_quote.deal_doc_url,
          updated_at: own_quote.updated_at,
        }
      : null,
    contacts,
    subsidy,
    window_open: isQuoteWindowOpen(request),
  };
}

export type AuditorRequestView = NonNullable<Awaited<ReturnType<typeof getRequestForAuditor>>>;

/** The firm's OWN quote; the composite key pins auditor_id structurally. */
export async function getOwnQuote(auditorId: string, requestId: string) {
  return prisma.auditQuote.findUnique({
    where: { request_id_auditor_id: { request_id: requestId, auditor_id: auditorId } },
  });
}

// ── Admin scope ─────────────────────────────────────────────────────────────
// Admins see everything (quotes are private to "the requesting project and
// admins"); every number is derived at read time, nothing aggregated is
// stored. Drafts stay private to their owner and never appear here.

export interface AdminOverview {
  open_requests: number;
  /** Open requests whose quote deadline falls within the next 7 days. */
  open_closing_this_week: number;
  quotes_collected: number;
  /** Median quote price across OPEN requests (design tile), null when none. */
  median_quote_usd: number | null;
  engaged_count: number;
  /** 10% of accepted volume over engaged requests: what Areta would have charged. */
  fees_not_paid_usd: number;
  /** Engaged requests with no subsidy decision on file (the amber tile, board 2a). */
  needs_subsidy_count: number;
  /** Submissions waiting on the approval gate: nothing has been emailed yet. */
  pending_review_count: number;
}

export type AdminSubsidyState = "needs_approval" | "approved" | "declined" | null;

export interface AdminRequestRow {
  id: string;
  project_name: string;
  project_types: string[];
  requester_name: string | null;
  requester_email: string | null;
  submitted_at: Date | null;
  created_at: Date;
  quote_deadline: Date | null;
  display_status: DisplayRequestStatus;
  quote_count: number;
  quote_price_range: { min: number; max: number } | null;
  subsidy_state: AdminSubsidyState;
  subsidy_pct: number | null;
  subsidy_amount_usd: number | null;
  accepted_firm_price_usd: number | null;
  fanout_count: number;
}

const ADMIN_LIST_INCLUDE = {
  user: { select: { name: true, email: true } },
  quotes: { select: { price_usd: true, status: true } },
  subsidy_decisions: { orderBy: { decided_at: "desc" as const }, take: 1 },
  _count: { select: { fanout_deliveries: true } },
};

type AdminListRow = {
  id: string;
  project_name: string;
  project_types: string[];
  status: string;
  submitted_at: Date | null;
  created_at: Date;
  quote_deadline: Date | null;
  user: { name: string | null; email: string | null };
  quotes: { price_usd: number; status: string }[];
  subsidy_decisions: { state: string; pct: number; program_amount_usd: number }[];
  _count: { fanout_deliveries: number };
};

function toAdminRow(row: AdminListRow): AdminRequestRow {
  const prices = row.quotes.map((quote) => quote.price_usd);
  const display_status = deriveRequestStatus(row, prices.length);
  const latest = row.subsidy_decisions[0] ?? null;
  const accepted = row.quotes.find((quote) => quote.status === "accepted") ?? null;
  const subsidy_state: AdminSubsidyState =
    row.status === "engaged"
      ? latest
        ? (latest.state as AdminSubsidyState)
        : "needs_approval"
      : latest
        ? (latest.state as AdminSubsidyState)
        : null;

  return {
    id: row.id,
    project_name: row.project_name,
    project_types: row.project_types,
    requester_name: row.user?.name ?? null,
    requester_email: row.user?.email ?? null,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    quote_deadline: row.quote_deadline,
    display_status,
    quote_count: prices.length,
    quote_price_range:
      prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    subsidy_state,
    subsidy_pct: latest?.pct ?? null,
    subsidy_amount_usd: latest?.program_amount_usd ?? null,
    accepted_firm_price_usd: accepted?.price_usd ?? null,
    fanout_count: row._count.fanout_deliveries,
  };
}

async function fetchAdminRows(): Promise<AdminRequestRow[]> {
  const rows = await prisma.auditRequest.findMany({
    where: { status: { not: "draft" } },
    orderBy: { created_at: "desc" },
    include: ADMIN_LIST_INCLUDE,
  });
  return (rows as unknown as AdminListRow[]).map(toAdminRow);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const rows = await prisma.auditRequest.findMany({
    where: { status: { not: "draft" } },
    include: ADMIN_LIST_INCLUDE,
  });
  const mapped = (rows as unknown as AdminListRow[]).map((row) => ({
    row,
    display: deriveRequestStatus(row, row.quotes.length),
  }));

  const open = mapped.filter(
    (entry) => entry.display === "collecting" || entry.display === "deciding",
  );
  const openPrices = open
    .flatMap((entry) => entry.row.quotes.map((quote) => quote.price_usd))
    .sort((a, b) => a - b);
  const median =
    openPrices.length === 0
      ? null
      : openPrices.length % 2 === 1
        ? openPrices[(openPrices.length - 1) / 2]
        : Math.round(
            (openPrices[openPrices.length / 2 - 1] + openPrices[openPrices.length / 2]) / 2,
          );

  const engaged = mapped.filter((entry) => entry.display === "engaged");
  const acceptedVolume = engaged.reduce((sum, entry) => {
    const accepted = entry.row.quotes.find((quote) => quote.status === "accepted");
    return sum + (accepted?.price_usd ?? 0);
  }, 0);

  const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return {
    open_requests: open.length,
    open_closing_this_week: open.filter(
      (entry) =>
        entry.row.quote_deadline &&
        entry.row.quote_deadline.getTime() <= weekAhead &&
        entry.row.quote_deadline.getTime() >= Date.now(),
    ).length,
    quotes_collected: mapped.reduce((sum, entry) => sum + entry.row.quotes.length, 0),
    median_quote_usd: median,
    engaged_count: engaged.length,
    fees_not_paid_usd: Math.round(acceptedVolume * 0.1),
    needs_subsidy_count: engaged.filter((entry) => entry.row.subsidy_decisions.length === 0)
      .length,
    pending_review_count: mapped.filter((entry) => entry.display === "pending_review").length,
  };
}

export async function getAdminRequests(filters: {
  status?: DisplayRequestStatus;
  subsidy?: "none" | "approved" | "declined";
  deadline_before?: Date;
  deadline_after?: Date;
  take: number;
  skip: number;
}): Promise<AdminRequestRow[]> {
  // Program scale is tens of requests: fetch, derive, filter in JS. take is
  // schema-capped at 100.
  const rows = await fetchAdminRows();
  return rows
    .filter((row) => !filters.status || row.display_status === filters.status)
    .filter((row) => {
      if (!filters.subsidy) return true;
      if (filters.subsidy === "none") {
        return row.subsidy_state === null || row.subsidy_state === "needs_approval";
      }
      return row.subsidy_state === filters.subsidy;
    })
    .filter((row) => {
      if (filters.deadline_before && (!row.quote_deadline || row.quote_deadline > filters.deadline_before)) return false;
      if (filters.deadline_after && (!row.quote_deadline || row.quote_deadline < filters.deadline_after)) return false;
      return true;
    })
    .slice(filters.skip, filters.skip + filters.take);
}

export async function getAdminRequestDetail(requestId: string) {
  const row = await prisma.auditRequest.findFirst({
    where: { id: requestId, status: { not: "draft" } },
    include: {
      user: { select: { name: true, email: true } },
      quotes: {
        orderBy: { price_usd: "asc" },
        include: { auditor: { select: { firm_name: true, services: true, quote_email: true } } },
      },
      subsidy_decisions: {
        orderBy: { decided_at: "desc" },
        include: { decider: { select: { name: true } } },
      },
      events: { orderBy: { created_at: "desc" }, take: 100 },
      fanout_deliveries: { include: { auditor: { select: { firm_name: true } } } },
    },
  });
  if (!row) return null;

  const display_status = deriveRequestStatus(row, row.quotes.length);
  return {
    ...row,
    display_status,
    quotes: row.quotes.map((quote) => ({
      id: quote.id,
      price_usd: quote.price_usd,
      duration_weeks: quote.duration_weeks,
      earliest_start: quote.earliest_start,
      message: quote.message,
      // Admins decide subsidies against these quotes; the proposal doc is
      // part of what they are subsidizing (round-5 6b).
      deal_doc_url: quote.deal_doc_url,
      status: quote.status,
      display_status: deriveQuoteDisplayStatus(quote.status, display_status),
      firm_name: quote.auditor.firm_name,
      services: quote.auditor.services,
      quote_email: quote.auditor.quote_email,
    })),
  };
}

export type AdminRequestDetail = NonNullable<Awaited<ReturnType<typeof getAdminRequestDetail>>>;

export interface AdminAuditorMember {
  id: string;
  email: string;
  invited_at: Date;
  first_login_at: Date | null;
}

export interface AdminAuditorRow {
  id: string;
  firm_name: string;
  quote_email: string;
  services: string[];
  active: boolean;
  invited_at: Date;
  first_login_at: Date | null;
  deactivated_at: Date | null;
  attio_ref: string | null;
  sent: number;
  quoted: number;
  won: number;
  last_quote_at: Date | null;
  /** Approved teammate addresses, oldest first (the whitelist panel lists them). */
  members: AdminAuditorMember[];
}

export async function getAdminAuditors(): Promise<AdminAuditorRow[]> {
  const rows = await prisma.auditor.findMany({
    orderBy: [{ active: "desc" }, { firm_name: "asc" }],
    include: {
      _count: { select: { fanout_deliveries: true } },
      quotes: { select: { status: true, created_at: true } },
      members: {
        orderBy: { created_at: "asc" },
        select: { id: true, email: true, invited_at: true, first_login_at: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    firm_name: row.firm_name,
    quote_email: row.quote_email,
    services: row.services,
    active: row.active,
    invited_at: row.invited_at,
    first_login_at: row.first_login_at,
    deactivated_at: row.deactivated_at,
    attio_ref: row.attio_ref,
    members: row.members,
    sent: row._count.fanout_deliveries,
    quoted: row.quotes.length,
    won: row.quotes.filter((quote) => quote.status === "accepted").length,
    last_quote_at: row.quotes.reduce<Date | null>(
      (latest, quote) => (!latest || quote.created_at > latest ? quote.created_at : latest),
      null,
    ),
  }));
}

/**
 * Post-acceptance participants: the winner (for the contact reveal) and the
 * not-selected firms (for the losing notices). Server-internal only.
 */
export async function getAcceptanceParticipants(requestId: string) {
  const row = await prisma.auditRequest.findUnique({
    where: { id: requestId },
    select: {
      project_name: true,
      quotes: {
        select: {
          price_usd: true,
          status: true,
          submitted_by_email: true,
          auditor: {
            select: { firm_name: true, quote_email: true, members: { select: { email: true } } },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    project_name: row.project_name,
    winner: row.quotes.find((quote) => quote.status === "accepted") ?? null,
    losers: row.quotes.filter((quote) => quote.status === "not_selected"),
  };
}

/** The accepted quote's price for the subsidy worksheet and decision. */
export async function getAcceptedQuoteForAdmin(
  requestId: string,
): Promise<{
  id: string;
  price_usd: number;
  firm_name: string;
  quote_email: string;
  /** Every approved address of the engaged firm, for the subsidy notice. */
  recipient_emails: string[];
} | null> {
  const quote = await prisma.auditQuote.findFirst({
    where: { request_id: requestId, status: "accepted" },
    // The firm's addresses so a subsidy decision reaches everyone approved on
    // the engaged firm; always the Auditor rows' data, never request input.
    include: {
      auditor: {
        select: { firm_name: true, quote_email: true, members: { select: { email: true } } },
      },
    },
  });
  if (!quote) return null;
  return {
    id: quote.id,
    price_usd: quote.price_usd,
    firm_name: quote.auditor.firm_name,
    quote_email: quote.auditor.quote_email,
    recipient_emails: recipientsOf(quote.auditor),
  };
}
