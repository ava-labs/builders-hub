"use client";

import { useMemo, useState } from "react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, DetailSkeleton, FIG, HashChip, SectionHeader, SpecLine, SpecSheet, StatCell, StatStrip, SubjectHeadline, Tabs, UNIT } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, formatUsd, timeAgo } from "@/components/explorer-v2/format";
import { NotFound } from "@/components/explorer-v2/detail-parts";
import { type Address, type AddressTxs } from "@/lib/pchain-explorer";
import { useAvaxUsd, usePchainData } from "./hooks";
import { AddressTxTable, AddressUtxoTable, BalanceBreakdown } from "./address-parts";

/* One P-Chain address in the C-Chain address page's grammar: the address
   as the subject with when it was first funded beside it, the balance
   and its three parts in a strip, the identifiers, then where every AVAX
   sits, and the history and the UTXOs as two tabs. */

/* How many UTXO rows to mount before the reader asks for more. The API
   returns up to 1,000, and a 4,000-UTXO exchange address was mounting all
   of them into a box that shows eight. */
const UTXO_PAGE = 50;

/* Transaction paging. The type filter runs client-side because the address
   txs endpoint ignores a `type` param (unlike the /txs list endpoint), so
   the filter can only see what has been loaded, and the UI says so.
   Paging is cursor-based (?before=<blockHeight> from the response's
   nextBefore), so history walks arbitrarily far back. */
const TX_PAGE = 50;

type Tab = "txs" | "utxos";

export function PchainAddress({ chain, network, addr }: { chain: string; network: string; addr: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: a, loading, error } = usePchainData<Address>(network, `address/${addr}`);
  const { data: history, loading: txsLoading } = usePchainData<AddressTxs>(network, `address/${addr}/txs`, { limit: TX_PAGE });
  // older pages appended via the nextBefore cursor; each page is a stable URL
  const [olderPages, setOlderPages] = useState<AddressTxs[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastPage = olderPages.length ? olderPages[olderPages.length - 1] : history;
  const nextCursor = lastPage?.nextBefore;
  const loadMoreTxs = async () => {
    if (nextCursor === undefined || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/pchain/${network}/address/${addr}/txs?limit=${TX_PAGE}&before=${nextCursor}`);
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
  const [tab, setTab] = useState<Tab>("txs");

  const txs = useMemo(() => [...(history?.txs ?? []), ...olderPages.flatMap((p) => p.txs)], [history, olderPages]);
  const shownCount = txType ? txs.filter((t) => t.txType === txType).length : txs.length;

  const total = a ? Number(a.balance.total) : 0;
  // a part as its figure and its share of the balance
  const part = (raw: string) => ({ fig: formatAvax(raw, { compact: true, symbol: false }), share: total > 0 ? `${((Number(raw) / total) * 100).toFixed(1)}% of the balance` : undefined });
  const usd = a ? formatUsd(a.balance.total, avaxUsd) : undefined;

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Address" />}
      {error && <NotFound label="Address not found" id={addr} />}
      {a && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader label="Address" />

            {/* the subject, and when money first reached it, on one baseline */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
              <SubjectHeadline value={a.address} copyLabel="Copy address" />
              {a.fundedBy && (
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  funded {timeAgo(a.fundedBy.blockTimestamp)}
                  <span className="text-zinc-400 dark:text-zinc-500"> · since {formatTime(a.fundedBy.blockTimestamp).slice(0, 10)}</span>
                </span>
              )}
            </div>

            {/* the balance and the three states it can be in */}
            <StatStrip cols={5}>
              <StatCell label="Balance" sub={usd ? `${usd} at $${avaxUsd?.toFixed(2)}/AVAX` : undefined}>
                <span className={FIG}>
                  {formatAvax(a.balance.total, { compact: true, symbol: false })} <span className={UNIT}>AVAX</span>
                </span>
              </StatCell>
              {(
                [
                  ["Unlocked", a.balance.unlocked],
                  ["Locked", a.balance.locked],
                  ["Staked", a.balance.staked],
                ] as const
              ).map(([label, raw]) => {
                const p = part(raw);
                return (
                  <StatCell key={label} label={label} sub={Number(raw) > 0 ? p.share : undefined}>
                    <span className={FIG}>
                      {p.fig} <span className={UNIT}>AVAX</span>
                    </span>
                  </StatCell>
                );
              })}
              {/* the API returns the newest 1,000: say so rather than letting the list below quietly disagree */}
              <StatCell label="Unspent UTXOs" sub={a.utxos.length < a.utxoCount ? `${formatNumber(a.utxos.length)} newest indexed` : undefined}>
                <span className={FIG}>{formatNumber(a.utxoCount)}</span>
              </StatCell>
            </StatStrip>

            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label="Address">
                  <HashChip value={a.address} len={66} />
                </SpecLine>
                {a.fundedBy && (
                  <SpecLine label="First Funded">
                    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span>
                        {formatTime(a.fundedBy.blockTimestamp)} · {timeAgo(a.fundedBy.blockTimestamp)}
                      </span>
                      <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{formatAvax(a.fundedBy.amount)} in</span>
                      <HashChip value={a.fundedBy.txHash} href={`${base}/tx/${a.fundedBy.txHash}`} len={16} />
                    </span>
                  </SpecLine>
                )}
                {a.fundedBy && a.fundedBy.funders.length > 0 && (
                  <SpecLine label="Funded From" align="start">
                    <span className="flex flex-col gap-1">
                      {a.fundedBy.funders.map((f) => (
                        <HashChip key={f} value={f} href={`${base}/address/${f}`} len={66} />
                      ))}
                    </span>
                  </SpecLine>
                )}
              </SpecSheet>
            </Board>
          </section>

          <BalanceBreakdown a={a} avaxUsd={avaxUsd} />

          <section className="flex flex-col gap-4">
            <Tabs<Tab>
              tabs={["txs", "utxos"]}
              active={tab}
              onChange={setTab}
              labels={{
                txs: `Transactions${history ? ` · ${shownCount}${!txType && history.truncated ? "+" : ""}` : ""}`,
                utxos: `UTXOs · ${formatNumber(a.utxoCount)}`,
              }}
            />
            {tab === "txs" ? (
              <AddressTxTable
                txs={txs}
                type={txType}
                onType={setTxType}
                base={base}
                loading={txsLoading}
                more={{ can: nextCursor !== undefined, loading: loadingMore, onMore: loadMoreTxs, truncated: !!history?.truncated }}
              />
            ) : (
              <AddressUtxoTable a={a} base={base} limit={utxoLimit} onMore={() => setUtxoLimit((n) => n + UTXO_PAGE * 4)} />
            )}
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}
