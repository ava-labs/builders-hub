"use client";

import { useState } from "react";
import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { ValidatorsResponse } from "@/lib/pchain-explorer";

export function PchainValidators({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data, loading, error } = usePchainData<ValidatorsResponse>(network, "validators");
  const [shown, setShown] = useState(50);
  const validators = data?.validators ?? [];

  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader
          label={`Validators${validators.length ? ` · ${validators.length}` : ""}`}
          action={
            data?.snapshotTimestamp ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                snapshot {timeAgo(data.snapshotTimestamp)}
              </span>
            ) : undefined
          }
        />
        {loading && <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
        {error && <NotFound label="No validator snapshot for this network yet" />}
        {data && (
          <>
            <Board>
              <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_0.6fr_0.7fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Node</span>
                <span className="text-right">Total Stake</span>
                <span className="text-right">Delegators</span>
                <span className="text-right">Fee</span>
                <span className="text-right">Uptime</span>
                <span className="text-right">Status</span>
              </div>
              {validators.slice(0, shown).map((v) => (
                <Link
                  key={`${v.nodeId}-${v.subnetId}`}
                  href={`${base}/node/${v.nodeId}`}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.6fr_1fr_0.7fr_0.6fr_0.7fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{truncate(v.nodeId, 18)}</span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                    {formatAvax(v.totalStake, { compact: true })}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {formatNumber(v.delegatorCount)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {v.delegationFeePercent}%
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {v.uptimePercent.toFixed(1)}%
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.1em] md:text-right ${
                      v.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {v.connected ? "online" : "offline"}
                  </span>
                </Link>
              ))}
            </Board>
            {shown < validators.length && (
              <button
                onClick={() => setShown((s) => s + 50)}
                className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
              >
                Load more
              </button>
            )}
          </>
        )}
      </section>
    </ExplorerShell>
  );
}
