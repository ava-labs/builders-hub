"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, CellLabel, SectionHeader, TxTypePill, TypeFilterRail, idInk, HEAD, ROW, LoadMore, RowSkeleton } from "@/components/explorer-v2/ui";
import { ageOrDate, formatNumber, timeAgo, truncate, ageShort } from "@/components/explorer-v2/format";
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
          <div className={cn(HEAD, "grid-cols-[2fr_1.2fr_0.8fr_0.7fr]")}>
            <span>Hash</span>
            <span>Type</span>
            <span className="text-right">Block</span>
            <span className="text-right">Age</span>
          </div>
          {txs.map((t) => (
            <Link
              key={t.txHash}
              href={`${base}/tx/${t.txHash}`}
              className={cn(ROW, "md:grid-cols-[2fr_1.2fr_0.8fr_0.7fr]")}
            >
              <span className={`truncate font-mono text-[12px] ${idInk}`}>
                {truncate(t.txHash, 6)}
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
                {ageShort(t.blockTimestamp)}
              </div>
            </Link>
          ))}
          {loading && <RowSkeleton n={txs.length ? 3 : 12} />}
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
          <LoadMore onClick={loadOlder} disabled={loadingMore} />
        )}
      </section>
    </ExplorerShell>
  );
}
