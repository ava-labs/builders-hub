"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  CellLabel,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SubjectHeadline,
  TxTypePill,
  TypeFilterRail,
  idInk,
} from "@/components/explorer-v2/ui";
import { cn } from "@/lib/utils";
import { ageOrDate, formatAvax, formatNumber, formatTime, formatUsd, timeAgo, truncate } from "@/components/explorer-v2/format";
import { useAvaxUsd, usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import { txTypeLabel, type Address, type AddressTxs } from "@/lib/pchain-explorer";

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

/* Transaction paging. The type filter runs client-side because the address
   txs endpoint ignores a `type` param (unlike the /txs list endpoint), so
   the filter can only see what has been loaded, and the UI says so.
   Paging is cursor-based (?before=<blockHeight> from the response's
   nextBefore), so history walks arbitrarily far back — no fixed ceiling. */
const TX_PAGE = 50;

/* ---- the summary table ----------------------------------------------
   A real table rather than a grid of stacked cells: labels in their own
   aligned column, figures in theirs. Two columns only. A third "detail"
   column earned a header and a rule for what is only ever a short
   qualifier, so the qualifier rides under its own figure instead.
   Balance keeps its prominence through type weight (`lead`), not layout. */

interface MetricRow {
  label: string;
  value: React.ReactNode;
  /** muted qualifier under the figure: a share, a rate, a source */
  detail?: React.ReactNode;
  /** the page's headline figure, set larger and bolder than the rest */
  lead?: boolean;
}

function MetricTable({ rows }: { rows: MetricRow[] }) {
  /* Label at the left edge, figure at the right, one metric per row, the
     rule carrying the eye between them. No column headers: on a two-column
     key/value block "Metric" and "Value" are furniture, and the labels say
     what they are. Right-aligning the figures is what closes the gap that
     left-aligned values opened in a 1,390px table. */
  return (
    <Board divide={false}>
      <table className="w-full border-collapse">
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr key={r.label}>
              <th
                scope="row"
                className="px-5 py-3.5 text-left align-baseline font-mono text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-500 md:px-6 dark:text-zinc-400"
              >
                {r.label}
              </th>
              <td className="px-5 py-3.5 text-right align-baseline md:px-6">
                <span
                  className={cn(
                    "block font-mono tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50",
                    r.lead ? "text-lg font-bold md:text-xl" : "text-[13px]",
                  )}
                >
                  {r.value}
                </span>
                {r.detail != null && (
                  <span className="mt-1 block font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {r.detail}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Board>
  );
}

export function PchainAddress({ chain, network, addr }: { chain: string; network: string; addr: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: a, loading, error } = usePchainData<Address>(network, `address/${addr}`);
  const { data: history, loading: txsLoading } = usePchainData<AddressTxs>(
    network,
    `address/${addr}/txs`,
    { limit: TX_PAGE },
  );
  // older pages appended via the nextBefore cursor; each page is a stable URL
  const [olderPages, setOlderPages] = useState<AddressTxs[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastPage = olderPages.length ? olderPages[olderPages.length - 1] : history;
  const nextCursor = lastPage?.nextBefore;
  const loadMoreTxs = async () => {
    if (nextCursor === undefined || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/pchain/${network}/address/${addr}/txs?limit=${TX_PAGE}&before=${nextCursor}`,
      );
      if (res.ok) {
        const page: AddressTxs = await res.json();
        setOlderPages((ps) => [...ps, page]);
      }
    } finally {
      setLoadingMore(false);
    }
  };
  // mainnet only: Fuji AVAX has no market value to quote
  const avaxUsd = useAvaxUsd(network === "mainnet");
  const [utxoLimit, setUtxoLimit] = useState(UTXO_PAGE);
  const [txType, setTxType] = useState("");

  const txs = useMemo(
    () => [...(history?.txs ?? []), ...olderPages.flatMap((p) => p.txs)],
    [history, olderPages],
  );

  /* Filter options are derived from what this address has actually done,
     not from the global list of P-Chain tx types. Offering "Create Chain"
     on an exchange hot wallet that has only ever exported is a chip that
     can only ever return nothing. Counts ride in the label. */
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of txs) counts.set(t.txType, (counts.get(t.txType) ?? 0) + 1);
    return [
      { value: "", label: `All types ${txs.length}` },
      ...[...counts.entries()]
        .sort((x, y) => y[1] - x[1])
        .map(([v, n]) => ({ value: v, label: `${txTypeLabel(v)} ${n}` })),
    ];
  }, [txs]);

  const shownTxs = txType ? txs.filter((t) => t.txType === txType) : txs;
  // more to fetch, and headroom under the API's 200-row ceiling
  const canLoadMore = nextCursor !== undefined;

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

  // Rows are assembled rather than hand-written so the optional ones (USD off
  // testnet, provenance on an address the indexer has no funding tx for) drop
  // out without leaving an empty row behind.
  const metricRows: MetricRow[] = [];
  if (a) {
    metricRows.push({
      label: "Balance",
      lead: true,
      value: (
        <>
          {formatAvax(a.balance.total, { symbol: false })}
          <span className="ml-1.5 text-sm font-normal text-zinc-400 dark:text-zinc-500">AVAX</span>
        </>
      ),
      // lead with whatever is at work rather than with the unlocked share: on
      // a validator's payout address that reads "0.0% unlocked", which is true
      // and tells the reader nothing
      detail:
        stakedRaw > 0
          ? `${((stakedRaw / totalRaw) * 100).toFixed(1)}% staked`
          : lockedRaw > 0
            ? `${((lockedRaw / totalRaw) * 100).toFixed(1)}% locked`
            : "all unlocked",
    });
    if (usd) {
      metricRows.push({ label: "In USD", value: usd, detail: `at $${avaxUsd?.toFixed(2)}/AVAX` });
    }
    metricRows.push({
      label: "Unspent UTXOs",
      value: formatNumber(a.utxoCount),
      // the API returns the newest 1,000; say so rather than letting the list
      // below quietly disagree with this count
      detail: a.utxos.length < a.utxoCount ? `${formatNumber(a.utxos.length)} newest indexed` : undefined,
    });
    if (a.fundedBy) {
      metricRows.push({
        label: "First funded",
        value: timeAgo(a.fundedBy.blockTimestamp),
        // justify-end, not text-right: the cell's text alignment does not
        // reach flex children, which is what left these two rows floating
        // mid-row while every plain-text value sat flush right
        detail: (
          <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {formatAvax(a.fundedBy.amount)}
            <span aria-hidden>·</span>
            <HashChip value={a.fundedBy.txHash} href={`${base}/tx/${a.fundedBy.txHash}`} len={16} />
          </span>
        ),
      });
      if (a.fundedBy.funders.length > 0) {
        metricRows.push({
          label: "Funded from",
          value: (
            <span className="flex flex-col items-end gap-1">
              {a.fundedBy.funders.map((f) => (
                <HashChip key={f} value={f} href={`${base}/address/${f}`} len={18} />
              ))}
            </span>
          ),
        });
      }
    }
  }

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

          {/* ---------------- the summary table ---------------- */}
          <MetricTable rows={metricRows} />

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
              label={`Transactions${history ? ` · ${shownTxs.length}${!txType && history.truncated ? "+" : ""}` : ""}`}
              action={
                txType ? (
                  <button
                    onClick={() => setTxType("")}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                  >
                    Clear filter ✕
                  </button>
                ) : undefined
              }
            />
            {txs.length > 0 && (
              <TypeFilterRail options={typeOptions} value={txType} onChange={setTxType} />
            )}
            {/* no internal scroll: the old max-height box clipped a half row
                at its top edge under the sticky header, which read as broken */}
            <Board className={cn(txsLoading && txs.length > 0 && "opacity-60 transition-opacity")}>
              <div className="hidden grid-cols-[2.2fr_1fr_1fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Hash</span>
                <span>Type</span>
                <span className="text-right">Net</span>
                <span className="text-right">Age</span>
              </div>
              {shownTxs.map((t) => {
                const net = Number(t.net);
                return (
                  <Link
                    key={t.txHash}
                    href={`${base}/tx/${t.txHash}`}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2.2fr_1fr_1fr_0.8fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncate(t.txHash, 20)}</span>
                    <span className="justify-self-start">
                      <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />
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
                      <span title={ageOrDate(t.blockTimestamp).title}>{ageOrDate(t.blockTimestamp).text}</span>
                    </div>
                  </Link>
                );
              })}
              {history && shownTxs.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  {txType
                    ? `no ${txTypeLabel(txType)} transactions among the ${formatNumber(txs.length)} loaded`
                    : "no transactions"}
                </div>
              )}
            </Board>
            {/* The filter is client-side, so "42 Export" means 42 of the rows
                loaded so far, not of the address's whole history. Say that
                plainly rather than letting a filtered count read as a total. */}
            {(canLoadMore || history?.truncated) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {canLoadMore && (
                  <button
                    onClick={loadMoreTxs}
                    disabled={loadingMore}
                    className="border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                  >
                    Load more
                  </button>
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {txType ? "filtering the" : "showing the"} newest {formatNumber(txs.length)}
                  {!canLoadMore && ", the full recorded history"}
                </span>
              </div>
            )}
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
                    {u.staked ? (
                      <span className="border border-[#E6212F]/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#E6212F]">
                        staked
                      </span>
                    ) : (
                      /* a stake output whose term has ended is spendable again, explain its status */
                      (u.utxoKind === "stake" || u.utxoKind === "stakeable-locked") && (
                        <span className="border border-zinc-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                          returned
                        </span>
                      )
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
