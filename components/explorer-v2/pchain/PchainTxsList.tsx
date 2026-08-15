"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, CellLabel, SectionHeader, TxTypePill, TypeFilterRail, idInk } from "@/components/explorer-v2/ui";
import { ageOrDate, formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData, LIVE_REFRESH_MS } from "./hooks";
import { txTypeLabel, type TxSummary } from "@/lib/pchain-explorer";

/* Deliberate order (validator business first, plumbing last), with the
   display names coming from the shared map so this rail and the one on the
   address page can't drift apart. */
const TYPE_OPTIONS: { value: string; label: string }[] = [
  "",
  "AddPermissionlessValidatorTx",
  "AddPermissionlessDelegatorTx",
  "RewardValidatorTx",
  "AddAutoRenewedValidatorTx",
  "SetAutoRenewedValidatorConfigTx",
  "RewardAutoRenewedValidatorTx",
  "ImportTx",
  "ExportTx",
  "BaseTx",
  "CreateSubnetTx",
  "CreateChainTx",
  "ConvertSubnetToL1Tx",
].map((value) => ({ value, label: value ? txTypeLabel(value) : "All types" }));

export function PchainTxsList({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const [limit, setLimit] = useState(50);
  const [type, setType] = useState("");
  const { data, loading } = usePchainData<TxSummary[]>(network, "txs", { limit, type: type || undefined }, { refreshMs: LIVE_REFRESH_MS });
  /* Cursor paging: the live page keeps refreshing at the tip; older pages
     are fetched once with ?before=<lastBlockHeight> and appended. */
  const [older, setOlder] = useState<TxSummary[]>([]);
  const [pagedOut, setPagedOut] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const live = data ?? [];
  const seenHashes = new Set(live.map((t) => t.txHash));
  const txs = [...live, ...older.filter((t) => !seenHashes.has(t.txHash))];
  const loadOlder = async () => {
    const last = txs[txs.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ limit: "50", before: String(last.blockHeight) });
      if (type) qs.set("type", type);
      const res = await fetch(`/api/pchain/${network}/txs?${qs}`);
      const page: TxSummary[] = res.ok ? await res.json() : [];
      if (page.length === 0) setPagedOut(true);
      setOlder((o) => [...o, ...page]);
    } finally {
      setLoadingMore(false);
    }
  };
  const activeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";

  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Transactions"
          action={
            type ? (
              <button
                onClick={() => {
                  setType("");
                  setLimit(50);
                  setOlder([]);
                  setPagedOut(false);
                }}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
              >
                Clear filter ✕
              </button>
            ) : undefined
          }
        />
        <TypeFilterRail
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => {
            setType(v);
            setLimit(50);
                  setOlder([]);
                  setPagedOut(false);
          }}
        />
        <Board className={cn(loading && txs.length > 0 && "opacity-60 transition-opacity")}>
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
              <span className={`truncate font-mono text-[12px] ${idInk}`}>
                {truncate(t.txHash, 16)}
              </span>
              <span className="justify-self-start">
                <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />
              </span>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Block</CellLabel>
                #{formatNumber(t.blockHeight)}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                <span title={ageOrDate(t.blockTimestamp).title}>{ageOrDate(t.blockTimestamp).text}</span>
              </div>
            </Link>
          ))}
          {loading && <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>}
          {!loading && txs.length === 0 && (
            <div className="flex items-baseline gap-3 px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
              {type ? `No recent ${activeLabel} transactions` : "no transactions"}
              {type && (
                <button
                  onClick={() => {
                    setType("");
                    setLimit(50);
                  setOlder([]);
                  setPagedOut(false);
                  }}
                  className="uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                >
                  Show all
                </button>
              )}
            </div>
          )}
        </Board>
        {!loading && txs.length >= limit && !pagedOut && (
          <button
            onClick={loadOlder}
            disabled={loadingMore}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </ExplorerShell>
  );
}
