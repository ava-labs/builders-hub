"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, INK, fnInk } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { knownAddress, type TxSummary } from "@/lib/evm-explorer";
import { setSelection, askAbout } from "@/components/explorer-v2/dig/selection";

/* The gas map, as a place to dig rather than a picture. One grammar,
   the same on every explorer visual:

     hover reads   the segment's record, in a plate under the strip
     click opens   the record's own page
     drag selects  a run of records, summed, filtered into the table
     legend filters   a group in, a second click takes it out
     lens recolours   the same strip by method, sender, recipient, status

   Whatever is picked out is published as the page's selection, so the
   table under the map shows only that, and the chat bubble carries it
   with the next question. */

export type MethodOf = (t: TxSummary) => { label: string; named: boolean };

export type Lens = "method" | "sender" | "recipient" | "status";
const LENSES: { key: Lens; label: string }[] = [
  { key: "method", label: "Method" },
  { key: "sender", label: "Sender" },
  { key: "recipient", label: "Recipient" },
  { key: "status", label: "Status" },
];

/* the map's inks: the block's biggest groups each get their own, in the
   order they bought gas; plain sends stay in the block gray and the long
   tail in a pale gray, so the eye lands on what mattered */
const GROUP_TONES = ["#7c3aed", "#0061E2", "#0d9488", "#d97706", "#db2777"];
const SEND_TONE = "#A2AFB2";
const TAIL_TONE = "#d4d4d8";
const OK_TONE = "#0d9488";
const REVERT_TONE = "#E6212F";
const REVERT_STRIPES = "repeating-linear-gradient(135deg, rgba(230,33,47,0.9) 0 3px, transparent 3px 7px)";

interface Group {
  key: string;
  label: string;
  /** a name a person gave it (a function, a known address), not raw hex */
  named: boolean;
  mono: boolean;
  tone: string;
  gas: number;
  n: number;
  reverted: number;
}

export function BlockGasMap({
  txs,
  gasUsed,
  gasLimit,
  method,
  sym,
  base,
  blockNumber,
  nameOf,
  hover,
  onHover,
  onFilter,
}: {
  txs: TxSummary[];
  /** the header's gasUsed: since Helicon the gas RESERVED, the sum of its
   *  txs' gas limits, which is what fills the block against its limit */
  gasUsed: number;
  gasLimit: number;
  method: MethodOf;
  sym: string;
  base: string;
  blockNumber: number;
  /** a name for an address, if the page knows one (token, known contract) */
  nameOf?: (addr: string) => string | undefined;
  /** the tx under the pointer, shared with the table so both light up */
  hover: string | null;
  onHover: (hash: string | null) => void;
  /** the hashes the reader has picked out, or null for everything */
  onFilter: (hashes: Set<string> | null) => void;
}) {
  const [lens, setLens] = useState<Lens>("method");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<[number, number] | null>(null);

  // a plain send is named by its token, so it never reads as an ERC-20 transfer()
  const sendLabel = `${sym} send`;
  const txGas = txs.reduce((s, t) => s + t.gasUsed, 0) || 1;

  /** how the lens names one tx */
  const keyOf = (t: TxSummary): Pick<Group, "key" | "label" | "named" | "mono"> => {
    switch (lens) {
      case "sender": {
        const known = knownAddress(t.from)?.label ?? nameOf?.(t.from);
        return { key: t.from.toLowerCase(), label: known ?? truncate(t.from, 6), named: !!known, mono: !known };
      }
      case "recipient": {
        if (!t.to) return { key: "create", label: "contract creation", named: true, mono: false };
        const known = knownAddress(t.to)?.label ?? nameOf?.(t.to);
        return { key: t.to.toLowerCase(), label: known ?? truncate(t.to, 6), named: !!known, mono: !known };
      }
      case "status":
        return t.success ? { key: "ok", label: "succeeded", named: true, mono: false } : { key: "reverted", label: "reverted", named: true, mono: false };
      default: {
        if (!t.methodId) return { key: sendLabel, label: sendLabel, named: false, mono: false };
        const m = method(t);
        return { key: m.label, label: m.label, named: m.named, mono: !m.named };
      }
    }
  };

  // group by the lens, biggest buyer first; the top five get inks
  const { groups, groupOf } = useMemo(() => {
    const by = new Map<string, Group>();
    const groupOf = new Map<string, string>();
    for (const t of txs) {
      const k = keyOf(t);
      groupOf.set(t.hash, k.key);
      const e = by.get(k.key) ?? { ...k, tone: TAIL_TONE, gas: 0, n: 0, reverted: 0 };
      e.gas += t.gasUsed;
      e.n += 1;
      if (!t.success) e.reverted += 1;
      by.set(k.key, e);
    }
    const sorted = [...by.values()].sort((a, b) => b.gas - a.gas);
    let ink = 0;
    for (const g of sorted) {
      if (lens === "status") g.tone = g.key === "ok" ? OK_TONE : REVERT_TONE;
      else if (g.key === sendLabel) g.tone = SEND_TONE;
      else g.tone = ink < GROUP_TONES.length ? GROUP_TONES[ink++] : TAIL_TONE;
    }
    return { groups: sorted, groupOf };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, method, lens, nameOf]);
  const toneOf = new Map(groups.map((g) => [g.key, g.tone]));
  const labelOf = new Map(groups.map((g) => [g.key, g.label]));
  const shown = groups.slice(0, 6);
  const rest = groups.slice(6);

  // a lens change empties the picks: they name groups of the old lens
  const pickLens = (l: Lens) => {
    setLens(l);
    setPicked(new Set());
  };
  const togglePick = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* what is picked out: the range, narrowed by the picked groups */
  const inRange = (i: number) => !range || (i >= range[0] && i <= range[1]);
  const inPick = (t: TxSummary) => picked.size === 0 || picked.has(groupOf.get(t.hash)!);
  const active = !!range || picked.size > 0;
  const selected = useMemo(() => (active ? txs.filter((t, i) => inRange(i) && inPick(t)) : []), [txs, range, picked, groupOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // publish: the table filters to it, the assistant reads it
  useEffect(() => {
    if (!active) {
      onFilter(null);
      setSelection(null);
      return;
    }
    onFilter(new Set(selected.map((t) => t.hash)));
    const gas = selected.reduce((s, t) => s + t.gasUsed, 0);
    const reverted = selected.filter((t) => !t.success).length;
    const fee = selected.every((t) => t.feeWei) ? selected.reduce((s, t) => s + BigInt(t.feeWei!), 0n) : null;
    const title = `${selected.length} tx${selected.length === 1 ? "" : "s"} · ${formatNumber(gas)} gas charged · ${((gas / txGas) * 100).toFixed(1)}% of the block${reverted ? ` · ${reverted} reverted` : ""}`;
    const how = [
      range ? `positions #${range[0]} to #${range[1]} in block order` : null,
      picked.size ? `${lens}: ${[...picked].map((k) => labelOf.get(k) ?? k).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    const lines = selected.slice(0, 12).map((t) => {
      const m = t.methodId ? method(t).label : sendLabel;
      return `- #${t.txIndex} ${t.hash} ${m} from ${t.from} to ${t.to || "(contract creation)"} gas ${t.gasUsed}${t.success ? "" : " REVERTED"}`;
    });
    setSelection({
      kind: "transactions",
      title,
      brief: [
        `Selection on block #${blockNumber} gas map: ${title}.`,
        `Picked by ${how}.`,
        fee !== null ? `Fees paid: ${formatEther(fee.toString(), { decimals: 6 })} ${sym}.` : "",
        `Transactions (first ${Math.min(12, selected.length)} of ${selected.length}):`,
        ...lines,
      ]
        .filter(Boolean)
        .join("\n"),
      hrefs: selected.slice(0, 8).map((t) => `${base}/tx/${t.hash}`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, active, range, picked, lens]);
  useEffect(() => () => setSelection(null), []);

  /* drag across the strip to select a run of txs. A click still opens
     the tx; a pointer that moved more than a few pixels is a drag, and
     the click it ends with is swallowed. */
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; i0: number; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const indexAt = (clientX: number): number => {
    const kids = strip.current?.children;
    if (!kids || kids.length === 0) return 0;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < kids.length; i++) {
      const r = (kids[i] as HTMLElement).getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return i;
      const d = clientX < r.left ? r.left - clientX : clientX - r.right;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x0: e.clientX, i0: indexAt(e.clientX), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < 4) return;
    d.moved = true;
    const i = indexAt(e.clientX);
    setRange([Math.min(d.i0, i), Math.max(d.i0, i)]);
  };
  const onPointerUp = () => {
    if (drag.current?.moved) swallow.current = true;
    drag.current = null;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const hoverTx = hover ? txs.find((t) => t.hash === hover) : undefined;
  const hoverKey = hoverTx ? groupOf.get(hoverTx.hash) : null;
  const pctOfLimit = gasLimit > 0 ? (gasUsed / gasLimit) * 100 : 0;
  const selGas = selected.reduce((s, t) => s + t.gasUsed, 0);
  const selReverted = selected.filter((t) => !t.success).length;

  return (
    <Board divide={false} className="flex h-full flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-5 pt-5 md:px-6">
        <span className="flex items-baseline gap-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Gas Map</span>
          {/* the lens: same strip, recoloured */}
          <span className="flex items-baseline gap-2.5 font-mono text-[10px] uppercase tracking-[0.14em]">
            {LENSES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => pickLens(l.key)}
                className={cn(
                  "transition-colors",
                  lens === l.key ? "text-zinc-900 underline decoration-[#E6212F] decoration-2 underline-offset-4 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200",
                )}
              >
                {l.label}
              </button>
            ))}
          </span>
        </span>
        <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {/* the segments are receipt gas: gas charged, max(used, limit / 2) */}
          <span className={INK}>{formatNumber(txs.reduce((sum, t) => sum + t.gasUsed, 0))}</span> gas charged · {txs.length} tx{txs.length === 1 ? "" : "s"} in block order
        </span>
      </div>

      {txs.length === 0 ? (
        <p className="px-5 py-8 font-mono text-[12px] text-zinc-400 md:px-6 dark:text-zinc-500">An empty block: consensus accepted it with no transactions.</p>
      ) : (
        <div className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-4 md:px-6">
          {/* the map */}
          <div className="relative">
            <div
              ref={strip}
              className="flex h-16 w-full select-none gap-[2px]"
              style={{ touchAction: "pan-y" }}
              onMouseLeave={() => onHover(null)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClickCapture={onClickCapture}
            >
              {txs.map((t, i) => {
                const share = t.gasUsed / txGas;
                const key = groupOf.get(t.hash)!;
                const label = labelOf.get(key)!;
                const out = active && !(inRange(i) && inPick(t));
                const dim = out || (hover !== null && hover !== t.hash);
                return (
                  <Link
                    key={t.hash}
                    href={`${base}/tx/${t.hash}`}
                    draggable={false}
                    onMouseEnter={() => onHover(t.hash)}
                    onFocus={() => onHover(t.hash)}
                    aria-label={`${label}, ${formatNumber(t.gasUsed)} gas${t.success ? "" : ", reverted"}`}
                    className={cn("relative block h-full min-w-[3px] overflow-hidden transition-opacity duration-150", dim && (out ? "opacity-20" : "opacity-35"))}
                    style={{ flexGrow: t.gasUsed, flexBasis: 0, background: toneOf.get(key) }}
                  >
                    {!t.success && <span aria-hidden className="absolute inset-0" style={{ background: REVERT_STRIPES }} />}
                    {/* wide segments name themselves */}
                    {share >= 0.12 && (
                      <span className="absolute inset-x-2 bottom-1.5 hidden truncate sm:block font-mono text-[10px] leading-none text-white/95">
                        {label}
                        <span className="ml-1.5 text-white/70">{(share * 100).toFixed(0)}%</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            {/* the hovered tx, under the map */}
            {hoverTx && !drag.current?.moved && (
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2">
                <TipPlate>
                  <p className="flex items-center gap-2 font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                    <span className="h-1.5 w-1.5" style={{ background: toneOf.get(hoverKey!) }} />
                    {hoverTx.methodId ? method(hoverTx).label : sendLabel}
                    {!hoverTx.success && <span className="text-[#E6212F]">reverted</span>}
                  </p>
                  <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                    {formatNumber(hoverTx.gasUsed)} gas charged · {((hoverTx.gasUsed / txGas) * 100).toFixed(1)}% of the block
                    {hoverTx.feeWei ? ` · ${formatEther(hoverTx.feeWei, { decimals: 6 })} ${sym}` : ""}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-400">
                    {truncate(hoverTx.from, 6)} → {hoverTx.to ? truncate(hoverTx.to, 6) : "contract creation"} · #{hoverTx.txIndex} · {truncate(hoverTx.hash, 6)}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-300 dark:text-zinc-600">click opens · drag selects</p>
                </TipPlate>
              </div>
            )}
          </div>

          {/* how much of the block that was */}
          <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
            <span className="h-1 flex-1 bg-zinc-100 dark:bg-zinc-900">
              <span className={cn("block h-full", pctOfLimit >= 90 ? "bg-[#E6212F]" : "bg-zinc-700 dark:bg-zinc-300")} style={{ width: `${Math.max(pctOfLimit > 0 ? 0.5 : 0, Math.min(100, pctOfLimit)).toFixed(2)}%` }} />
            </span>
            <span className="shrink-0">
              reserved <span className={INK}>{pctOfLimit.toFixed(1)}%</span> of the {formatNumber(gasLimit)} limit
            </span>
          </div>

          {/* what is picked out, with its doors */}
          {active && (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-zinc-900 px-3 py-2 font-mono text-[11px] dark:border-zinc-100">
              <span className="flex flex-wrap items-baseline gap-x-3 tabular-nums text-zinc-900 dark:text-zinc-50">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E6212F]">Selected</span>
                <span>
                  {selected.length} tx{selected.length === 1 ? "" : "s"}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">{formatNumber(selGas)} gas charged</span>
                <span className="text-zinc-500 dark:text-zinc-400">{((selGas / txGas) * 100).toFixed(1)}% of the block</span>
                {selReverted > 0 && <span className="text-[#E6212F]">{selReverted} reverted</span>}
                {range && (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    #{range[0]}–#{range[1]}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em]">
                {selected.length === 1 && (
                  <Link href={`${base}/tx/${selected[0].hash}`} className="text-zinc-600 hover:text-[#E6212F] dark:text-zinc-300">
                    Open →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => askAbout(`Explain the ${selected.length === 1 ? "selected transaction" : `${selected.length} selected transactions`} in this block.`)}
                  className="text-zinc-600 hover:text-[#E6212F] dark:text-zinc-300"
                >
                  Ask about this
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRange(null);
                    setPicked(new Set());
                  }}
                  className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-50"
                >
                  Clear
                </button>
              </span>
            </div>
          )}

          {/* the groups: each row a filter */}
          <div className="mt-auto grid gap-x-8 gap-y-2 font-mono text-[12px] sm:grid-cols-2">
            {shown.map((g) => {
              const on = picked.has(g.key);
              const off = picked.size > 0 && !on;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => togglePick(g.key)}
                  onMouseEnter={() => onHover(null)}
                  aria-pressed={on}
                  title={on ? "click to take this out of the selection" : "click to select only this"}
                  className={cn(
                    "flex min-w-0 items-center justify-between gap-3 text-left transition-opacity",
                    (off || (hoverKey && hoverKey !== g.key)) && "opacity-40",
                    on && "-mx-1.5 bg-zinc-100 px-1.5 dark:bg-zinc-900",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0" style={{ background: g.tone }} />
                    <span className={cn("min-w-0 truncate", g.key === sendLabel ? "text-zinc-500 dark:text-zinc-400" : g.named && lens === "method" ? fnInk : g.named ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400")}>
                      {g.label}
                    </span>
                    <span className="shrink-0 text-zinc-400 dark:text-zinc-500">×{g.n}</span>
                    {g.reverted > 0 && lens !== "status" && <span className="shrink-0 text-[10px] text-[#E6212F]">{g.reverted} reverted</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-50">{((g.gas / txGas) * 100).toFixed(0)}%</span>
                </button>
              );
            })}
            {rest.length > 0 && (
              <span className="flex items-center justify-between gap-3 text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2" style={{ background: TAIL_TONE }} />
                  {rest.length} more {lens === "method" ? "method" : lens === "sender" ? "sender" : lens === "recipient" ? "recipient" : "kind"}
                  {rest.length === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums">{((rest.reduce((s, g) => s + g.gas, 0) / txGas) * 100).toFixed(0)}%</span>
              </span>
            )}
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-300 dark:text-zinc-600">hover reads · click opens · drag selects · legend filters · lens recolours</p>
        </div>
      )}
    </Board>
  );
}
