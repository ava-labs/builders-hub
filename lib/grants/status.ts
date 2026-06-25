export const GRANT_STATUSES = ["submitted", "under_review", "approved", "rejected"] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

// How the 5-valued review verdict (FormData.final_verdict, set by the devrel in
// the evaluate dashboard) maps onto the applicant-facing status.
const APPROVED_VERDICTS = new Set(["top", "strong"]);
const REJECTED_VERDICTS = new Set(["weak", "reject"]);

/**
 * Effective application status, derived from the review outcome:
 * - approved / rejected come from the final verdict (top/strong → approved,
 *   weak/reject → rejected),
 * - "maybe" or no final verdict yet → under_review once any evaluation exists,
 * - otherwise submitted.
 *
 * The review IS the decision: there is no separate approve/reject step — the
 * status follows whatever the devrel sets as the final verdict.
 */
export function deriveStatus(
  finalVerdict: string | null | undefined,
  evaluationCount: number,
): GrantStatus {
  if (finalVerdict && APPROVED_VERDICTS.has(finalVerdict)) return "approved";
  if (finalVerdict && REJECTED_VERDICTS.has(finalVerdict)) return "rejected";
  return evaluationCount > 0 ? "under_review" : "submitted";
}
