"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoardHeader, ChartBoard, LoadMore } from "@/components/explorer-v2/ui";
import { useTween } from "@/components/explorer-v2/evm/query/motion";
import type { AvalancheGoRelease } from "@/lib/avalanchego-releases";
import { NO_VERSION, type Selection, type TargetOption } from "@/lib/validator-triage";
import { seenText, type L1FacetKey, type L1StatusRow, type L1Summary } from "@/lib/l1-validator-triage";
import { BEHIND_SWATCH, FleetGrid, ReleaseKey, ReleaseLine, ShortfallRow, Solid, TargetPicker, UNKNOWN, releaseShares, shortId } from "./UpgradeReadiness";
import { daysLeftTone } from "./TriageFilters";

/* How ready the L1s are for a release, in the Primary Network board's
   grammar (UpgradeReadiness): the share of validators on the target and
   the ways one falls short, each a door into the roster, then the set as
   one solid and one square per validator. Each L1 weighs its validators
   in its own units, so nothing here adds weight across L1s: the counts
   are validators and L1s. The second board takes the L1s one by one,
   the most exposed first. */

/** the key's columns at md and up: swatch, release, bar, validators, share, L1s, arrow */
const KEY_COLS = "gap-x-4 md:grid-cols-[1rem_9rem_minmax(0,1fr)_6rem_5rem_4rem_1.5rem]";

// the fleet's order inside a release (an L1's validators together, the biggest L1 first), a square's id and its plate: stable, so a hover does not sort the fleet again
const byL1 = (a: L1StatusRow, b: L1StatusRow) => b.l1Size - a.l1Size || a.subnetId.localeCompare(b.subnetId) || b.share - a.share;
const validationOf = (r: L1StatusRow) => r.validationId;
const l1Tip = (r: L1StatusRow) => (
  <>
    <p className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">{shortId(r.nodeId)}</p>
    <p className="mt-0.5 font-mono text-[10.5px] tabular-nums text-zinc-500">
      {r.l1} · {r.share.toFixed(1)}% of its weight
    </p>
    <p className="font-mono text-[10.5px] tabular-nums text-zinc-500">
      {r.version ?? "unknown version"}
      {r.seenDays !== null ? ` · seen ${seenText(r.seenDays)}` : ""}
    </p>
  </>
);

const onL1s = (n: number) => `on ${n.toLocaleString("en-US")} L1${n === 1 ? "" : "s"}`;

export function L1Readiness({
  rows,
  visible,
  target,
  targets,
  onTarget,
  required,
  latest,
  selection,
  onCut,
  rowHref,
}: {
  rows: L1StatusRow[];
  /** the validation IDs the roster is cut to; null when it is not cut */
  visible: Set<string> | null;
  target: string;
  /** the releases that can be the target, newest first */
  targets: TargetOption[];
  onTarget: (v: string) => void;
  /** the newest release its notes call mandatory */
  required: AvalancheGoRelease | null;
  /** the newest published release */
  latest: AvalancheGoRelease | null;
  selection: Selection<L1FacetKey>;
  /** cut the roster to one facet's options, or clear that facet when it already is */
  onCut: (key: L1FacetKey, ids: string[]) => void;
  /** a validator's node page, on its L1's seat */
  rowHref: (r: L1StatusRow) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const shares = useMemo(() => releaseShares(rows, target), [rows, target]);
  const paintOf = useMemo(() => new Map(shares.map((s) => [s.version, s.paint])), [shares]);
  const picked = selection.version?.length === 1 ? selection.version[0] : null;
  const lit = hover ?? picked;

  const reading = useMemo(() => {
    const part = () => ({ n: 0, l1s: new Set<string>() });
    const on = part();
    const behind = part();
    const unknown = part();
    const stale = part();
    // an L1 is on target when every validator it has is
    const whole = new Map<string, boolean>();
    for (const r of rows) {
      const p = r.status === "current" ? on : r.status === "behind" ? behind : unknown;
      p.n++;
      p.l1s.add(r.subnetId);
      if (r.seenDays !== null && r.seenDays >= 30) {
        stale.n++;
        stale.l1s.add(r.subnetId);
      }
      whole.set(r.subnetId, (whole.get(r.subnetId) ?? true) && r.status === "current");
    }
    return {
      on,
      behind,
      unknown,
      stale,
      pct: rows.length ? (on.n / rows.length) * 100 : 0,
      l1s: whole.size,
      l1sOn: [...whole.values()].filter(Boolean).length,
    };
  }, [rows]);

  // per release, the L1s with a validator on it
  const l1sOf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      const k = r.version ?? NO_VERSION;
      const set = m.get(k) ?? new Set<string>();
      set.add(r.subnetId);
      m.set(k, set);
    }
    return m;
  }, [rows]);

  const tween = useTween(reading.pct, 500);
  const cutIs = (key: L1FacetKey, id: string) => selection[key]?.length === 1 && selection[key]?.[0] === id;

  return (
    <div className="border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <BoardHeader
        label="Upgrade Readiness"
        display
        action={
          <div className="-my-1 hidden max-w-[70%] sm:flex">
            <TargetPicker id="l1-target-head" targets={targets} target={target} onTarget={onTarget} />
          </div>
        }
      />
      {/* a phone has no room beside the title: the picker gets its own strip */}
      <div className="border-b border-zinc-100 px-5 py-2 sm:hidden dark:border-zinc-900">
        <TargetPicker id="l1-target-strip" targets={targets} target={target} onTarget={onTarget} />
      </div>

      <div className="grid gap-8 px-5 py-6 md:px-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-10">
        {/* the reading: how many validators are on the target, and who is not */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Validators on {target}+</span>
            <span className="font-mono text-[44px] leading-none tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {(tween ?? reading.pct).toFixed(1)}
              <span className="ml-1 text-[20px] text-zinc-400 dark:text-zinc-500">%</span>
            </span>
            <span className="font-mono text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {reading.on.n.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} validators · {reading.l1sOn} of {reading.l1s} L1s all on target
            </span>
          </div>
          <div className="flex flex-col border-y border-zinc-100 dark:border-zinc-900">
            <ShortfallRow
              label="Behind target"
              title={`Validators that run a release older than ${target}`}
              swatch={<span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: BEHIND_SWATCH }} />}
              count={reading.behind.n}
              detail={onL1s(reading.behind.l1s.size)}
              active={cutIs("status", "behind")}
              onClick={() => onCut("status", ["behind"])}
            />
            <ShortfallRow
              label="Unknown version"
              title="The network crawler has never completed a handshake with these validators. It cannot reach them, or their L1 keeps its nodes private."
              swatch={<span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: UNKNOWN }} />}
              count={reading.unknown.n}
              detail={onL1s(reading.unknown.l1s.size)}
              active={cutIs("status", "unknown")}
              onClick={() => onCut("status", ["unknown"])}
            />
            <ShortfallRow
              label="No handshake · 30d"
              title="The crawler last completed a handshake with these validators 30 or more days ago, so the version it read is that old"
              swatch={<span className="h-2.5 w-2.5 rounded-[2px] ring-[1.5px] ring-inset ring-zinc-400 dark:ring-zinc-500" />}
              count={reading.stale.n}
              detail={onL1s(reading.stale.l1s.size)}
              active={cutIs("seen", "30")}
              onClick={() => onCut("seen", ["30"])}
            />
          </div>
        </div>

        {/* the set, drawn twice: by share, then one square per validator */}
        <div className="flex min-w-0 flex-col gap-6" onMouseLeave={() => setHover(null)}>
          <Solid label="Validators" shares={shares} share={(s) => s.nodePct} lit={lit} onHover={setHover} onPick={(v) => onCut("version", [v])} />
          <FleetGrid rows={rows} paintOf={paintOf} visible={visible} lit={lit} idOf={validationOf} hrefOf={rowHref} order={byL1} tip={l1Tip} />
        </div>
      </div>

      {(required || latest) && <ReleaseLine required={required} latest={latest} />}

      <ReleaseKey
        shares={shares}
        targets={targets}
        picked={picked}
        lit={lit}
        onHover={setHover}
        onPick={(v) => onCut("version", [v])}
        cols={KEY_COLS}
        head={["Validators", "Share", "L1s"]}
        cells={(s) => [`${s.nodePct.toFixed(1)}%`, (l1sOf.get(s.version)?.size ?? 0).toLocaleString("en-US")]}
      />
    </div>
  );
}

/** rows before the board asks to be opened */
const SHORT = 8;
/** the board's columns at md and up: L1, validators, releases, weight on target, behind, days left */
const L1_COLS = "md:grid-cols-[minmax(0,1.5fr)_5rem_minmax(0,1fr)_6rem_4.5rem_5.5rem]";
const HEAD_CELL = "font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500";

/** the share of an L1's weight on the target: green from 80%, red with a validator behind, amber else */
function weightInk(s: L1Summary): string {
  if (s.weightOn >= 80) return "text-emerald-600 dark:text-emerald-400";
  return s.behind > 0 ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
}

/* Every L1, one row each, the most exposed first (summarizeL1s): its
   validators, their releases in the readiness board's colors, the share
   of its weight on the target, how many are behind, and the fewest days
   a balance has left. A row cuts the roster to its L1; the arrow opens
   the L1's own validators tab. */
export function L1Board({
  summaries,
  paintOf,
  target,
  picked,
  onPick,
}: {
  summaries: L1Summary[];
  /** the readiness board's release colors */
  paintOf: Map<string, string>;
  target: string;
  /** the L1 the roster is cut to */
  picked: string | null;
  onPick: (subnetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? summaries : summaries.slice(0, SHORT);
  return (
    <div className="flex flex-col gap-3">
      <ChartBoard label="Readiness by L1" bodyClassName="p-0">
        <div className="hidden grid-cols-[minmax(0,1fr)_2.5rem] border-b border-zinc-200 md:grid dark:border-zinc-800">
          <div className={cn("grid items-center gap-x-4 py-2 pl-6", L1_COLS)}>
            <span className={HEAD_CELL}>L1</span>
            <span className={cn(HEAD_CELL, "text-right")}>Validators</span>
            <span className={HEAD_CELL}>Releases</span>
            <span className={cn(HEAD_CELL, "text-right")} title={`The share of the L1's weight on ${target} or newer`}>
              On target
            </span>
            <span className={cn(HEAD_CELL, "text-right")}>Behind</span>
            <span className={cn(HEAD_CELL, "text-right")} title="The fewest days one of its validators' balances pays at the current fee">
              Days left
            </span>
          </div>
          <span />
        </div>
        <ul>
          {shown.map((s) => {
            const on = picked === s.subnetId;
            // a private L1's nodes report no version, so its share names why, not a zero
            const dark = s.isPrivate && s.unknown === s.validators;
            const share = dark ? "private" : `${s.weightOn.toFixed(0)}% on target`;
            const days = s.soonest !== null ? `${Math.floor(s.soonest)}d` : null;
            return (
              <li key={s.subnetId} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-stretch border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={() => onPick(s.subnetId)}
                  aria-pressed={on}
                  title={on ? "Show every L1's validators" : `List ${s.name}'s validators`}
                  className={cn(
                    "grid items-center gap-x-4 gap-y-1.5 py-2.5 pl-5 text-left transition-colors md:pl-6",
                    L1_COLS,
                    on ? "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {s.logo ? (
                      <img src={s.logo} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                    )}
                    <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{s.name}</span>
                  </span>
                  <span className="hidden font-mono text-[12px] tabular-nums text-zinc-700 md:block md:text-right dark:text-zinc-300">{s.validators.toLocaleString("en-US")}</span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900" title={s.versions.map((v) => `${v.version === NO_VERSION ? "unknown" : v.version}: ${v.n}`).join(" · ")}>
                    {s.versions.map((v) => (
                      <span key={v.version} className="h-full" style={{ width: `${(v.n / s.validators) * 100}%`, background: paintOf.get(v.version) ?? UNKNOWN }} />
                    ))}
                  </span>
                  <span className={cn("hidden font-mono text-[12px] tabular-nums md:block md:text-right", dark ? "uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500" : weightInk(s))}>
                    {dark ? "Private" : `${s.weightOn.toFixed(0)}%`}
                  </span>
                  <span className={cn("hidden font-mono text-[12px] tabular-nums md:block md:text-right", s.behind > 0 ? "text-[#E6212F]" : "text-zinc-300 dark:text-zinc-700")}>{s.behind}</span>
                  <span className={cn("hidden font-mono text-[12px] tabular-nums md:block md:text-right", s.soonest !== null ? daysLeftTone(s.soonest) : "text-zinc-300 dark:text-zinc-700")}>{days ?? "n/a"}</span>
                  {/* a phone reads the figures as one line under the releases */}
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:hidden dark:text-zinc-400">
                    {s.validators} validators · {share} · {s.behind} behind{days ? ` · ${days} left` : ""}
                  </span>
                </button>
                {s.slug ? (
                  <Link
                    href={`/explorer/mainnet/${s.slug}/validators`}
                    title={`Open ${s.name}'s validators`}
                    aria-label={`Open ${s.name}'s validators`}
                    className="flex items-center justify-center text-zinc-300 transition-colors hover:text-zinc-900 dark:text-zinc-700 dark:hover:text-zinc-100"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </ChartBoard>
      {summaries.length > SHORT && (
        <LoadMore onClick={() => setOpen((o) => !o)} label={open ? "Show fewer" : `Show all ${summaries.length} L1s`} />
      )}
    </div>
  );
}
