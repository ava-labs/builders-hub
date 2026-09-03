// Audit marketplace status vocabulary. Columns store plain strings (house
// convention, see lib/grants/status.ts); these const maps are the single
// source of the allowed values, and display states are DERIVED at read time
// so no cron ever has to flip a stored status.

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
// collecting past its deadline becomes deciding with quotes, expired without.
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

/**
 * Effective request status shown everywhere in the UI.
 * Stored draft / engaged / withdrawn pass through untouched. A stored
 * "collecting" row stays collecting until its quote deadline passes, then
 * reads as "deciding" (quotes ready) when at least one quote came in, or
 * "expired" (reopenable) when none did. A missing deadline never expires a
 * request: submission always sets one, so this is purely defensive.
 */
export function deriveRequestStatus(
  row: { status: string; quote_deadline: Date | null },
  quoteCount: number,
  now: Date = new Date(),
): DisplayRequestStatus {
  if (row.status !== "collecting") return row.status as DisplayRequestStatus;
  if (!row.quote_deadline || now <= row.quote_deadline) return "collecting";
  return quoteCount > 0 ? "deciding" : "expired";
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
