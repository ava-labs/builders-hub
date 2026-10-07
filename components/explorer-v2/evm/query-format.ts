import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { order } from "@/lib/explorer-query/selection";
import type { Names } from "@/lib/explorer-query/types";
import type { Format } from "@/lib/explorer-query/visual";
import { MONTHS_SHORT, isAddress, isHash, isTime } from "@/lib/explorer-query/values";

/* A query answer's figures and times as the page writes them: in the
   unit the designer named, in a table, on an axis or on a selection
   chip, and the name a decoded value reads as. Shared by the answer's
   charts, its rows, its inspector and the city's answer window. */

export type Span = "minutes" | "hours" | "days" | "other";

export function spanOf(xs: unknown[]): Span {
  const ts = xs.filter(isTime).map((s) => new Date(s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00Z" : "Z")).getTime());
  if (ts.length < 2) return "other";
  const w = Math.max(...ts) - Math.min(...ts);
  return w <= 3 * 3600e3 ? "minutes" : w <= 3 * 86400e3 ? "hours" : "days";
}

export function fmtX(v: unknown, span: Span): string {
  if (isTime(v)) {
    const s = v.replace("T", " ");
    if (span === "days") return s.slice(5, 10);
    if (span === "hours") return s.slice(5, 16);
    return s.slice(11, 16);
  }
  return typeof v === "number" ? formatNumber(v) : String(v ?? "");
}

/** "1.20M", "12.3k", "9,999": compact to fixed places, and k only from 10,000 (compact in format.ts is Intl's: 1.2M, 12K) */
function compactFixed(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  return Number.isInteger(v) ? formatNumber(v) : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** a figure in the unit the designer named. An axis tick is bare: no unit where the chart names it (AVAX, gas), and
    none of the zeros fixed places add, since the ticks beside it give its precision (0 30 60, 1.5, 360B, 12%, not
    0.00 30.000 60.000, 1.50, 360.00B, 12.0%) */
export function fmt(v: unknown, format: Format, sym: string, axis = false): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v ?? "");
  return axis ? fixed(v, format, sym, true).replace(/\.(\d*?)0+(?=[kMBT%]?(?: s)?$)/, (_m, d: string) => (d ? `.${d}` : "")) : fixed(v, format, sym, false);
}

/** a figure to its unit's fixed places */
function fixed(v: number, format: Format, sym: string, axis: boolean): string {
  // a figure's size picks its places, so an outflow below zero reads as its inflow does (-3,000, not -3.00e+3)
  const a = Math.abs(v);
  switch (format) {
    case "percent":
      return `${a >= 10 || v === 0 ? v.toFixed(1) : v.toFixed(2)}%`;
    case "avax":
      return `${a >= 1000 ? compactFixed(v) : a >= 1 ? v.toFixed(3) : a >= 0.001 ? v.toFixed(5) : v.toPrecision(3)}${axis ? "" : ` ${sym}`}`;
    case "gas":
      return `${compactFixed(v)}${axis ? "" : " gas"}`;
    case "seconds":
      return `${v.toFixed(2)} s`;
    case "usd":
      return `${v < 0 ? "-" : ""}$${a >= 1000 ? compactFixed(a) : a.toFixed(2)}`;
    case "compact":
      return compactFixed(v);
    default:
      return axis
        ? compactFixed(v)
        : Number.isInteger(v)
          ? formatNumber(v)
          : Math.abs(v) >= 1
            ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : v.toPrecision(3);
  }
}

export function nameFor(names: Names, col: string | undefined, v: unknown): string | undefined {
  return col && typeof v === "string" ? names[col]?.[v.toLowerCase()] : undefined;
}

const clip = (t: string, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function xText(names: Names, x: string | undefined, v: unknown, span: Span): string {
  const name = nameFor(names, x, v);
  if (name) return clip(name);
  if (isAddress(v) || isHash(v)) return truncate(v, 6);
  if (typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v)) return v.toLowerCase();
  return clip(fmtX(v, span));
}

/** a time as a person says it: "Sep 3", or "Sep 3 14:00" inside a day */
function when(v: string): { day: string; hm: string } {
  const d = new Date(order(v) as number);
  const hm = v.length > 10 ? v.replace("T", " ").slice(11, 16) : "";
  return { day: `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`, hm: hm === "00:00" ? "" : hm };
}

export function chipValue(names: Names, column: string, v: string | number): string {
  if (typeof v === "string" && isTime(v)) {
    const w = when(v);
    return w.hm ? `${w.day} ${w.hm}` : w.day;
  }
  return xText(names, column, v, "other");
}

export function chipRange(names: Names, column: string, from: string | number, to: string | number): string {
  if (from === to) return chipValue(names, column, from);
  if (typeof from === "string" && typeof to === "string" && isTime(from) && isTime(to)) {
    const a = when(from);
    const b = when(to);
    if (a.day === b.day) return a.hm || b.hm ? `${a.day} ${a.hm || "00:00"} to ${b.hm || "24:00"}` : a.day;
    return `${a.hm ? `${a.day} ${a.hm}` : a.day} to ${b.hm ? `${b.day} ${b.hm}` : b.day}`;
  }
  return `${chipValue(names, column, from)} to ${chipValue(names, column, to)}`;
}
