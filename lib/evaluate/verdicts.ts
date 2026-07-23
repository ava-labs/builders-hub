/**
 * The single source of truth for the review verdict vocabulary.
 *
 * It used to be spelled out independently in the two evaluate routes, in
 * components/evaluate/types.ts, and (as two Sets) in lib/grants/status.ts — so a
 * change in one place would silently desync the others: an added verdict would
 * pass validation on write and then fall through to "under_review" on read.
 */
export const VERDICTS = ["top", "strong", "maybe", "weak", "reject"] as const;

export type Verdict = (typeof VERDICTS)[number];

export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}
