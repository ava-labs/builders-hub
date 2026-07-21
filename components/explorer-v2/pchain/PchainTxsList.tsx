"use client";

import { useState } from "react";
import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, SectionHeader, TxTypePill } from "@/components/explorer-v2/ui";
import { formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData, LIVE_REFRESH_MS } from "./hooks";
import type { TxSummary } from "@/lib/pchain-explorer";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "AddPermissionlessValidatorTx", label: "Add Validator" },
  { value: "AddPermissionlessDelegatorTx", label: "Add Delegator" },
  { value: "RewardValidatorTx", label: "Reward" },
  { value: "ImportTx", label: "Import" },
  { value: "ExportTx", label: "Export" },
  { value: "BaseTx", label: "Transfer" },
  { value: "CreateSubnetTx", label: "Create Subnet" },
  { value: "CreateChainTx", label: "Create Chain" },
  { value: "ConvertSubnetToL1Tx", label: "Convert to L1" },
];

export function PchainTxsList({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const [limit, setLimit] = useState(50);
  const [type, setType] = useState("");
  const { data, loading } = usePchainData<TxSummary[]>(network, "txs", { limit, type: type || undefined }, { refreshMs: LIVE_REFRESH_MS });
  const txs = data ?? [];

  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Transactions"
          action={
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setLimit(50);
              }}
              className="border border-zinc-200 bg-white/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          }
        />
        <Board>
          <div className="hidden grid-cols-[2fr_1.2fr_0.8fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Hash</span>
            <span>Type</span>
            <span className="text-right">Block</span>
            <span className="text-right">Age</span>
          </div>
          {txs.map((t) => (
            <Link
              key={t.txHash}
              href={`${base}/tx/${t.txHash}`}
              className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_0.8fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
            >
              <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{truncate(t.txHash, 16)}</span>
              <span className="justify-self-start">
                <TxTypePill type={t.txType.replace(/Tx$/, "")} />
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                #{formatNumber(t.blockHeight)}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                {timeAgo(t.blockTimestamp)}
              </span>
            </Link>
          ))}
          {loading && <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>}
          {!loading && txs.length === 0 && (
            <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">— no transactions —</div>
          )}
        </Board>
        {!loading && txs.length >= limit && (
          <button
            onClick={() => setLimit((l) => l + 50)}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more
          </button>
        )}
      </section>
    </ExplorerShell>
  );
}
