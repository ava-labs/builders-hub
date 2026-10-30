// Audit marketplace status vocabulary. Columns store plain strings (house
// convention, see lib/grants/status.ts); these const maps are the single
// source of the allowed values, and display states are DERIVED at read time
// so no cron ever has to flip a stored status.

import { DECISION_LIMIT_START, DECISION_WINDOW_DAYS } from "@/lib/audits/constants";

// "pending_review" is where every submission now lands: nothing reaches an
// auditor until an admin approves it, so a bad request cannot spam the
// whitelist. "rejected" is the terminal side of that decision.
export const STORED_REQUEST_STATUSES = [
  "draft",
  "pending_review",
  "rejected",
  "collecting",
  "engaged",
  "withdrawn",
] as const;
export type StoredRequestStatus = (typeof STORED_REQUEST_STATUSES)[number];

// "deciding" (quotes ready) and "expired" exist only at read time:
// collecting past its deadline becomes deciding with quotes, expired without,
// and expired too once its pick-by date passes with no quote accepted.
export const DISPLAY_REQUEST_STATUSES = [
  "draft",
  "pending_review",
  "rejected",
  "collecting",
  "deciding",
  "engaged",
  "expired",
  "withdrawn",
] as const;
export type DisplayRequestStatus = (typeof DISPLAY_REQUEST_STATUSES)[number];

export const QUOTE_STATUSES = ["submitted", "accepted", "not_selected", "withdrawn"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const DISPLAY_QUOTE_STATUSES = [...QUOTE_STATUSES, "expired"] as const;
export type DisplayQuoteStatus = (typeof DISPLAY_QUOTE_STATUSES)[number];

// A firm quotes its duration in weeks or in days (Joey, 2026-09-30), and the
// unit is stored as picked so the quote reads back the way the firm wrote it.
// Weeks come first: every quote before days existed was in weeks.
export const QUOTE_DURATION_UNITS = ["weeks", "days"] as const;
export type QuoteDurationUnit = (typeof QUOTE_DURATION_UNITS)[number];

// Full vocabulary kept for forward compatibility; v1 only ever writes
// approved | declined (subsidy is admin-side only, decided after acceptance).
export const SUBSIDY_STATES = ["none", "requested", "approved", "declined", "paid"] as const;
export type SubsidyState = (typeof SUBSIDY_STATES)[number];

export const SUBSIDY_DECISION_STATES = ["approved", "declined"] as const;
export type SubsidyDecisionState = (typeof SUBSIDY_DECISION_STATES)[number];

export const DEPLOYMENT_TARGETS = ["c_chain", "own_l1", "fuji_only"] as const;
export type DeploymentTarget = (typeof DEPLOYMENT_TARGETS)[number];

export const URGENCY_OPTIONS = ["within_3_weeks", "within_6_weeks", "flexible"] as const;
export type UrgencyOption = (typeof URGENCY_OPTIONS)[number];

// "bounced" needs a SendGrid event webhook that does not exist yet; failed
// covers both send errors and rejections in v1.
export const FANOUT_EMAIL_STATUSES = ["queued", "sent", "failed"] as const;
export type FanoutEmailStatus = (typeof FANOUT_EMAIL_STATUSES)[number];

export const AUDIT_ACTOR_TYPES = ["project_user", "auditor", "admin", "system"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_EVENT_ACTIONS = [
  "request_submitted",
  "request_approved",
  "request_rejected",
  "request_returned_to_draft",
  "fanout_created",
  "quote_submitted",
  "quote_updated",
  "quote_accepted",
  "contacts_revealed",
  "subsidy_approved",
  "subsidy_declined",
  "request_withdrawn",
  "request_reopened",
  "request_restarted",
  "request_deleted",
  "auditor_added",
  "auditor_updated",
  "auditor_deactivated",
  "auditor_reactivated",
  "auditor_invite_resent",
  "auditor_first_login",
  "auditor_member_added",
  "auditor_member_removed",
] as const;
export type AuditEventAction = (typeof AUDIT_EVENT_ACTIONS)[number];

const DECISION_WINDOW_MS = DECISION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** The pick-by date: the end of the decision window after a quote deadline. */
export function decisionDeadline(quoteDeadline: Date): Date {
  const start = Math.max(quoteDeadline.getTime(), DECISION_LIMIT_START.getTime());
  return new Date(start + DECISION_WINDOW_MS);
}

/**
 * The last millisecond of `date`'s UTC calendar day. Every stored quote
 * deadline is one (2026-10-20): "closes 2026-10-29" means the whole of the
 * 29th, 23:59 UTC, for every firm in every time zone.
 */
export function endOfUtcDay(date: Date): Date {
  // setUTCHours, not Date.UTC: Date.UTC reads years 0 to 99 as 1900 to 1999.
  const end = new Date(date.getTime());
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** A deadline as emails and pages print it, "2026-10-29 23:59 UTC": the stored
    instant, so a row stored before the 23:59 rule shows its real time. */
export function formatUtcDeadline(deadline: Date | string): string {
  return `${new Date(deadline).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** The "23:59" of a deadline, for sentences that print the date apart. */
export function formatUtcTime(deadline: Date | string): string {
  return new Date(deadline).toISOString().slice(11, 16);
}

/**
 * Whether the project may still accept a quote: the request is stored
 * "collecting" and its pick-by date has not passed (an early pick while
 * quotes are open included). deriveRequestStatus reads it, and the acceptance
 * write carries it as oldestAcceptableQuoteDeadline, so the screens and the
 * service can never disagree.
 */
export function isAcceptanceOpen(
  request: { status: string; quote_deadline: Date | null },
  now: Date = new Date(),
): boolean {
  if (request.status !== "collecting") return false;
  if (!request.quote_deadline) return true;
  return now <= decisionDeadline(request.quote_deadline);
}

/**
 * isAcceptanceOpen as a where clause: the oldest quote deadline whose pick-by
 * date has not passed at `now`, or null while DECISION_LIMIT_START still holds
 * every decision window open.
 */
export function oldestAcceptableQuoteDeadline(now: Date = new Date()): Date | null {
  const oldest = new Date(now.getTime() - DECISION_WINDOW_MS);
  return oldest <= DECISION_LIMIT_START ? null : oldest;
}

/**
 * Effective request status shown everywhere in the UI.
 * Stored draft / engaged / withdrawn pass through untouched. A stored
 * "collecting" row stays collecting until its quote deadline passes, then
 * reads as "deciding" (quotes ready) when at least one quote came in, until
 * its pick-by date passes. It reads "expired" when no quote came in
 * (reopenable) or none was accepted in time (lapsed: it starts again from a
 * copy). A missing deadline never expires a request: submission always sets
 * one, so this is purely defensive.
 */
export function deriveRequestStatus(
  row: { status: string; quote_deadline: Date | null },
  quoteCount: number,
  now: Date = new Date(),
): DisplayRequestStatus {
  if (row.status !== "collecting") return row.status as DisplayRequestStatus;
  if (!row.quote_deadline || now <= row.quote_deadline) return "collecting";
  return quoteCount > 0 && isAcceptanceOpen(row, now) ? "deciding" : "expired";
}

/**
 * How a quote reads once its request has moved on: a still-"submitted" quote
 * on an expired or withdrawn request displays as expired. Every other stored
 * quote status is already the answer.
 */
export function deriveQuoteDisplayStatus(
  quoteStatus: string,
  requestDisplayStatus: DisplayRequestStatus,
): DisplayQuoteStatus {
  if (quoteStatus !== "submitted") return quoteStatus as DisplayQuoteStatus;
  if (requestDisplayStatus === "expired" || requestDisplayStatus === "withdrawn") {
    return "expired";
  }
  return "submitted";
}

// What an admin may delete for good: every submitted request but an engaged
// one, whose accepted quote and subsidy decisions are the program's record of
// what it funds. Drafts belong to their owner and never reach the admin views.
export const ADMIN_DELETABLE_STATUSES = [
  "pending_review",
  "rejected",
  "collecting",
  "withdrawn",
] as const satisfies readonly StoredRequestStatus[];

/**
 * Whether an admin may delete a request, by its stored status. Shared by the
 * delete service and the admin page so the two can never disagree.
 */
export function isAdminDeletable(storedStatus: string): boolean {
  return (ADMIN_DELETABLE_STATUSES as readonly string[]).includes(storedStatus);
}

/**
 * Whether an auditor may still create or edit a quote: the request must be
 * stored "collecting" and the deadline must not have passed. Shared by the
 * quote PUT route and the composer so the two can never disagree.
 */
export function isQuoteWindowOpen(
  request: { status: string; quote_deadline: Date | null },
  now: Date = new Date(),
): boolean {
  if (request.status !== "collecting") return false;
  if (!request.quote_deadline) return true;
  return now <= request.quote_deadline;
}
