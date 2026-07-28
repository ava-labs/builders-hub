"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { formatNumber, timeAgo } from "@/components/explorer-v2/format";
import { GasFill } from "./bits";
import { useEvmData, LIVE_REFRESH_MS } from "./hooks";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { BlockListResponse } from "@/lib/evm-explorer";

const PAGE = 25;
const MAX = 100;

export function EvmBlocksList({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const [limit, setLimit] = useState(PAGE);
  const { data, loading } = useEvmData<BlockListResponse>(c.chainId, "blocks", { limit }, { refreshMs: LIVE_REFRESH_MS });
  const blocks = data?.blocks ?? [];

  return (
    <EvmShell network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Blocks" />
        <Board className={cn(loading && blocks.length > 0 && "opacity-60 transition-opacity")}>
          <div className="hidden grid-cols-[1fr_0.7fr_1fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Block</span>
            <span className="text-right">Txns</span>
            <span className="text-right">Gas Used</span>
            <span className="text-right">Age</span>
          </div>
          {blocks.map((b) => (
            <Link
              key={b.number}
              href={`${base}/block/${b.number}`}
              className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1fr_0.7fr_1fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
            >
              <span className={`font-mono text-[13px] tabular-nums ${idInk}`}>
                #{formatNumber(b.number)}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Txns</CellLabel>
                {formatNumber(b.txCount)}
              </span>
              <span className="md:justify-self-end">
                <CellLabel>Gas Used</CellLabel>
                <GasFill used={b.gasUsed} limit={b.gasLimit} />
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                {timeAgo(b.timestamp)}
              </span>
            </Link>
          ))}
          {loading && blocks.length === 0 && (
            <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>
          )}
          {!loading && blocks.length === 0 && (
            <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no blocks</div>
          )}
        </Board>
        {!loading && blocks.length >= limit && limit < MAX && (
          <button
            onClick={() => setLimit((l) => Math.min(l + PAGE, MAX))}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more
          </button>
        )}
      </section>
    </EvmShell>
  );
}
