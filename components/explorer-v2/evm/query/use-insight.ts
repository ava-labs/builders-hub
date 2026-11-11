"use client";

/* what the page says about an answer beyond its rows: the findings, the answer beside the period before it, and
   the questions it raises. All of it is worked out on the page from the rows it holds. */

import { useMemo } from "react";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";
import { comparedTo, type Compared } from "./compare";
import { findingsOf, type Finding } from "./findings";
import { nextAsks } from "./followups";
import { priorWords, type Prior } from "./stat-figures";

export interface Insight {
  findings: Finding[];
  /** the answer beside the period before it, when a chart of it can show both */
  comparable: Compared | null;
  /** the chip that switches the comparison on */
  compareLabel: string;
  asks: string[];
}

export function useInsight({ answer, visual, drawn, prior, laying, sym, fuji }: { answer: QueryAnswer | null; visual: VisualSpec | null; /** the visual with its cut edge buckets labelled */ drawn: VisualSpec | null; prior: Prior | null; laying: boolean; sym: string; /** Fuji keeps the page it had: no questions are offered */ fuji: boolean }): Insight {
  const findings = useMemo(
    () => (answer?.result && !answer.monitor && !laying ? findingsOf({ columns: answer.result.columns, rows: answer.result.rows, names: answer.names, visual, chart: answer.chart, sql: answer.sql, anchor: answer.anchor, totals: answer.totals, prior, span: answer.span, sym }) : []),
    [answer, visual, prior, laying, sym],
  );
  const before = priorWords(answer?.span);
  const rows = answer?.result?.rows;
  const comparable = useMemo(() => (rows ? comparedTo(drawn ?? visual, rows, prior, before.charAt(0).toUpperCase() + before.slice(1)) : null), [drawn, visual, rows, prior, before]);
  const asks = useMemo(() => (answer?.result?.rowCount && !answer.monitor && !fuji ? nextAsks(findings, answer.followups) : []), [answer, findings, fuji]);
  return { findings, comparable, compareLabel: `Compare with ${before.startsWith("prior") ? "the " : ""}${before}`, asks };
}
