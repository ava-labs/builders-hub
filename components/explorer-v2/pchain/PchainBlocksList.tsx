"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, CellLabel, SectionHeader, TxTypePill, TypeFilterRail, idInk, HEAD, ROW, LoadMore, RowSkeleton } from "@/components/explorer-v2/ui";
import { ageOrDate, formatBytes, formatNumber, timeAgo, ageShort } from "@/components/explorer-v2/format";
import { pchainApiPath, type BlocksList, type BlockSummary } from "@/lib/pchain-explorer";
import { LIVE_REFRESH_MS } from "./hooks";
import { cn } from "@/lib/utils";

// The upstream /blocks endpoint has no type param (verified: ?type= is
// ignored), so this filter runs client-side over the loaded window —
// "Load more" keeps deepening it. Values are substring-matched against
// blockType, so "Commit" catches Banff and Apricot eras alike.
const BLOCK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Standard", label: "Standard" },
  { value: "Proposal", label: "Proposal" },
  { value: "Commit", label: "Commit" },
];

export function PchainBlocksList({ chain, network }: { chain: string; network: string }) {
  const router = useRouter();
  const base = `/explorer/${network}/${chain}`;
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [type, setType] = useState("");
  const [nextBefore, setNextBefore] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      try {
        const res = await fetch(pchainApiPath(network, "blocks", { limit: 25, before }));
        const data: BlocksList = await res.json();
        setBlocks((prev) => (before ? [...prev, ...(data.blocks ?? [])] : data.blocks ?? []));
        setNextBefore(data.nextBefore);
        if (!data.nextBefore || (data.blocks ?? []).length === 0) setDone(true);
      } catch {
        setDone(true);
      } finally {
        setLoading(false);
      }
    },
    [network],
  );

  useEffect(() => {
    setBlocks([]);
    setDone(false);
    load();
  }, [network, load]);

  // Auto-refresh: poll the newest page and prepend blocks we don't have yet,
  // leaving the already-loaded "load more" history (and scroll) untouched.
  useEffect(() => {
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(pchainApiPath(network, "blocks", { limit: 25 }));
        const data: BlocksList = await res.json();
        const fresh = data.blocks ?? [];
        if (!fresh.length) return;
        setBlocks((prev) => {
          if (!prev.length) return prev; // initial load owns the empty state
          const top = prev[0].blockNumber;
          const newer = fresh.filter((b) => b.blockNumber > top);
          return newer.length ? [...newer, ...prev] : prev;
        });
      } catch {
        /* transient — keep last-good blocks on screen */
      }
    };
    const id = setInterval(tick, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [network]);

  const visible = type ? blocks.filter((b) => b.blockType.includes(type)) : blocks;
  const activeLabel = BLOCK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";

  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Blocks"
          action={
            type ? (
              <button
                onClick={() => setType("")}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
              >
                Clear filter ✕
              </button>
            ) : undefined
          }
        />
        <TypeFilterRail options={BLOCK_TYPE_OPTIONS} value={type} onChange={setType} />
        <Board>
          <div className={cn(HEAD, "grid-cols-[1fr_1.1fr_0.5fr_0.6fr_minmax(19rem,2fr)_0.7fr]")}>
            <span>Height</span>
            <span>Type</span>
            <span className="text-right">Txs</span>
            <span className="text-right">Size</span>
            <span>Proposer</span>
            <span className="text-right">Age</span>
          </div>
          {visible.map((b) => (
            <div
              key={b.blockNumber}
              onClick={() => router.push(`${base}/block/${b.blockNumber}`)}
              className={cn(ROW, "cursor-pointer md:grid-cols-[1fr_1.1fr_0.5fr_0.6fr_minmax(19rem,2fr)_0.7fr]")}
            >
              <span className={`font-mono text-[13px] tabular-nums ${idInk}`}>
                #{formatNumber(b.blockNumber)}
              </span>
              <span className="justify-self-start">
                <TxTypePill type={b.blockType.replace(/Block$/, "")} />
              </span>
              <div className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Txs</CellLabel>
                {b.txCount}
              </div>
              <div className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Size</CellLabel>
                {formatBytes(b.blockSizeBytes)}
              </div>
              <div className="min-w-0">
                <CellLabel>Proposer</CellLabel>
                {b.proposerNodeId ? (
                  <Link
                    href={`${base}/node/${b.proposerNodeId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block truncate font-mono text-[12px] text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                  >
                    {b.proposerNodeId}
                  </Link>
                ) : (
                  <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">—</span>
                )}
              </div>
              <div className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                {ageShort(b.blockTimestamp)}
              </div>
            </div>
          ))}
          {loading && <RowSkeleton n={visible.length ? 3 : 12} />}
          {!loading && visible.length === 0 && (
            <div className="flex items-baseline gap-3 px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
              {type ? `No ${activeLabel} blocks in the loaded range. Load more below.` : "no blocks"}
              {type && (
                <button
                  onClick={() => setType("")}
                  className="uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                >
                  Show all
                </button>
              )}
            </div>
          )}
        </Board>
        {!done && !loading && (
          <LoadMore onClick={() => load(nextBefore)} />
        )}
      </section>
    </ExplorerShell>
  );
}
