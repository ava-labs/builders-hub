"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, CellLabel, EmptyRow, HEAD, INK, LoadMore, MUTED, ROW, RowDoor, RowSkeleton, SectionHeader, TxTypePill, TypeFilterRail, idInk, txToneText } from "@/components/explorer-v2/ui";
import { ageOrDate, formatAvax, formatNumber, formatTime, formatUsd, truncate } from "@/components/explorer-v2/format";
import { txTypeLabel, type Address, type AddressBreakdown, type AddressTx, type AddressUtxo } from "@/lib/pchain-explorer";

/* The address page's three ledgers: where the balance sits, the txs it
   took part in, and its unspent UTXOs, each in the explorer's row grammar. */

const RULE = "border-b border-zinc-200 dark:border-zinc-800";
/* a footnote under a ledger: sans, in the quiet gray */
const FOOT = "text-[13px] text-zinc-500 dark:text-zinc-400";

/* the class tones: staked wears the stake family's green, atomic memory the
   cross-chain teal, unlocked the block gray, locked a quieter gray */
const TONE = {
  unlocked: "text-[#A2AFB2]",
  locked: "text-zinc-300 dark:text-zinc-600",
  staked: txToneText("stake"),
  atomic: txToneText("export"),
} as const;

type Tone = keyof typeof TONE;

/* every class the API names, all eight even when zero: "nothing is locked" is itself the answer */
const CLASSES: { key: keyof AddressBreakdown; label: string; tone: Tone; hint: string }[] = [
  { key: "lockedStaked", label: "Locked Staked", tone: "staked", hint: "staked, and time-locked past the stake's end" },
  { key: "lockedStakeable", label: "Locked Stakeable", tone: "locked", hint: "time-locked, but may be staked" },
  { key: "lockedPlatform", label: "Locked Platform", tone: "locked", hint: "time-locked, and may not be staked" },
  { key: "atomicMemoryLocked", label: "Atomic Memory Locked", tone: "atomic", hint: "exported to the P-Chain, not yet imported, time-locked" },
  { key: "atomicMemoryUnlocked", label: "Atomic Memory Unlocked", tone: "atomic", hint: "exported to the P-Chain, not yet imported" },
  { key: "unlockedUnstaked", label: "Unlocked Unstaked", tone: "unlocked", hint: "free to spend" },
  { key: "unlockedStaked", label: "Unlocked Staked", tone: "staked", hint: "staked, spendable when the stake ends" },
  { key: "pendingStaked", label: "Staked, Not Started", tone: "staked", hint: "staked, staking period not begun" },
];

/* an older API without the breakdown: the three-way split, the parts that hold any */
const SPLIT: { key: keyof Address["balance"]; label: string; tone: Tone; hint: string }[] = [
  { key: "unlocked", label: "Unlocked", tone: "unlocked", hint: "free to spend" },
  { key: "locked", label: "Locked", tone: "locked", hint: "time-locked" },
  { key: "staked", label: "Staked", tone: "staked", hint: "staked" },
];

export function BalanceBreakdown({ a, avaxUsd }: { a: Address; avaxUsd: number | null }) {
  const rows = a.breakdown
    ? CLASSES.map((c) => ({ ...c, raw: Number(a.breakdown![c.key]) }))
    : SPLIT.map((c) => ({ ...c, raw: Number(a.balance[c.key]) })).filter((r) => r.raw > 0);
  const total = rows.reduce((s, r) => s + r.raw, 0);
  const atomic = a.breakdown ? Number(a.breakdown.atomicMemoryLocked) + Number(a.breakdown.atomicMemoryUnlocked) : 0;
  const usd = avaxUsd !== null;
  const cols = usd ? "md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,11rem)_6.5rem_4rem]" : "md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,11rem)_4rem]";
  const share = (raw: number) => (total > 0 ? `${((raw / total) * 100).toFixed(1)}%` : "—");
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Balance Breakdown" />
      <Board divide={false}>
        {total > 0 && (
          <div className={cn("px-5 py-4 md:px-6", RULE)}>
            <div className="flex h-2 w-full gap-px overflow-hidden" aria-hidden>
              {rows
                .filter((r) => r.raw > 0)
                .map((r) => (
                  <span key={r.key} className={cn("bg-current", TONE[r.tone])} style={{ width: `${(r.raw / total) * 100}%` }} />
                ))}
            </div>
          </div>
        )}
        <div className={cn(HEAD, cols, RULE)}>
          <span>Class</span>
          <span>What It Is</span>
          <span className="text-right">Amount</span>
          {usd && <span className="text-right">USD</span>}
          <span className="text-right">Share</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((r) => (
            <div key={r.key} className={cn(ROW, cols, "hover:bg-transparent dark:hover:bg-transparent", r.raw === 0 && "opacity-50")}>
              <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300" title={r.hint}>
                <span className={cn("size-1.5 shrink-0 bg-current", TONE[r.tone])} aria-hidden />
                <span className="md:truncate">{r.label}</span>
              </span>
              <span className={cn(MUTED, "max-md:order-last max-md:col-span-2 md:truncate")}>{r.hint}</span>
              <span className={cn(INK, "text-right")}>{formatAvax(r.raw)}</span>
              {usd && (
                <span className={cn(MUTED, "md:text-right", r.raw === 0 && "max-md:hidden")}>
                  <CellLabel>USD</CellLabel>
                  {r.raw > 0 ? (formatUsd(r.raw, avaxUsd) ?? "") : ""}
                </span>
              )}
              <span className={cn(MUTED, "text-right max-md:col-start-2")}>
                <CellLabel>Share</CellLabel>
                {share(r.raw)}
              </span>
            </div>
          ))}
          <div className={cn(ROW, cols, "hover:bg-transparent dark:hover:bg-transparent")}>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900 dark:text-zinc-50">Total Balance</span>
            <span className={cn(MUTED, "max-md:order-last max-md:col-span-2 max-md:empty:hidden")}>{atomic > 0 ? "incl. atomic memory" : ""}</span>
            <span className={cn(INK, "text-right font-bold")}>{formatAvax(total)}</span>
            {usd && (
              <span className={cn(MUTED, "md:text-right")}>
                <CellLabel>USD</CellLabel>
                {formatUsd(total, avaxUsd) ?? ""}
              </span>
            )}
            <span className="max-md:hidden" />
          </div>
        </div>
      </Board>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Transactions: hash · type · net · age, filtered by the types loaded  */

export function AddressTxTable({
  txs,
  type,
  onType,
  base,
  loading,
  more,
}: {
  txs: AddressTx[];
  type: string;
  onType: (t: string) => void;
  base: string;
  loading: boolean;
  more: { can: boolean; loading: boolean; onMore: () => void; truncated: boolean };
}) {
  /* the filter offers what this address has done, with counts, not every
     P-Chain type: a chip that can only return nothing is not offered */
  const counts = new Map<string, number>();
  for (const t of txs) if (t.txType) counts.set(t.txType, (counts.get(t.txType) ?? 0) + 1);
  const options = [
    { value: "", label: `All types ${txs.length}` },
    ...[...counts.entries()].sort((x, y) => y[1] - x[1]).map(([v, n]) => ({ value: v, label: `${txTypeLabel(v)} ${n}` })),
  ];
  const shown = type ? txs.filter((t) => t.txType === type) : txs;
  const cols = "md:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_minmax(0,11rem)_6rem]";
  return (
    <div className="flex flex-col gap-4">
      {txs.length > 0 && <TypeFilterRail options={options} value={type} onChange={onType} />}
      <Board divide={false} className={cn(loading && txs.length > 0 && "opacity-60 transition-opacity")}>
        <div className={cn(HEAD, cols, RULE)}>
          <span>Hash</span>
          <span>Type</span>
          <span className="text-right">Net</span>
          <span className="text-right">Age</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {shown.map((t) => {
            const net = Number(t.net);
            const age = ageOrDate(t.blockTimestamp);
            return (
              <RowDoor key={t.txHash} href={`${base}/tx/${t.txHash}`} className={cn(ROW, cols)}>
                <Link href={`${base}/tx/${t.txHash}`} className={cn("truncate font-mono text-[12.5px] hover:text-[#E6212F]", idInk)} onClick={(e) => e.stopPropagation()}>
                  {truncate(t.txHash, 20)}
                </Link>
                <span className="flex min-w-0 max-md:justify-end">
                  {t.txType && <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />}
                </span>
                <span
                  className={cn(
                    "font-mono text-[12.5px] tabular-nums md:text-right",
                    net > 0 ? "text-emerald-600 dark:text-emerald-400" : net < 0 ? "text-[#E6212F]" : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  <CellLabel>Net</CellLabel>
                  {net > 0 ? "+" : ""}
                  {formatAvax(t.net)}
                </span>
                <span className={cn(MUTED, "text-right")} title={age.title}>
                  <CellLabel>Age</CellLabel>
                  {age.text}
                </span>
              </RowDoor>
            );
          })}
        </div>
        {loading && txs.length === 0 && <RowSkeleton n={8} />}
        {!loading && shown.length === 0 && (
          <EmptyRow>{type ? `no ${txTypeLabel(type)} transactions among the ${formatNumber(txs.length)} loaded` : "no transactions"}</EmptyRow>
        )}
      </Board>
      {/* the filter sees only the rows loaded, so a count is of those, not of the whole history */}
      {(more.can || more.truncated) && (
        <div className="flex flex-col items-center gap-2">
          {more.can && <LoadMore onClick={more.onMore} disabled={more.loading} />}
          <span className={FOOT}>
            {type ? "Filtering the" : "Showing the"} newest {formatNumber(txs.length)}
            {!more.can && ", the full recorded history"}.
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UTXOs: amount · kind · held by · made in · block                     */

export function AddressUtxoTable({ a, base, limit, onMore }: { a: Address; base: string; limit: number; onMore: () => void }) {
  const now = Date.now() / 1000;
  const cols = "md:grid-cols-[minmax(0,12rem)_minmax(0,7rem)_minmax(0,1fr)_minmax(0,9rem)_7rem]";
  return (
    <div className="flex flex-col gap-4">
      <Board divide={false}>
        <div className={cn(HEAD, cols, RULE)}>
          <span>Amount</span>
          <span>Kind</span>
          <span>Held By</span>
          <span>Made In</span>
          <span className="text-right">Block</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {a.utxos.slice(0, limit).map((u: AddressUtxo, i) => {
            // a stake output whose term has ended is spendable again: it reads "returned"
            const held = [
              u.staked ? { type: "stake", label: "staked" } : u.utxoKind === "stake" || u.utxoKind === "stakeable-locked" ? { type: "neutral", label: "returned" } : null,
              u.platformLocktime > now ? { type: "locked", label: `locked to ${formatTime(u.platformLocktime).slice(0, 10)}` } : null,
              u.threshold > 1 ? { type: "owners", label: `${u.threshold} to sign` } : null,
            ].filter((f): f is { type: string; label: string } => f !== null);
            return (
              <div key={`${u.utxoId}-${i}`} className={cn(ROW, cols, "hover:bg-transparent dark:hover:bg-transparent")}>
                <span className={cn(INK, "truncate")} title={`${u.amount} nAVAX`}>
                  {formatAvax(u.amount)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 max-md:text-right dark:text-zinc-400">{u.utxoKind}</span>
                <span className="min-w-0">
                  <CellLabel>Held By</CellLabel>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    {held.map((f) => (
                      <TxTypePill key={f.label} type={f.type} label={f.label} />
                    ))}
                  </span>
                </span>
                <span className="min-w-0 max-md:text-right">
                  <CellLabel>Made In</CellLabel>
                  <Link href={`${base}/tx/${u.txHash}`} className={cn("block truncate font-mono text-[12px] hover:text-[#E6212F]", idInk)} title={u.txHash}>
                    {truncate(u.txHash, 8)}
                  </Link>
                </span>
                <span className={cn(MUTED, "text-right max-md:col-start-2")}>
                  <CellLabel>Block</CellLabel>
                  <Link href={`${base}/block/${u.blockNumber}`} className="transition-colors hover:text-[#E6212F]">
                    {formatNumber(Number(u.blockNumber))}
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
        {a.utxos.length === 0 && <EmptyRow>no unspent UTXOs</EmptyRow>}
      </Board>
      {a.utxos.length > limit && (
        <div className="flex flex-col items-center gap-2">
          <LoadMore onClick={onMore} label="Show more" />
          <span className={FOOT}>
            Showing {formatNumber(limit)} of {formatNumber(a.utxos.length)}.
          </span>
        </div>
      )}
    </div>
  );
}
