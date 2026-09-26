"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoardHeader } from "@/components/explorer-v2/ui";
import { MOTION, useReduced, useTween } from "@/components/explorer-v2/evm/query/motion";
import { TipPlate } from "./bits";
import { fmtCompact } from "./data";
import type { AvalancheGoRelease } from "@/lib/avalanchego-releases";
import {
  NO_VERSION,
  compareRelease,
  lagOf,
  type FacetKey,
  type Selection,
  type StatusRow,
  type TargetOption,
} from "@/lib/validator-triage";

/* How ready the Primary Network is for a release, as one board. The
   reading on the left is the share of stake on the target and the three
   ways a validator falls short of it; each is a door into the roster.
   The right side draws the same fleet twice: as two solids (nodes and
   stake, one segment per release) and as one square per validator, in
   release order, so a lagging operator shows as a colored patch. The
   squares carry the roster's filter: what the roster drops, they dim. */

export interface ReleaseShare {
  /** a release, or NO_VERSION */
  version: string;
  nodes: number;
  stake: number;
  nodePct: number;
  stakePct: number;
  current: boolean;
  /** one hex, so bars, squares and swatches match */
  paint: string;
}

const GREEN = ["#16a34a", "#4ade80", "#86efac", "#bbf7d0"];
const AMBER = ["#f59e0b", "#fbbf24", "#fcd34d"];
const RED = ["#E6212F", "#f87171", "#fca5a5"];
const UNKNOWN = "#a1a1aa";
/** behind is amber one line back and red further back: the swatch shows both */
export const BEHIND_SWATCH = `linear-gradient(135deg, ${AMBER[0]} 50%, ${RED[0]} 50%)`;

/* Newest release first, the unknown bucket last. At or past the target is
   green (newest deepest); the target's own minor line, or one line back,
   amber; anything older red. */
export function releaseShares(rows: StatusRow[], target: string): ReleaseShare[] {
  const by = new Map<string, { nodes: number; stake: number }>();
  let stakeTotal = 0;
  for (const r of rows) {
    const k = r.version ?? NO_VERSION;
    const d = by.get(k) ?? { nodes: 0, stake: 0 };
    by.set(k, { nodes: d.nodes + 1, stake: d.stake + r.stake });
    stakeTotal += r.stake;
  }
  const n = { g: 0, a: 0, r: 0 };
  const pick = (tones: string[], k: "g" | "a" | "r") => tones[Math.min(n[k]++, tones.length - 1)];
  return [...by.entries()]
    .sort(([a], [b]) => (a === NO_VERSION ? 1 : b === NO_VERSION ? -1 : compareRelease(b, a)))
    .map(([version, d]) => {
      const lag = version === NO_VERSION ? null : lagOf(version, target);
      return {
        version,
        nodes: d.nodes,
        stake: d.stake,
        nodePct: rows.length ? (d.nodes / rows.length) * 100 : 0,
        stakePct: stakeTotal > 0 ? (d.stake / stakeTotal) * 100 : 0,
        current: lag === "current",
        paint: lag === null ? UNKNOWN : lag === "current" ? pick(GREEN, "g") : lag === "near" ? pick(AMBER, "a") : pick(RED, "r"),
      };
    });
}

const TAG_WORD = { required: "required", latest: "latest", unreleased: "unreleased" } as const;

/** the key's columns at md and up: swatch, release, bar, nodes, share, stake, share, arrow */
const KEY_COLS = "gap-x-4 md:grid-cols-[1rem_9rem_minmax(0,1fr)_5rem_5rem_6rem_5rem_1.5rem]";

function versionLabel(v: string): string {
  return v === NO_VERSION ? "Unknown" : v;
}

function shortId(id: string): string {
  return `${id.slice(0, 11)}…${id.slice(-6)}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function UpgradeReadiness({
  rows,
  visible,
  target,
  targets,
  onTarget,
  required,
  latest,
  selection,
  onCut,
  nodeHref,
}: {
  rows: StatusRow[];
  /** the NodeIDs the roster is cut to; null when it is not cut */
  visible: Set<string> | null;
  target: string;
  /** the releases that can be the target, newest first */
  targets: TargetOption[];
  onTarget: (v: string) => void;
  /** the newest release its notes call mandatory */
  required: AvalancheGoRelease | null;
  /** the newest published release */
  latest: AvalancheGoRelease | null;
  selection: Selection;
  /** cut the roster to one facet's options, or clear that facet when it already is */
  onCut: (key: FacetKey, ids: string[]) => void;
  nodeHref: (nodeId: string) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const shares = useMemo(() => releaseShares(rows, target), [rows, target]);
  const paintOf = useMemo(() => new Map(shares.map((s) => [s.version, s.paint])), [shares]);
  const picked = selection.version?.length === 1 ? selection.version[0] : null;
  const lit = hover ?? picked;

  const reading = useMemo(() => {
    let stake = 0;
    const on = { nodes: 0, stake: 0 };
    const behind = { nodes: 0, stake: 0 };
    const unknown = { nodes: 0, stake: 0 };
    const offline = { nodes: 0, stake: 0 };
    for (const r of rows) {
      stake += r.stake;
      const bucket = r.status === "current" ? on : r.status === "behind" ? behind : unknown;
      bucket.nodes++;
      bucket.stake += r.stake;
      if (r.online === false) {
        offline.nodes++;
        offline.stake += r.stake;
      }
    }
    return {
      stakePct: stake > 0 ? (on.stake / stake) * 100 : 0,
      nodePct: rows.length ? (on.nodes / rows.length) * 100 : 0,
      on,
      behind,
      unknown,
      offline,
    };
  }, [rows]);

  const stakeTween = useTween(reading.stakePct, 500);
  const cutIs = (key: FacetKey, id: string) => selection[key]?.length === 1 && selection[key]?.[0] === id;

  return (
    <div className="border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <BoardHeader
        label="Upgrade Readiness"
        display
        action={
          <div className="-my-1 hidden max-w-[70%] sm:flex">
            <TargetPicker id="readiness-target-head" targets={targets} target={target} onTarget={onTarget} />
          </div>
        }
      />
      {/* a phone has no room beside the title: the picker gets its own strip */}
      <div className="border-b border-zinc-100 px-5 py-2 sm:hidden dark:border-zinc-900">
        <TargetPicker id="readiness-target-strip" targets={targets} target={target} onTarget={onTarget} />
      </div>

      <div className="grid gap-8 px-5 py-6 md:px-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-10">
        {/* the reading: how much of the network is on the target, and who is not */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Stake on {target}+</span>
            <span className="font-mono text-[44px] leading-none tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {(stakeTween ?? reading.stakePct).toFixed(1)}
              <span className="ml-1 text-[20px] text-zinc-400 dark:text-zinc-500">%</span>
            </span>
            <span className="font-mono text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {reading.on.nodes.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} validators · {reading.nodePct.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col border-y border-zinc-100 dark:border-zinc-900">
            <ShortfallRow
              label="Behind target"
              title={`Validators that run a release older than ${target}`}
              swatch={<span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: BEHIND_SWATCH }} />}
              part={reading.behind}
              active={cutIs("status", "behind")}
              onClick={() => onCut("status", ["behind"])}
            />
            <ShortfallRow
              label="Unknown version"
              title="The crawler did not complete a handshake with these validators. They are offline, or they run a release that the network does not accept."
              swatch={<span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: UNKNOWN }} />}
              part={reading.unknown}
              active={cutIs("status", "unknown")}
              onClick={() => onCut("status", ["unknown"])}
            />
            <ShortfallRow
              label="Offline"
              title="Validators that the P-Chain API node is not connected to"
              swatch={<span className="h-2.5 w-2.5 rounded-[2px] ring-[1.5px] ring-inset ring-zinc-400 dark:ring-zinc-500" />}
              part={reading.offline}
              active={cutIs("online", "no")}
              onClick={() => onCut("online", ["no"])}
            />
          </div>
        </div>

        {/* the fleet, drawn twice: by share, then one square per validator */}
        <div className="flex min-w-0 flex-col gap-6" onMouseLeave={() => setHover(null)}>
          <Solid label="Nodes" shares={shares} share={(s) => s.nodePct} lit={lit} onHover={setHover} onPick={(v) => onCut("version", [v])} />
          <Solid label="Stake" shares={shares} share={(s) => s.stakePct} lit={lit} onHover={setHover} onPick={(v) => onCut("version", [v])} />
          <FleetGrid rows={rows} paintOf={paintOf} visible={visible} lit={lit} nodeHref={nodeHref} />
        </div>
      </div>

      {(required || latest) && <ReleaseLine required={required} latest={latest} />}

      {/* the key, one row a release: also a way into the roster */}
      <div className={cn(KEY_COLS, "hidden border-t border-zinc-200 px-6 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid dark:border-zinc-800 dark:text-zinc-500")}>
        <span />
        <span>Release</span>
        <span />
        <span className="text-right">Nodes</span>
        <span className="text-right">Share</span>
        <span className="text-right">Stake</span>
        <span className="text-right">Share</span>
        <span />
      </div>
      <ul className="border-t border-zinc-200 dark:border-zinc-800" onMouseLeave={() => setHover(null)}>
        {shares.map((s) => {
          const on = picked === s.version;
          const dim = lit !== null && lit !== s.version;
          const tag = targets.find((t) => t.version === s.version)?.tag;
          return (
            <li key={s.version} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
              <button
                type="button"
                onMouseEnter={() => setHover(s.version)}
                onFocus={() => setHover(s.version)}
                onBlur={() => setHover(null)}
                onClick={() => onCut("version", [s.version])}
                aria-pressed={on}
                className={cn(
                  "group grid w-full grid-cols-[1rem_minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-2.5 text-left transition-[background-color,opacity] duration-200 md:px-6",
                  KEY_COLS,
                  on ? "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  dim && "opacity-45",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.paint }} />
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className={cn("font-mono text-[12.5px] tabular-nums", s.current ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400")}>{versionLabel(s.version)}</span>
                  {tag && <span className={cn("truncate font-mono text-[9px] uppercase tracking-[0.12em]", tag === "required" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500")}>{TAG_WORD[tag]}</span>}
                </span>
                <span className="block h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(s.nodePct > 0 ? 1 : 0, s.nodePct)}%`, background: s.paint }} />
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                  {s.nodes.toLocaleString("en-US")}
                  <span className="text-zinc-400 md:hidden dark:text-zinc-500"> · {s.nodePct.toFixed(1)}%</span>
                </span>
                <span className="hidden font-mono text-[12px] tabular-nums text-zinc-500 md:block md:text-right dark:text-zinc-400">{s.nodePct.toFixed(1)}%</span>
                <span className="hidden font-mono text-[12px] tabular-nums text-zinc-500 md:block md:text-right dark:text-zinc-400">
                  {fmtCompact(s.stake)} <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                </span>
                <span className="hidden font-mono text-[12px] tabular-nums text-zinc-500 md:block md:text-right dark:text-zinc-400">{s.stakePct.toFixed(1)}%</span>
                <ArrowRight className={cn("hidden h-3.5 w-3.5 justify-self-end transition-all md:block", on ? "rotate-90 text-[#0061E2]" : "text-zinc-300 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100")} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** the target release as a row of pills, each tagged required, latest or unreleased */
function TargetPicker({
  id,
  targets,
  target,
  onTarget,
}: {
  /** the sliding pill's layout id; unique per mounted picker */
  id: string;
  targets: TargetOption[];
  target: string;
  onTarget: (v: string) => void;
}) {
  const reduced = useReduced();
  return (
    <div role="radiogroup" aria-label="Target release" className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Target</span>
      {targets.map((t) => {
        const on = t.version === target;
        return (
          <button
            key={t.version}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onTarget(t.version)}
            title={`${t.nodes.toLocaleString("en-US")} validator${t.nodes === 1 ? "" : "s"} on ${t.version}`}
            className={cn(
              "relative flex shrink-0 items-baseline gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] tabular-nums transition-colors",
              on ? "text-white dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {on && <motion.span layoutId={id} transition={reduced ? { duration: 0 } : MOTION} className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
            <span className="relative">{t.version}</span>
            {t.tag && (
              <span
                className={cn(
                  "relative text-[9px] uppercase tracking-[0.12em]",
                  on ? "text-white/70 dark:text-zinc-900/60" : t.tag === "required" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500",
                )}
              >
                {TAG_WORD[t.tag]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** one way to fall short of the target, with its count and stake; a door into the roster */
function ShortfallRow({
  label,
  title,
  swatch,
  part,
  active,
  onClick,
}: {
  label: string;
  title: string;
  swatch: React.ReactNode;
  part: { nodes: number; stake: number };
  active: boolean;
  onClick: () => void;
}) {
  const none = part.nodes === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={none && !active}
      aria-pressed={active}
      title={title}
      className={cn(
        "group grid grid-cols-[0.625rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-zinc-100 py-2.5 text-left transition-colors last:border-b-0 disabled:cursor-default dark:border-zinc-900",
        active ? "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10" : "enabled:hover:bg-zinc-50 dark:enabled:hover:bg-zinc-900",
      )}
    >
      <span className="flex items-center">{swatch}</span>
      <span className={cn("truncate font-mono text-[11.5px]", none ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300")}>{label}</span>
      <span className={cn("font-mono text-[13px] tabular-nums", none ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-900 dark:text-zinc-50")}>{part.nodes.toLocaleString("en-US")}</span>
      <span className="w-28 whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {none ? "" : `${fmtCompact(part.stake)} AVAX`}
        {!none && <ArrowRight className={cn("ml-1 inline h-3 w-3 transition-all", active ? "rotate-90 text-[#0061E2]" : "text-zinc-300 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100")} />}
      </span>
    </button>
  );
}

/** the required release and, when newer, the latest one, in the notes' own words */
function ReleaseLine({ required, latest }: { required: AvalancheGoRelease | null; latest: AvalancheGoRelease | null }) {
  const lines = [
    required ? { kind: "Required", r: required } : null,
    latest && latest.version !== required?.version ? { kind: "Latest", r: latest } : null,
  ].filter((l): l is { kind: string; r: AvalancheGoRelease } => l !== null);
  return (
    <div className="flex flex-col gap-1.5 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/30">
      {lines.map(({ kind, r }) => (
        <p key={kind} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-100">{kind}</span>
          <span className="tabular-nums text-zinc-900 dark:text-zinc-50">v{r.version}</span>
          {r.publishedAt && <span className="tabular-nums">released {shortDate(r.publishedAt)}</span>}
          <span>·</span>
          <span className="min-w-0 font-sans text-[12px] text-zinc-600 dark:text-zinc-300">{r.deadline ?? (r.mandatory ? "Mandatory upgrade." : "Optional release.")}</span>
          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[#0061E2] hover:underline dark:text-[#5f9dff]">
            Release notes <ArrowUpRight className="h-3 w-3" />
          </a>
        </p>
      ))}
    </div>
  );
}

/** one extruded bar, cut into releases */
function Solid({
  label,
  shares,
  share,
  lit,
  onHover,
  onPick,
}: {
  label: string;
  shares: ReleaseShare[];
  share: (s: ReleaseShare) => number;
  lit: string | null;
  onHover: (v: string | null) => void;
  onPick: (v: string) => void;
}) {
  const parts = shares.map((s) => ({ s, w: share(s) })).filter((p) => p.w > 0);
  const total = parts.reduce((sum, p) => sum + p.w, 0) || 1;
  const last = parts[parts.length - 1];
  const litPart = parts.find((p) => p.s.version === lit);
  const onTarget = parts.filter((p) => p.s.current).reduce((sum, p) => sum + p.w, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="font-bold text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
          {litPart ? (
            <>
              <span className="text-zinc-900 dark:text-zinc-100">{versionLabel(litPart.s.version)}</span> · {((litPart.w / total) * 100).toFixed(1)}%
            </>
          ) : (
            <>
              <span className="text-zinc-900 dark:text-zinc-100">{((onTarget / total) * 100).toFixed(1)}%</span> on target
            </>
          )}
        </span>
      </div>
      <div className="relative mr-2 mt-2 h-7">
        {/* top face: the same cut, lit */}
        <div aria-hidden className="absolute -top-2 left-0 flex h-2 w-full origin-bottom-left skew-x-[-45deg] overflow-hidden">
          {parts.map(({ s, w }) => (
            <span key={s.version} className={cn("relative h-full transition-opacity duration-200", lit && lit !== s.version && "opacity-30")} style={{ width: `${(w / total) * 100}%`, background: s.paint }}>
              <span className="absolute inset-0 bg-white/40 dark:bg-white/20" />
            </span>
          ))}
        </div>
        {/* right face: the last cut, in shade */}
        {last && (
          <span aria-hidden className={cn("absolute -right-2 top-0 h-full w-2 origin-top-left skew-y-[-45deg] transition-opacity duration-200", lit && lit !== last.s.version && "opacity-30")} style={{ background: last.s.paint }}>
            <span className="absolute inset-0 bg-black/25" />
          </span>
        )}
        {/* front face */}
        <div className="relative flex h-full w-full">
          {parts.map(({ s, w }) => (
            <button
              key={s.version}
              type="button"
              aria-label={`${versionLabel(s.version)}: ${((w / total) * 100).toFixed(1)}% of ${label.toLowerCase()}`}
              onMouseEnter={() => onHover(s.version)}
              onFocus={() => onHover(s.version)}
              onBlur={() => onHover(null)}
              onClick={() => onPick(s.version)}
              className={cn(
                "h-full min-w-px border-r border-white/60 transition-opacity duration-200 last:border-r-0 focus-visible:outline-none dark:border-black/40",
                lit && lit !== s.version && "opacity-30",
              )}
              style={{ width: `${(w / total) * 100}%`, background: s.paint }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* One square per validator, newest release first and the biggest stake
   first inside a release. An offline validator is drawn hollow. The
   roster's filter dims what it drops; a hovered release dims the rest. */
function FleetGrid({
  rows,
  paintOf,
  visible,
  lit,
  nodeHref,
}: {
  rows: StatusRow[];
  paintOf: Map<string, string>;
  visible: Set<string> | null;
  lit: string | null;
  nodeHref: (nodeId: string) => string;
}) {
  const reduced = useReduced();
  const gridRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ row: StatusRow; x: number; y: number; align: "left" | "center" | "right" } | null>(null);
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);

  const ordered = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.version !== b.version) {
          if (!a.version) return 1;
          if (!b.version) return -1;
          return compareRelease(b.version, a.version);
        }
        return b.stake - a.stake;
      }),
    [rows],
  );

  // the squares fill in once, in reading order; after that a filter change is instant
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const t = setTimeout(() => setSettled(true), 1200);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, []);

  const legend = [
    { label: "on target", swatch: <span className="h-2 w-2 rounded-[1px] bg-[#16a34a]" /> },
    { label: "behind", swatch: <span className="h-2 w-2 rounded-[1px]" style={{ background: BEHIND_SWATCH }} /> },
    { label: "unknown", swatch: <span className="h-2 w-2 rounded-[1px]" style={{ background: UNKNOWN }} /> },
    { label: "offline", swatch: <span className="h-2 w-2 rounded-[1px] ring-1 ring-inset ring-zinc-400 dark:ring-zinc-500" /> },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="font-bold text-zinc-500 dark:text-zinc-400">
          Fleet <span className="font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">· one square per validator, newest release first</span>
        </span>
        <span className="flex items-center gap-3 normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              {l.swatch}
              {l.label}
            </span>
          ))}
        </span>
      </div>
      <div ref={gridRef} className="relative" onMouseLeave={() => setTip(null)}>
        <div aria-hidden className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(0.625rem, 1fr))" }}>
          {ordered.map((r, i) => {
            const paint = paintOf.get(r.version ?? NO_VERSION) ?? UNKNOWN;
            const dim = (lit !== null && lit !== (r.version ?? NO_VERSION)) || (visible !== null && !visible.has(r.nodeId));
            const hollow = r.online === false;
            const on = reduced || shown;
            return (
              <Link
                key={r.nodeId}
                href={nodeHref(r.nodeId)}
                prefetch={false}
                tabIndex={-1}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  const x = el.offsetLeft + el.offsetWidth / 2;
                  // near an edge the plate hangs inward, so it never runs off the page
                  const w = gridRef.current?.offsetWidth ?? 0;
                  setTip({ row: r, x, y: el.offsetTop, align: x < w * 0.2 ? "left" : x > w * 0.8 ? "right" : "center" });
                }}
                className="aspect-square rounded-[2px]"
                style={{
                  background: hollow ? "transparent" : paint,
                  boxShadow: hollow ? `inset 0 0 0 1.5px ${paint}` : undefined,
                  opacity: on ? (dim ? 0.16 : 1) : 0,
                  transform: on ? "none" : "scale(0.3)",
                  transition: reduced ? "none" : "opacity 240ms cubic-bezier(0.32,0.72,0,1), transform 420ms cubic-bezier(0.32,0.72,0,1)",
                  transitionDelay: reduced || settled ? "0ms" : `${Math.min(i * 1.4, 900)}ms`,
                }}
              />
            );
          })}
        </div>
        {tip && (
          <div
            className={cn(
              "pointer-events-none absolute z-20 -translate-y-full whitespace-nowrap pb-2",
              tip.align === "center" ? "-translate-x-1/2" : tip.align === "right" ? "-translate-x-full" : "translate-x-0",
            )}
            style={{ left: tip.x, top: tip.y }}
          >
            <TipPlate>
              <p className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">{shortId(tip.row.nodeId)}</p>
              <p className="mt-0.5 font-mono text-[10.5px] tabular-nums text-zinc-500">
                {tip.row.version ?? "unknown version"} · {tip.row.online === false ? "offline" : tip.row.online ? "online" : "connection not reported"}
              </p>
              <p className="font-mono text-[10.5px] tabular-nums text-zinc-500">
                {fmtCompact(tip.row.stake)} AVAX{tip.row.uptime !== null ? ` · ${tip.row.uptime.toFixed(1)}% uptime` : ""}
              </p>
            </TipPlate>
          </div>
        )}
      </div>
    </div>
  );
}
