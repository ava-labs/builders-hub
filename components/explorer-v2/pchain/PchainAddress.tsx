"use client";

import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, HashChip, SectionHeader, TxTypePill } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { Address, AddressTxs } from "@/lib/pchain-explorer";

export function PchainAddress({ chain, network, addr }: { chain: string; network: string; addr: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: a, loading, error } = usePchainData<Address>(network, `address/${addr}`);
  const { data: history } = usePchainData<AddressTxs>(network, `address/${addr}/txs`, { limit: 50 });

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
      {error && <NotFound label="Address not found" id={addr} />}
      {a && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Address" />
            <div className="flex items-center gap-2 px-1">
              <HashChip value={a.address} len={64} />
            </div>
          </section>

          {/* Balance tiles */}
          <Board divide={false}>
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
              {[
                { label: "TOTAL", v: a.balance.total },
                { label: "UNLOCKED", v: a.balance.unlocked },
                { label: "LOCKED", v: a.balance.locked },
                { label: "STAKED", v: a.balance.staked },
              ].map((c) => (
                <div key={c.label} className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {c.label}
                  </span>
                  <span className="font-mono text-lg tabular-nums tracking-tight text-zinc-900 md:text-xl dark:text-zinc-50">
                    {formatAvax(c.v)}
                  </span>
                </div>
              ))}
            </div>
          </Board>

          {/* Funded by */}
          {a.fundedBy && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="First Funded By" />
              <Board divide={false} className="flex flex-col gap-3 px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatAvax(a.fundedBy.amount)}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {formatTime(a.fundedBy.blockTimestamp)} · {timeAgo(a.fundedBy.blockTimestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">in</span>
                  <HashChip value={a.fundedBy.txHash} href={`${base}/tx/${a.fundedBy.txHash}`} len={24} />
                </div>
                {a.fundedBy.funders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">from</span>
                    {a.fundedBy.funders.map((f) => (
                      <Link
                        key={f}
                        href={`${base}/address/${f}`}
                        className="font-mono text-[11px] text-zinc-600 underline-offset-2 hover:text-[#E6212F] hover:underline dark:text-zinc-300"
                      >
                        {truncate(f, 14)}
                      </Link>
                    ))}
                  </div>
                )}
              </Board>
            </section>
          )}

          {/* Tx history */}
          <section className="flex flex-col gap-4">
            <SectionHeader label={`Transactions${history?.truncated ? " · partial" : ""}`} />
            <Board>
              <div className="hidden grid-cols-[2fr_1.2fr_1fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
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
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_1fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{truncate(t.txHash, 16)}</span>
                    <span className="justify-self-start">
                      <TxTypePill type={t.txType.replace(/Tx$/, "")} />
                    </span>
                    <span
                      className={`font-mono text-[11px] tabular-nums md:text-right ${
                        net > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : net < 0
                            ? "text-[#E6212F]"
                            : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {net > 0 ? "+" : ""}
                      {formatAvax(t.net)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                      {timeAgo(t.blockTimestamp)}
                    </span>
                  </Link>
                );
              })}
              {history && history.txs.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">— no transactions —</div>
              )}
            </Board>
          </section>

          {/* Unspent UTXOs */}
          <section className="flex flex-col gap-4">
            <SectionHeader label={`Unspent UTXOs · ${a.utxoCount}`} />
            <Board>
              {a.utxos.map((u) => (
                <div key={u.utxoId} className="flex items-center justify-between gap-4 px-5 py-3 md:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatAvax(u.amount)}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                      {u.utxoKind}
                    </span>
                    {u.staked && (
                      <span className="border border-[#E6212F]/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#E6212F]">
                        staked
                      </span>
                    )}
                  </div>
                  <Link
                    href={`${base}/block/${u.blockNumber}`}
                    className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 hover:text-[#E6212F] dark:text-zinc-400"
                  >
                    #{formatNumber(Number(u.blockNumber))}
                  </Link>
                </div>
              ))}
              {a.utxos.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">— no unspent UTXOs —</div>
              )}
            </Board>
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}
