import { formatNumber, truncate, zoneName, zoneStamp } from "@/components/explorer-v2/format";
import { msOf } from "@/lib/explorer-query/edges";
import type { Names } from "@/lib/explorer-query/types";
import type { Format } from "@/lib/explorer-query/visual";
import { DAY, MONTHS_SHORT, isAddress, isHash, isTime } from "@/lib/explorer-query/values";

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

/** the time zone a chart's x reads in. The rows write UTC. Days, weeks and months all start at a UTC midnight, and a
    series of them keeps the UTC day it counts: in a western viewer's zone that midnight is the evening before. Any
    other series reads in the viewer's zone, as the node page's hours do */
export function zoneOf(xs: unknown[], viewer = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const ts = xs.filter(isTime);
  return ts.length > 0 && ts.every((v) => msOf(v) % DAY === 0) ? "UTC" : viewer;
}

/** a UTC time of the rows as the rows would write it in `zone` */
const inZone = (v: string, zone: string) => (zone === "UTC" ? v.replace("T", " ") : zoneStamp(msOf(v) / 1000, zone));

export function fmtX(v: unknown, span: Span, zone = "UTC"): string {
  if (isTime(v)) {
    const s = inZone(v, zone);
    if (span === "days") return s.slice(5, 10);
    if (span === "hours") return s.slice(5, 16);
    return s.slice(11, 16);
  }
  return typeof v === "number" ? formatNumber(v) : String(v ?? "");
}

/** a tooltip's x: a time of day with the zone it reads in (22:11 EDT), a day as the axis writes it */
export function tipX(v: unknown, span: Span, zone = "UTC"): string {
  const t = fmtX(v, span, zone);
  return isTime(v) && t.includes(":") ? `${t} ${zoneName(msOf(v) / 1000, zone)}` : t;
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

export function xText(names: Names, x: string | undefined, v: unknown, span: Span, zone = "UTC"): string {
  const name = nameFor(names, x, v);
  if (name) return clip(name);
  if (isAddress(v) || isHash(v)) return truncate(v, 6);
  if (typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v)) return v.toLowerCase();
  return clip(fmtX(v, span, zone));
}

/** a time as a person says it: "Sep 3", or "Sep 3 14:00" inside a day */
function when(v: string, zone: string): { day: string; hm: string } {
  const s = inZone(v, zone);
  const hm = v.length > 10 ? s.slice(11, 16) : "";
  return { day: `${MONTHS_SHORT[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}`, hm: hm === "00:00" ? "" : hm };
}

export function chipValue(names: Names, column: string, v: string | number, zone = "UTC"): string {
  if (typeof v === "string" && isTime(v)) {
    const w = when(v, zone);
    return w.hm ? `${w.day} ${w.hm}` : w.day;
  }
  return xText(names, column, v, "other");
}

export function chipRange(names: Names, column: string, from: string | number, to: string | number, zone = "UTC"): string {
  if (from === to) return chipValue(names, column, from, zone);
  if (typeof from === "string" && typeof to === "string" && isTime(from) && isTime(to)) {
    const a = when(from, zone);
    const b = when(to, zone);
    if (a.day === b.day) return a.hm || b.hm ? `${a.day} ${a.hm || "00:00"} to ${b.hm || "24:00"}` : a.day;
    return `${a.hm ? `${a.day} ${a.hm}` : a.day} to ${b.hm ? `${b.day} ${b.hm}` : b.day}`;
  }
  return `${chipValue(names, column, from, zone)} to ${chipValue(names, column, to, zone)}`;
}
