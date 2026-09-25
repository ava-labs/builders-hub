"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChartNoAxesGantt, ChartPie } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { BoardHeader } from "@/components/explorer-v2/ui";
import { compareVersions, type VersionBreakdownData } from "@/components/stats/VersionBreakdown";
import { MOTION, useReduced, useTween } from "@/components/explorer-v2/evm/query/motion";

/* What the fleet runs, as two solids: the Primary Network's nodes and its
   stake, each cut into one segment per client version, newest first. A
   version at or past the target is green (newest deepest); the minor line
   just behind it amber; anything older red. Hover a segment or a row and that version lights across
   both solids and the list; click it and the roster below filters to the
   nodes that run it. The target is a row of pills, not a select, so the
   choice and its effect sit in the same view.                          */

export interface FleetVersion {
  version: string;
  nodes: number;
  nodePct: number;
  /** null when the feed has no stake for the bucket */
  stakePct: number | null;
  current: boolean;
  /** the segment's paint: one hex, so bars, donuts and swatches match */
  paint: string;
}

const GREEN = ["#16a34a", "#4ade80", "#86efac", "#bbf7d0"];
const AMBER = ["#f59e0b", "#fbbf24", "#fcd34d"];
const RED = ["#E6212F", "#f87171", "#fca5a5"];
const UNKNOWN = "#a1a1aa";

function minorParts(v: string): [number, number] | null {
  const m = /(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function fleetOf(versions: VersionBreakdownData, target: string): FleetVersion[] {
  const entries = Object.entries(versions.byClientVersion).sort(([a], [b]) => compareVersions(b, a));
  const totalNodes = entries.reduce((s, [, d]) => s + d.nodes, 0);
  const totalStake = versions.totalStakeString ? Number(BigInt(versions.totalStakeString) / 1_000_000n) : 0;
  const t = minorParts(target);
  const n = { g: 0, a: 0, r: 0 };
  const pick = (tones: string[], k: "g" | "a" | "r") => tones[Math.min(n[k]++, tones.length - 1)];
  return entries.map(([version, d]) => {
    const current = version !== "Unknown" && compareVersions(version, target) >= 0;
    const m = minorParts(version);
    // one minor line behind the target is a nudge; further back is a risk
    const near = !!(m && t && m[0] === t[0] && m[1] === t[1] - 1);
    const paint = version === "Unknown" ? UNKNOWN : current ? pick(GREEN, "g") : near ? pick(AMBER, "a") : pick(RED, "r");
    return {
      version,
      nodes: d.nodes,
      nodePct: totalNodes > 0 ? (d.nodes / totalNodes) * 100 : 0,
      stakePct: totalStake > 0 && d.stakeString ? (Number(BigInt(d.stakeString) / 1_000_000n) / totalStake) * 100 : null,
      current,
      paint,
    };
  });
}

export type FleetView = "bars" | "donut";
export type FleetGrain = "minor" | "patch";

const SEG = "relative flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50";

/** the Query panels' switch: a pill that slides to the choice, its label shown only when on */
function Switch<T extends string>({ id, value, onChange, options }: { id: string; value: T; onChange: (v: T) => void; options: { v: T; label: string; icon?: typeof ChartPie }[] }) {
  const reduced = useReduced();
  return (
    <div role="group" className="flex shrink-0 items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
      {options.map(({ v, label, icon: Icon }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-label={label}
            aria-pressed={on}
            title={label}
            onClick={() => onChange(v)}
            className={cn(SEG, on ? "px-2.5 text-zinc-900 dark:text-zinc-50" : cn(Icon ? "px-1.5" : "px-2.5", "text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"))}
          >
            {on && <motion.span layoutId={`${id}-pill`} transition={reduced ? { duration: 0 } : MOTION} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700" />}
            {Icon && <Icon className="relative h-3.5 w-3.5" strokeWidth={1.75} />}
            {(on || !Icon) && <span className="relative font-mono text-[10.5px] font-medium">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function VersionFleet({
  fleet,
  target,
  targets,
  onTarget,
  stakePct,
  nodePct,
  reporting,
  picked,
  onPick,
  grain = "minor",
  onGrain,
  stakeLabel = "Stake",
}: {
  fleet: FleetVersion[];
  target: string;
  /** versions that can be the target, newest first */
  targets: string[];
  onTarget: (v: string) => void;
  /** share of stake at or past the target */
  stakePct: number;
  nodePct: number;
  reporting: number;
  /** the version the roster is filtered to */
  picked: string | null;
  onPick: (v: string | null) => void;
  /** count by minor line (1.15) or by release (1.15.1) */
  grain?: FleetGrain;
  /** omit where the feed has minor lines only: the switch hides */
  onGrain?: (g: FleetGrain) => void;
  /** names the stake side, e.g. "Stake · per set" where stake units differ between sets */
  stakeLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<FleetView>("bars");
  const lit = hover ?? picked;
  const reduced = useReduced();
  const stake = useTween(stakePct, 500);
  const nodes = useTween(nodePct, 500);
  const behind = useMemo(() => fleet.filter((f) => !f.current && f.version !== "Unknown").reduce((s, f) => s + f.nodes, 0), [fleet]);

  return (
    <div className="border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <BoardHeader
        label="Client Versions"
        display
        action={
          <div role="radiogroup" aria-label="Target version" className="-my-1 flex max-w-[60%] items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="mr-1 hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 sm:inline dark:text-zinc-500">Target</span>
            {targets.map((v) => {
              const on = v === target;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onTarget(v)}
                  className={cn(
                    "relative shrink-0 rounded-full px-2.5 py-1 font-mono text-[10.5px] tabular-nums transition-colors",
                    on ? "text-white dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                >
                  {on && <motion.span layoutId="fleet-target" transition={reduced ? { duration: 0 } : MOTION} className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
                  <span className="relative">{v}</span>
                </button>
              );
            })}
          </div>
        }
      />

      <div className="grid gap-8 px-5 py-6 md:px-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10">
        {/* the reading: what share of the network is on the target */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{stakeLabel} on {target}+</span>
            <span className="font-mono text-[40px] leading-none tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {(stake ?? stakePct).toFixed(1)}
              <span className="ml-1 text-[18px] text-zinc-400 dark:text-zinc-500">%</span>
            </span>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Nodes</span>
              <span className="font-mono text-[18px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">{(nodes ?? nodePct).toFixed(1)}%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Behind</span>
              <span className={cn("font-mono text-[18px] leading-none tabular-nums", behind > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-50")}>
                {behind.toLocaleString("en-US")}
              </span>
            </div>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{reporting.toLocaleString("en-US")} nodes reporting</p>
        </div>

        {/* the distribution, drawn the way the reader asks */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onGrain && (
              <Switch
                id="fleet-grain"
                value={grain}
                onChange={onGrain}
                options={[
                  { v: "minor", label: "Minor" },
                  { v: "patch", label: "Patch" },
                ]}
              />
            )}
            <Switch
              id="fleet-view"
              value={view}
              onChange={setView}
              options={[
                { v: "bars", label: "Bars", icon: ChartNoAxesGantt },
                { v: "donut", label: "Donuts", icon: ChartPie },
              ]}
            />
          </div>
          {view === "bars" ? (
            <div className="flex min-w-0 flex-col gap-7" onMouseLeave={() => setHover(null)}>
              <Solid label="Nodes" fleet={fleet} share={(f) => f.nodePct} lit={lit} onHover={setHover} onPick={(v) => onPick(picked === v ? null : v)} />
              <Solid label={stakeLabel} fleet={fleet} share={(f) => f.stakePct ?? 0} lit={lit} onHover={setHover} onPick={(v) => onPick(picked === v ? null : v)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4" onMouseLeave={() => setHover(null)}>
              <Donut label="Nodes" fleet={fleet} share={(f) => f.nodePct} count={(f) => `${f.nodes.toLocaleString("en-US")} nodes`} lit={lit} onHover={setHover} onPick={(v) => onPick(picked === v ? null : v)} />
              <Donut label={stakeLabel} fleet={fleet} share={(f) => f.stakePct ?? 0} lit={lit} onHover={setHover} onPick={(v) => onPick(picked === v ? null : v)} />
            </div>
          )}
        </div>
      </div>

      {/* the key, one row a version: also the way into the roster */}
      <ul className="border-t border-zinc-200 dark:border-zinc-800" onMouseLeave={() => setHover(null)}>
        {fleet.map((f) => {
          const on = picked === f.version;
          const dim = lit !== null && lit !== f.version;
          return (
            <li key={f.version} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
              <button
                type="button"
                onMouseEnter={() => setHover(f.version)}
                onFocus={() => setHover(f.version)}
                onBlur={() => setHover(null)}
                onClick={() => onPick(on ? null : f.version)}
                aria-pressed={on}
                className={cn(
                  "group grid w-full grid-cols-[1rem_4.5rem_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-2.5 text-left transition-[background-color,opacity] duration-200 md:grid-cols-[1rem_6rem_minmax(0,1fr)_5rem_5rem_5rem_1.5rem] md:px-6",
                  on ? "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  dim && "opacity-45",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: f.paint }} />
                <span className={cn("font-mono text-[12.5px] tabular-nums", f.current ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400")}>{f.version}</span>
                <span className="block h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(f.nodePct > 0 ? 1 : 0, f.nodePct)}%`, background: f.paint }} />
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                  {f.nodes.toLocaleString("en-US")}
                  <span className="text-zinc-400 md:hidden dark:text-zinc-500"> · {f.nodePct.toFixed(1)}%</span>
                </span>
                <span className="hidden font-mono text-[12px] tabular-nums text-zinc-500 md:block md:text-right dark:text-zinc-400">{f.nodePct.toFixed(1)}%</span>
                <span className="hidden font-mono text-[12px] tabular-nums text-zinc-500 md:block md:text-right dark:text-zinc-400">{f.stakePct === null ? "—" : `${f.stakePct.toFixed(1)}%`}</span>
                <ArrowRight className={cn("hidden h-3.5 w-3.5 justify-self-end transition-all md:block", on ? "rotate-90 text-[#0061E2]" : "text-zinc-300 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100")} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** one extruded bar, cut into versions */
function Solid({
  label,
  fleet,
  share,
  lit,
  onHover,
  onPick,
}: {
  label: string;
  fleet: FleetVersion[];
  share: (f: FleetVersion) => number;
  lit: string | null;
  onHover: (v: string | null) => void;
  onPick: (v: string) => void;
}) {
  const parts = fleet.map((f) => ({ f, w: share(f) })).filter((p) => p.w > 0);
  const total = parts.reduce((s, p) => s + p.w, 0) || 1;
  const last = parts[parts.length - 1];
  const litPart = parts.find((p) => p.f.version === lit);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="font-bold text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
          {litPart ? (
            <>
              <span className="text-zinc-900 dark:text-zinc-100">{litPart.f.version}</span> · {((litPart.w / total) * 100).toFixed(1)}%
            </>
          ) : null}
        </span>
      </div>
      <div className="relative mr-2 mt-2 h-7">
        {/* top face: the same cut, lit */}
        <div aria-hidden className="absolute -top-2 left-0 flex h-2 w-full origin-bottom-left skew-x-[-45deg] overflow-hidden">
          {parts.map(({ f, w }) => (
            <span key={f.version} className={cn("relative h-full transition-opacity duration-200", lit && lit !== f.version && "opacity-30")} style={{ width: `${(w / total) * 100}%`, background: f.paint }}>
              <span className="absolute inset-0 bg-white/40 dark:bg-white/20" />
            </span>
          ))}
        </div>
        {/* right face: the last cut, in shade */}
        {last && (
          <span aria-hidden className={cn("absolute -right-2 top-0 h-full w-2 origin-top-left skew-y-[-45deg] transition-opacity duration-200", lit && lit !== last.f.version && "opacity-30")} style={{ background: last.f.paint }}>
            <span className="absolute inset-0 bg-black/25" />
          </span>
        )}
        {/* front face */}
        <div className="relative flex h-full w-full">
          {parts.map(({ f, w }) => (
            <button
              key={f.version}
              type="button"
              aria-label={`${f.version}: ${((w / total) * 100).toFixed(1)}% of ${label.toLowerCase()}`}
              onMouseEnter={() => onHover(f.version)}
              onFocus={() => onHover(f.version)}
              onBlur={() => onHover(null)}
              onClick={() => onPick(f.version)}
              className={cn(
                "h-full min-w-px border-r border-white/60 transition-opacity duration-200 last:border-r-0 focus-visible:outline-none dark:border-black/40",
                lit && lit !== f.version && "opacity-30",
              )}
              style={{ width: `${(w / total) * 100}%`, background: f.paint }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** one ring of versions; the centre reads the lit version, or the target's share */
function Donut({
  label,
  fleet,
  share,
  count,
  lit,
  onHover,
  onPick,
}: {
  label: string;
  fleet: FleetVersion[];
  share: (f: FleetVersion) => number;
  count?: (f: FleetVersion) => string;
  lit: string | null;
  onHover: (v: string | null) => void;
  onPick: (v: string) => void;
}) {
  const parts = fleet.map((f) => ({ f, value: share(f) })).filter((p) => p.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const focus = parts.find((p) => p.f.version === lit);
  const ontarget = parts.filter((p) => p.f.current).reduce((s, p) => s + p.value, 0);
  const pct = ((focus ? focus.value : ontarget) / total) * 100;
  const t = useTween(pct, 350);
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div className="relative aspect-square w-full max-w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={parts}
              dataKey="value"
              nameKey="f.version"
              innerRadius="68%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={parts.length > 1 ? 1.5 : 0}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, i) => onHover(parts[i]?.f.version ?? null)}
              onClick={(_, i) => parts[i] && onPick(parts[i].f.version)}
              className="cursor-pointer outline-none"
            >
              {parts.map((p) => (
                <Cell
                  key={p.f.version}
                  fill={p.f.paint}
                  fillOpacity={lit && lit !== p.f.version ? 0.25 : 1}
                  style={{ transition: "fill-opacity 250ms cubic-bezier(0.32,0.72,0,1)", outline: "none" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="font-mono text-[22px] leading-none tabular-nums tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">{(t ?? pct).toFixed(1)}%</span>
          <span className="max-w-[70%] truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            {focus ? (count ? count(focus.f) : focus.f.version) : "on target"}
          </span>
        </div>
      </div>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
        {focus && <span className="ml-2 font-normal normal-case tracking-normal text-zinc-900 dark:text-zinc-100">{focus.f.version}</span>}
      </span>
    </div>
  );
}
