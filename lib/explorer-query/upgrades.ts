/* Network upgrades in a question. The writer is told each upgrade's
   mainnet activation (constants/network-upgrades.ts, from AvalancheGo's
   mainnet config), so "since Helicon" is a date it can read from, and the
   guard lets that date be written out (guard.ts literalWindow). Without
   them the P-Chain writer answered "has the % of circulating avax staked
   increased since the helicon upgrade" with no chart in 6 of 6 runs: "the
   Helicon activation date is not in the data". No server-only imports:
   the guard is in the page's bundle. */

import { MAINNET_UPGRADES, UNSCHEDULED_UPGRADES, type NetworkUpgrade } from "@/constants/network-upgrades";
import { msOf } from "./edges";
import { isFuji } from "./target";
import { DAY } from "./values";
import type { SourceNote } from "./types";
import type { VisualSpec } from "./visual";

/** the names no other word on Avalanche uses */
const NAMED = /\b(?:apricot(?:\s*phase)?\s*|ap)([1-6])\b|\b(banff|cortina|durango|etna|helicon)\b/gi;
/** the names that are plain words too (a token, a protocol): an upgrade only beside a word of time, "upgrade", or
    another upgrade's name ("between Helicon and Granite") */
const PLAIN = /\b(?:since|before|after|pre|post|until|around|during|between|than|vs\.?|versus)\s+(?:the\s+)?(fortuna|granite)\b|\b(fortuna|granite)\s+(?:network\s+)?(?:upgrade|activation|activated|went live)\b|\b(?:banff|cortina|durango|etna|helicon|fortuna|granite)\s+(?:and|or|to|vs\.?)\s+(?:the\s+)?(fortuna|granite)\b/gi;
/** "since the last upgrade", "after the upgrade": the newest upgrade that has activated. Not "current", which a
    versions question uses */
const LATEST = /\b(?:last|latest|newest|most recent)\s+(?:network\s+)?upgrade\b|\b(?:since|after|before|pre|post)\s+the\s+(?:network\s+)?upgrade\b/i;
/** "the September upgrade", "the March 2024 upgrade": the newest upgrade of that month (and year) */
const MONTHLY = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:(\d{4})\s+)?(?:network\s+)?upgrade\b/i;
const UNSCHEDULED = new RegExp(`\\b(?:${UNSCHEDULED_UPGRADES.join("|")})\\b`, "i");

/** an upgrade's activation as the SQL and the turn write it, in UTC: 2026-09-22 15:00:00 */
export const upgradeTime = (u: NetworkUpgrade) => new Date(u.at).toISOString().slice(0, 19).replace("T", " ");
const upgradeDay = (u: NetworkUpgrade) => upgradeTime(u).slice(0, 10);
const longDay = (u: NetworkUpgrade) => new Date(u.at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** the upgrades a question names, oldest first; "the last upgrade" is the newest one that has activated */
export function namedUpgrades(prompt: string, now = Date.now()): NetworkUpgrade[] {
  const names = new Set<string>();
  for (const m of prompt.matchAll(NAMED)) names.add(m[1] ? `Apricot Phase ${m[1]}` : m[2].toLowerCase());
  for (const m of prompt.matchAll(PLAIN)) names.add((m[1] ?? m[2] ?? m[3]).toLowerCase());
  const past = MAINNET_UPGRADES.filter((u) => u.at <= now);
  const latest = LATEST.test(prompt) ? past.at(-1) : undefined;
  const month = MONTHLY.exec(prompt);
  const ofMonth = month
    ? past.filter((u) => new Date(u.at).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase() === month[1].toLowerCase() && (!month[2] || new Date(u.at).getUTCFullYear() === Number(month[2]))).at(-1)
    : undefined;
  return MAINNET_UPGRADES.filter((u) => names.has(u.name) || names.has(u.name.toLowerCase()) || u === latest || u === ofMonth);
}

/** whether a question names an upgrade, scheduled or not: its activation is a date the question names */
export const namesUpgrade = (prompt: string) => namedUpgrades(prompt).length > 0 || UNSCHEDULED.test(prompt);

/** the system prompt's line: every upgrade's mainnet activation, so a question that names one needs no lookup */
export function upgradesLine(table: boolean): string {
  const times = MAINNET_UPGRADES.map((u) => `${u.name} ${upgradeTime(u).slice(0, 16)}`).join(", ");
  const read = table
    ? "network_upgrades holds them, one row per upgrade (upgrade, activated_at, acps): our server sends it with the query, so a read of it needs no time bound. "
    : "";
  return `- Network upgrades: each Avalanche network upgrade activated on mainnet at a fixed time (UTC, from AvalancheGo's mainnet config): ${times}. ${UNSCHEDULED_UPGRADES.join(", ")} has no mainnet time yet. ${read}A question about the time before, after or since an upgrade compares the days before its activation with the days since, in one series, and its title and note name the upgrade and its date (a date that never changes, so the note may write it).`;
}

/** the turn's line for a question that names an upgrade: its activation, and the window that compares before and
    after it. An EVM chain's tables limit how far one query reads, so its window starts no earlier than that. The rule
    is in the system prompt too (upgradesLine), so a change to it writes kept recipes again */
export function upgradeTurn(prompt: string, now = new Date(), evm = false): string {
  const named = namedUpgrades(prompt, now.getTime());
  const unscheduled = UNSCHEDULED.test(prompt) ? ` ${UNSCHEDULED_UPGRADES.join(", ")} has no mainnet activation time yet: say so, and answer what the tables hold.` : "";
  if (named.length === 0) return unscheduled;
  const at = named.map((u) => `${u.name} activated on mainnet at ${upgradeTime(u)} UTC (${longDay(u)})`).join("; ");
  const first = named[0];
  // daily buckets for an upgrade of the last 400 days, weekly ones before: Durango's days to now are 950 rows
  const weekly = now.getTime() - first.at > 400 * DAY;
  const from = weekly ? `toMonday(toDate('${upgradeDay(first)}')) - INTERVAL 4 WEEK` : `toDate('${upgradeDay(first)}') - INTERVAL 30 DAY`;
  const window =
    named.length === 1
      ? `A question about the time before, after or since it reads ${weekly ? "weekly" : "daily"} buckets from ${from} to now, unless it names another window, so one series holds the ${weekly ? "weeks" : "days"} before ${first.name} and the ${weekly ? "weeks" : "days"} since`
      : `Read the window from ${from} to now, unless the question names another`;
  const limit = evm ? " If that window passes a table's limit, start at the limit, and the note says the chart starts after the upgrade." : "";
  return ` ${at}. ${window}; the title and note name the upgrade and its date.${limit}${unscheduled}`;
}

/** a time chart of a question that names an upgrade marks the bucket its activation falls in, on each time panel
    whose rows reach it, where the designer did not: the date is ours, so the mark never depends on the model */
export function markUpgrades(visual: VisualSpec, question: string, rows: readonly Record<string, unknown>[], chainId: number, now = Date.now()): VisualSpec {
  // the times are mainnet's: Fuji's upgrades activated on other days
  if (isFuji(chainId)) return visual;
  const named = namedUpgrades(question, now);
  if (!named.length) return visual;
  const panels = visual.panels.map((p) => {
    if (!p.x || !["line", "bar", "area"].includes(p.kind)) return p;
    const xs = [...new Set(rows.map((r) => r[p.x!]))].filter((v) => Number.isFinite(msOf(v))).sort((a, b) => msOf(a) - msOf(b));
    if (xs.length < 2) return p;
    const markers = [...p.markers];
    for (const u of named) {
      const at = xs.filter((v) => msOf(v) <= u.at).at(-1);
      // the activation lies inside the rows: after the first bucket starts, and before the last one ends
      if (at === undefined || u.at >= msOf(xs.at(-1)) + (msOf(xs.at(-1)) - msOf(xs.at(-2)))) continue;
      // a mark that names the upgrade is the designer's own; a mark of another figure on its day keeps its place beside it
      if (markers.length < 4 && !markers.some((m) => m.label.includes(u.name))) markers.push({ x: at as string, label: u.name });
    }
    return { ...p, markers };
  });
  return { ...visual, panels };
}

/** a figure that is a level of its day (a share, a price, a stake): its days average, where counts add up */
const LEVEL = /pct|percent|share|ratio|rate|price|avg|average|median|mean|supply|stak|balance|apy|apr|tvl|per_/i;
const PERCENT = /pct|percent|share/i;

const dayWords = (t: number, now: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(new Date(t).getUTCFullYear() === new Date(now).getUTCFullYear() ? {} : { year: "numeric" }), timeZone: "UTC" });

function figure(v: number, column: string): string {
  if (PERCENT.test(column) && Math.abs(v) <= 100) return `${v.toFixed(2)}%`;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  return a >= 100 ? v.toFixed(0) : String(Number(v.toPrecision(3)));
}

/** the line under an answer whose question names one upgrade and whose series spans its activation: the series before
    and since it, from whole buckets on each side (the bucket that holds the activation and one still filling are left
    out), and its last whole bucket. A reading drawn from two days ("flat") answered "has it increased since Helicon"
    where the days since averaged 2.3 points below the days before. Made from the rows on every run, never kept */
export function upgradeLines(question: string, chart: { x?: string; series: readonly { column: string; label: string }[] }, rows: readonly Record<string, unknown>[], chainId: number, now = Date.now()): SourceNote[] {
  const named = namedUpgrades(question, now);
  const column = chart.series[0]?.column;
  if (isFuji(chainId) || named.length !== 1 || !chart.x || !column) return [];
  const u = named[0];
  const points = rows
    .map((r) => ({ t: msOf(r[chart.x!]), v: r[column] === null || r[column] === undefined ? NaN : Number(r[column]) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return [];
  let step = Infinity;
  for (let i = 1; i < points.length; i++) if (points[i].t > points[i - 1].t) step = Math.min(step, points[i].t - points[i - 1].t);
  if (!Number.isFinite(step)) return [];
  const whole = points.filter((p) => Number.isFinite(p.v) && p.t + step <= now);
  const before = whole.filter((p) => p.t + step <= u.at);
  const since = whole.filter((p) => p.t > u.at);
  if (before.length < 3 || since.length < 3) return [];
  const level = LEVEL.test(column);
  const unit = step >= 7 * DAY ? "week" : step >= DAY ? "day" : "hour";
  const span = (ps: typeof whole) => `${dayWords(ps[0].t, now)} to ${dayWords(ps.at(-1)!.t, now)}`;
  const sum = (ps: typeof whole) => ps.reduce((s, p) => s + p.v, 0);
  const said = (ps: typeof whole) => (level ? `${figure(sum(ps) / ps.length, column)} on average` : `${figure(sum(ps), column)} in all, ${figure(sum(ps) / ps.length, column)} a ${unit}`);
  const last = whole.at(-1)!;
  const text = `${chart.series[0].label}: ${said(before)} in the ${before.length} ${unit}s before ${u.name} (${span(before)}), and ${said(since)} in the ${since.length} ${unit}s since (${span(since)}). The last whole ${unit}, ${dayWords(last.t, now)}: ${figure(last.v, column)}.`;
  return [{ table: "network_upgrades", label: "", at: now, total: 0, known: 0, text }];
}
