"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, EmptyRow, LoadMore, RowSkeleton, SectionHeader, TypeFilterRail } from "@/components/explorer-v2/ui";
import { Belt, MotionRow } from "@/components/explorer-v2/evm/belt";
import { pchainApiPath, txTypeLabel, type TxSummary } from "@/lib/pchain-explorer";
import { LIVE_REFRESH_MS, usePchainData } from "./hooks";
import { TxHead, TxLine, txLayout } from "./boards";

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
const PAGE = 50;

export function PchainTxsList({ chain, network }: { chain: string; network: string }) {
  const [type, setType] = useState("");
  const base = `/explorer/${network}/${chain}`;
  const clear = (
    <button
      onClick={() => setType("")}
      className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
    >
      Clear filter ✕
    </button>
  );
  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Transactions" action={type ? clear : undefined} />
        <TypeFilterRail options={TYPE_OPTIONS} value={type} onChange={setType} />
        {/* a network or a type starts the ledger over */}
        <TxsLedger key={`${network}:${type}`} network={network} base={base} type={type} onClear={() => setType("")} />
      </section>
    </ExplorerShell>
  );
}

function TxsLedger({ network, base, type, onClear }: { network: string; base: string; type: string; onClear: () => void }) {
  // the newest page, polled at the tip; older pages are read once with
  // ?before=<last block height> and land beneath it
  const { data, loading } = usePchainData<TxSummary[]>(network, "txs", { limit: PAGE, type: type || undefined }, { refreshMs: LIVE_REFRESH_MS });
  const [older, setOlder] = useState<TxSummary[]>([]);
  const [pagedOut, setPagedOut] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // the top block when the pointer came over the ledger: newer txs wait above it
  const [heldAt, setHeldAt] = useState<number | null>(null);

  const live = data ?? [];
  const onPage = new Set(live.map((t) => t.txHash));
  const txs = [...live, ...older.filter((t) => !onPage.has(t.txHash))];
  // the rows it opens with stand still; a tx in a later block slides in
  const top = useRef<number | null>(null);
  if (top.current === null && txs.length) top.current = txs[0].blockHeight;

  const loadOlder = async () => {
    const last = txs[txs.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(pchainApiPath(network, "txs", { limit: PAGE, before: last.blockHeight, type: type || undefined }));
      const page: TxSummary[] = res.ok ? await res.json() : [];
      if (page.length === 0) setPagedOut(true);
      setOlder((o) => [...o, ...page]);
    } catch {
      setPagedOut(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const shown = heldAt === null ? txs : txs.filter((t) => t.blockHeight <= heldAt);
  const layout = txLayout(shown, true);
  const activeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";

  return (
    <>
      <Board
        divide={false}
        className={cn(loading && txs.length > 0 && "opacity-60 transition-opacity")}
        onMouseEnter={() => setHeldAt(txs[0]?.blockHeight ?? null)}
        onMouseLeave={() => setHeldAt(null)}
      >
        <TxHead {...layout} />
        {shown.length === 0 &&
          (loading ? (
            <RowSkeleton n={12} />
          ) : (
            <EmptyRow>
              {type ? `No recent ${activeLabel} transactions` : "no transactions"}
              {type && (
                <button
                  onClick={onClear}
                  className="ml-3 uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                >
                  Show all
                </button>
              )}
            </EmptyRow>
          ))}
        <Belt rows={shown.length}>
          {shown.map((t) => (
            <MotionRow key={t.txHash} animateIn={top.current !== null && t.blockHeight > top.current}>
              <TxLine t={t} base={base} layout={layout} />
            </MotionRow>
          ))}
        </Belt>
        {loadingMore && <RowSkeleton n={3} />}
      </Board>
      {!loading && txs.length >= PAGE && !pagedOut && <LoadMore onClick={loadOlder} disabled={loadingMore} />}
    </>
  );
}
