import type { CSSProperties, ReactNode } from "react";
import type { Names } from "@/lib/explorer-query/types";
import { matches, type Selection } from "@/lib/explorer-query/selection";
import type { Panel } from "@/lib/explorer-query/visual-spec";

/* what the parts of an answer's sheet share: the inks, a row, the selection tests and a panel's props */

/* ink for what is counted, red only for what failed, then the categorical
   inks for further series */
export const TONES = ["currentColor", "#0061E2", "#0d9488", "#d97706", "#7c3aed"];
const FAIL = /revert|fail|error|drop/i;
export const toneOf = (s: { column: string; label: string }, i: number) => (FAIL.test(`${s.column} ${s.label}`) ? "#E6212F" : TONES[i % TONES.length]);
export const MONO = { fontSize: 10, fontFamily: "var(--font-geist-mono)" };
/** the selection's one accent: brush, picked range */
export const ACCENT = "#0061E2";
/** how far an unselected mark recedes */
export const DIM = 0.22;
/** a scatter's dot in the pointer's focus, and the dots around it */
export const DOT_INK = { "--qv-on": 1, "--qv-off": 0.35 } as CSSProperties;

export type Row = Record<string, unknown>;
/* ------------------------------------------------------------------ */
/* selection helpers                                                   */

export const inSelection = (sel: Selection, r: Row) => sel.every((p) => matches(r, p));
export const pickValue = (v: unknown): string | number => (typeof v === "number" ? v : String(v ?? ""));

/** a percent's digits, before its %: whole from 10, one place below */
export const pct = (p: number) => (p >= 10 || p === 0 ? p.toFixed(0) : p.toFixed(1));

/* ------------------------------------------------------------------ */
/* one panel                                                           */

export type PanelProps = {
  panel: Panel;
  /** a control the page adds to the panel header, e.g. pin to a board */
  action?: ReactNode;
  /** draw the panel's own title; off where a tile already names it */
  titled?: boolean;
  /** every row of the answer; marks outside the selection dim, they do not leave */
  rows: Row[];
  names: Names;
  sym: string;
  canDrill: boolean;
  onPick: (row: Row) => void;
  /** the x value of the group whose records are open */
  selected?: unknown;
  /** the x value under the pointer anywhere on the page (a table row, another panel) */
  hoverKey?: unknown;
  onHoverKey?: (k: unknown) => void;
  /** the page's whole selection, for writing back */
  selection: Selection;
  /** the picks on columns these rows have: what dims and filters */
  live: Selection;
  onSelection?: (s: Selection) => void;
  compact: boolean;
  /** a log y axis: one outlier no longer flattens every other mark */
  log?: boolean;
  /** the rows stop at a LIMIT: a share of them is not a share of the whole */
  cut?: boolean;
};
