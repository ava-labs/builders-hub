"use client";

import { useState } from "react";
import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  CellLabel,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  StatCell,
  StatStrip,
  SubjectHeadline,
  TxTypePill,
  idInk,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, formatUsd, timeAgo, truncate } from "@/components/explorer-v2/format";
import { useAvaxUsd, usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { Address, AddressTxs } from "@/lib/pchain-explorer";

/* Address view: subject, then figures, then activity.
 *
 * The page opens on the address itself at headline weight, the way every
 * other detail page opens on its tx hash / block / NodeID. The figures a
 * visitor came for (what is here, what it is worth) sit in one strip
 * directly under it, and the two long lists run full width below rather
 * than in a short rail that leaves a half-page gutter.
 *
 * Balance composition is deliberately conditional: most P-Chain addresses
 * are 100% unlocked, and for those the bar plus its three-row legend was
 * restating the hero figure three times. It only earns its space when
 * there is actually something locked or staked to split out.
 */

const BALANCE_TONES = {
  unlocked: "bg-[#A2AFB2]",
  locked: "bg-zinc-300 dark:bg-zinc-600",
  staked: "bg-[#E6212F]",
} as const;

/* How many UTXO rows to mount before the reader asks for more. The API
   returns up to 1,000, and a 4,000-UTXO exchange address was mounting all
   of them into a box that shows eight. */
const UTXO_PAGE = 50;

/* The strip's figure type, matching the shared StatFigure scale (which we
   can't use directly: it count-up animates a Number and would round AVAX
   to whole units). */
function Figure({ value, unit }: { value: string; unit?: string }) {
  return (
    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
      {value}
      {unit && <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>}
    </span>
  );
}

export function PchainAddress({ chain, network, addr }: { chain: string; network: string; addr: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: a, loading, error } = usePchainData<Address>(network, `address/${addr}`);
  const { data: history } = usePchainData<AddressTxs>(network, `address/${addr}/txs`, { limit: 50 });
  // mainnet only: Fuji AVAX has no market value to quote
  const avaxUsd = useAvaxUsd(network === "mainnet");
  const [utxoLimit, setUtxoLimit] = useState(UTXO_PAGE);

  const totalRaw = a ? Number(a.balance.total) : 0;
  const lockedRaw = a ? Number(a.balance.locked) : 0;
  const stakedRaw = a ? Number(a.balance.staked) : 0;
  // the bar and legend only mean something when the balance actually splits
  const isSplit = lockedRaw > 0 || stakedRaw > 0;
  const composition = a
    ? ([
        { key: "unlocked" as const, label: "Unlocked", raw: Number(a.balance.unlocked) },
        { key: "locked" as const, label: "Locked", raw: lockedRaw },
        { key: "staked" as const, label: "Staked", raw: stakedRaw },
      ] as const)
    : [];
  const usd = a ? formatUsd(a.balance.total, avaxUsd) : undefined;

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Address" />}
      {error && <NotFound label="Address not found" id={addr} />}
      {a && (
        <div className="flex flex-col gap-10">
          {/* ---------------- the subject ---------------- */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Address" />
            <SubjectHeadline value={a.address} copyLabel="Copy address" />
          </section>

          {/* ---------------- the ledger strip ---------------- */}
          <StatStrip cols={usd ? 4 : 3}>
            <StatCell
              label="Balance"
              sub={
                // lead with whatever is at work rather than with the unlocked
                // share: on a validator's payout address that reads "0.0%
                // unlocked", which is true and tells the reader nothing
                stakedRaw > 0
                  ? `${((stakedRaw / totalRaw) * 100).toFixed(1)}% staked`
                  : lockedRaw > 0
                    ? `${((lockedRaw / totalRaw) * 100).toFixed(1)}% locked`
                    : "all unlocked"
              }
            >
              <Figure value={formatAvax(a.balance.total, { symbol: false })} unit="AVAX" />
            </StatCell>
            {usd && (
              <StatCell label="In USD" sub={`at $${avaxUsd?.toFixed(2)}/AVAX`}>
                <Figure value={usd} />
              </StatCell>
            )}
            <StatCell
              label="Unspent UTXOs"
              sub={
                // the API returns the newest 1,000; say so rather than
                // letting the list quietly disagree with the count
                a.utxos.length < a.utxoCount
                  ? `${formatNumber(a.utxos.length)} newest indexed`
                  : undefined
              }
            >
              <Figure value={formatNumber(a.utxoCount)} />
            </StatCell>
            <StatCell
              label="First funded"
              sub={a.fundedBy ? `${formatAvax(a.fundedBy.amount)} · view tx` : undefined}
              href={a.fundedBy ? `${base}/tx/${a.fundedBy.txHash}` : undefined}
            >
              {a.fundedBy ? (
                <Figure value={timeAgo(a.fundedBy.blockTimestamp).replace(" ago", "")} unit="ago" />
              ) : (
                <Figure value="—" />
              )}
            </StatCell>
          </StatStrip>

          {/* provenance as one hairline line, not the five-row plate it was:
              the funders matter for tracing, but not at plate weight */}
          {a.fundedBy && a.fundedBy.funders.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              <span className="uppercase tracking-[0.16em]">Funded from</span>
              {a.fundedBy.funders.map((f) => (
                <HashChip key={f} value={f} href={`${base}/address/${f}`} len={20} />
              ))}
            </div>
          )}

          {/* balance composition, only when there is a split to show */}
          {isSplit && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Balance composition" />
              <Board divide={false} className="flex flex-col gap-5 px-5 py-5 md:px-6">
                <div className="flex h-2 w-full overflow-hidden" aria-hidden>
                  {composition
                    .filter((p) => p.raw > 0)
                    .map((p) => (
                      <span
                        key={p.key}
                        className={BALANCE_TONES[p.key]}
                        style={{ width: `${(p.raw / totalRaw) * 100}%` }}
                      />
                    ))}
                </div>
                <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {composition
                    .filter((p) => p.raw > 0)
                    .map((p) => (
                      <div key={p.key} className="flex items-baseline justify-between gap-6 py-2.5">
                        <dt className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                          <span className={`h-2 w-2 shrink-0 ${BALANCE_TONES[p.key]}`} aria-hidden />
                          {p.label}
                        </dt>
                        <dd className="flex items-baseline gap-3 text-[13.5px] font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                          <span className="flex flex-col items-end">
                            {formatAvax(p.raw)}
                            {formatUsd(p.raw, avaxUsd) && (
                              <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                                {formatUsd(p.raw, avaxUsd)}
                              </span>
                            )}
                          </span>
                          <span className="w-12 text-right font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                            {((p.raw / totalRaw) * 100).toFixed(1)}%
                          </span>
                        </dd>
                      </div>
                    ))}
                </dl>
              </Board>
            </section>
          )}

          {/* ---------------- activity, full width ---------------- */}
          <section className="flex flex-col gap-4">
            <SectionHeader
              label={`Transactions${history ? ` · ${history.txs.length}${history.truncated ? "+" : ""}` : ""}`}
            />
            {/* no internal scroll: the old max-height box clipped a half row
                at its top edge under the sticky header, which read as broken */}
            <Board>
              <div className="hidden grid-cols-[2.2fr_1fr_1fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Hash</span>
                <span>Type</span>
                <span className="text-right">Net</span>
                <span className="text-right">Age</span>
              </div>
              {(history?.txs ?? []).map((t) => {
                const net = Number(t.net);
                return (
                  <Link
                    key={t.txHash}
                    href={`${base}/tx/${t.txHash}`}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2.2fr_1fr_1fr_0.8fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncate(t.txHash, 20)}</span>
                    <span className="justify-self-start">
                      <TxTypePill type={t.txType.replace(/Tx$/, "")} />
                    </span>
                    <div
                      className={`font-mono text-[11px] tabular-nums md:text-right ${
                        net > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : net < 0
                            ? "text-[#E6212F]"
                            : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      <CellLabel>Net</CellLabel>
                      {net > 0 ? "+" : ""}
                      {formatAvax(t.net)}
                    </div>
                    <div
                      className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400"
                      title={formatTime(t.blockTimestamp)}
                    >
                      <CellLabel>Age</CellLabel>
                      {timeAgo(t.blockTimestamp)}
                    </div>
                  </Link>
                );
              })}
              {history && history.txs.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no transactions
                </div>
              )}
            </Board>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader
              label={`Unspent UTXOs · ${formatNumber(a.utxoCount)}`}
              action={
                a.utxos.length > utxoLimit ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    showing {formatNumber(utxoLimit)} of {formatNumber(a.utxos.length)}
                  </span>
                ) : undefined
              }
            />
            <Board>
              <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Amount</span>
                <span>Kind</span>
                <span />
                <span className="text-right">Block</span>
              </div>
              {a.utxos.slice(0, utxoLimit).map((u, i) => (
                <div
                  key={`${u.utxoId}-${i}`}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[1.4fr_1fr_1fr_0.8fr] md:items-center md:px-6"
                >
                  <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatAvax(u.amount)}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                    {u.utxoKind}
                  </span>
                  <span>
                    {u.staked && (
                      <span className="border border-[#E6212F]/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#E6212F]">
                        staked
                      </span>
                    )}
                  </span>
                  <Link
                    href={`${base}/block/${u.blockNumber}`}
                    className={`font-mono text-[11px] tabular-nums md:text-right ${idInk}`}
                  >
                    #{formatNumber(Number(u.blockNumber))}
                  </Link>
                </div>
              ))}
              {a.utxos.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no unspent UTXOs
                </div>
              )}
              {a.utxos.length > utxoLimit && (
                <button
                  type="button"
                  onClick={() => setUtxoLimit((n) => n + UTXO_PAGE * 4)}
                  className="w-full px-5 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-6 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                >
                  Show more
                </button>
              )}
            </Board>
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}
