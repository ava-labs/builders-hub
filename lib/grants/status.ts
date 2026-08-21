import { isVerdict, type Verdict } from "@/lib/evaluate/verdicts";

export const GRANT_STATUSES = ["submitted", "under_review", "approved", "rejected"] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

// How the review verdict (FormData.final_verdict, set by the devrel in the
// evaluate dashboard) maps onto the applicant-facing status. Keyed by Verdict, so
// adding a verdict to the shared vocabulary fails the build here until it is
// given a mapping, rather than silently reading back as "under_review".
// null = decided-but-not-terminal: fall through to the evaluation-count rule.
const STATUS_BY_VERDICT: Record<Verdict, GrantStatus | null> = {
  top: "approved",
  strong: "approved",
  maybe: null,
  weak: "rejected",
  reject: "rejected",
};

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
  if (finalVerdict) {
    if (!isVerdict(finalVerdict)) {
      // Only reachable via a direct DB write or a vocabulary change that skipped
      // this map. Don't guess an outcome — fall through, but say so.
      console.error("[Grants] Unrecognized final_verdict, treating as undecided:", finalVerdict);
    } else {
      const status = STATUS_BY_VERDICT[finalVerdict];
      if (status) return status;
    }
  }
  return evaluationCount > 0 ? "under_review" : "submitted";
}
