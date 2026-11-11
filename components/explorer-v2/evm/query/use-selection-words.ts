"use client";

/* the reader's picks in words: for the page, and for the model */

import { useMemo } from "react";
import { truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";
import { type Selection, describe } from "@/lib/explorer-query/selection";
import { isAddress, isHash, isTime } from "@/lib/explorer-query/values";
import { fmt, nameFor, tipX, zoneOf } from "../query-format";
import { formatOf, header } from "../QueryRows";
import type { Row } from "./sheet";

export function useSelectionWords({
  sel,
  allRows,
  names,
  visual,
  sym,
}: {
  sel: Selection;
  allRows: Row[];
  names: Names;
  visual: VisualSpec | null;
  sym: string;
}): { selWords: string; selForModel: () => string } {
  /** a picked value in words a person reads: its name, its clock, its figure */
  const humanValue = (col: string, v: unknown): string => {
    const n = nameFor(names, col, v);
    if (n) return n;
    // in the zone the chart's axis and chips read in, named: the words also go to the model, which reads UTC rows
    if (isTime(v)) return tipX(v, "hours", zoneOf(allRows.map((r) => r[col])));
    if (isAddress(v) || isHash(v)) return truncate(v, 5);
    if (typeof v === "number") return fmt(v, formatOf(col, visual), sym);
    return String(v ?? "");
  };
  const selWords = useMemo(() => {
    if (!sel.length) return "";
    const back: Record<string, string> = {};
    const human = sel.map((p) => {
      const h = header(p.column);
      back[h] = p.column;
      return { ...p, column: h };
    });
    return describe(human, (h, v) => humanValue(back[h] ?? h, v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, names, visual, sym]);
  // the same filter as the model needs it: raw columns and values, names beside
  const selForModel = () =>
    describe(sel, (col, v) => {
      const n = nameFor(names, col, v);
      return n ? `${String(v)} (${n})` : String(v);
    });
  return { selWords, selForModel };
}
