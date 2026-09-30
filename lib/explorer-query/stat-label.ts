/* A headline stat's figure and the words that must match it. Over an answer whose rows a LIMIT cut, the page shows a
   stat's figure over the whole answer, from the totals read past the limit, so its label names that whole, never the
   rows shown: "Top 20 fees" over a ranking of the hour's 20 largest fees showed the fees of all 10,910 transactions of
   the hour, 59.3 AVAX, where the 20 paid 6.4. And an extreme of the rows' own averages says average. */

import type { Totals } from "./types";
import type { Stat } from "./visual";

/** a stat's figure over the whole answer, when a LIMIT cut its rows and its totals were read, or null */
export function wholeFigure(totals: Totals | null | undefined, s: Pick<Stat, "agg" | "column">): number | null {
  if (!totals) return null;
  const c = s.column;
  switch (s.agg) {
    case "sum":
      return totals.sum[c] ?? null;
    case "avg":
      return totals.count[c] ? totals.sum[c] / totals.count[c] : null;
    case "max":
      return totals.max[c] ?? null;
    case "min":
      return totals.min[c] ?? null;
    case "count":
      return totals.rows;
    case "distinct":
      return totals.distinct[c] ?? null;
    default:
      return null;
  }
}

/** words that name the rows shown, not the whole answer */
const SHOWN = /\b(?:top|first|these|shown|listed|largest|highest|biggest)\b/i;

/** why stats that show the whole answer's figure are labelled for the rows shown, or null. A max or a min is left be:
    a ranking's own peak is the whole answer's */
export function wholeLabel(stats: readonly Pick<Stat, "label" | "sub" | "agg" | "column">[], shown: number, totals: Totals | null | undefined): string | null {
  if (!totals || totals.rows <= shown) return null;
  const count = new RegExp(`\\b${shown}\\b`);
  const bad = stats.filter((s) => {
    const words = `${s.label} ${s.sub ?? ""}`;
    return s.agg !== "max" && s.agg !== "min" && wholeFigure(totals, s) !== null && (SHOWN.test(words) || count.test(words));
  });
  if (!bad.length) return null;
  const which = bad.map((s) => `"${s.label}"`).join(", ");
  return `${which} ${bad.length > 1 ? "show their figures" : "shows its figure"} over all ${totals.rows} rows, not the ${shown} here: the LIMIT cut the rest, and a stat's sum, average, count or distinct reads them all. Name the whole set ("Fees burned", "Transactions"), or show max or min`;
}

/* the highest or lowest of the rows' own averages is an average, not a price paid: the final audit's X04 read "Peak
   gas price 35.58 gwei", the highest hour's average, where the highest price paid was 19,999.92 gwei. A stat of one
   whose label and sub never say so says average ("Peak average gas price") */
const AVERAGE_NAME = /(?:^|_)(?:avg|average|mean)(?:_|$)/i;
const SAYS_AVERAGE = /\b(?:avg|averages?|mean|median|typical)\b/i;
const EXTREME_WORD = /^(?:peak|highest|lowest|top|max(?:imum)?|min(?:imum)?|busiest|cheapest)\b/i;
export function averageLabel<S extends { label: string; sub?: string; agg: string; column: string }>(s: S): S {
  if ((s.agg !== "max" && s.agg !== "min") || !AVERAGE_NAME.test(s.column) || SAYS_AVERAGE.test(`${s.label} ${s.sub ?? ""}`)) return s;
  const m = EXTREME_WORD.exec(s.label);
  return { ...s, label: m ? `${m[0]} average${s.label.slice(m[0].length)}` : `${s.label} (average)` };
}
