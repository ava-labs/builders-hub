"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, ROW, RowSkeleton, SectionHeader, Tabs } from "@/components/explorer-v2/ui";
import { usePolledJson } from "@/components/explorer-v2/page-data";
import { evmApiPath, type BlockListResponse } from "@/lib/evm-explorer";
import type { BlockSummary } from "@/lib/pchain-explorer";
import type { ProposedBlocksPage } from "@/app/api/pchain-proposed/[network]/[nodeId]/route";
import { EvmBlockCells, EvmBlockHead, BurnCell, evmBlockCols } from "@/components/explorer-v2/evm/block-rows";
import { useBlockBurns } from "@/components/explorer-v2/evm/useBlockBurns";
import { BURN_CHAINS } from "@/lib/evm-burn";
import { ViewAll } from "@/components/explorer-v2/evm/belt";
import { BlockHead, BlockLine, blockLayout } from "./boards";
import { LIVE_REFRESH_MS } from "./hooks";

/* The blocks a validator proposed: its C-Chain blocks in the EVM block
   table, its P-Chain blocks in the P-Chain one. The node page shows the
   newest of each; `node/{id}/blocks` pages through all of them. */

export type ProposedChain = "c-chain" | "p-chain";
const PROPOSED_CHAINS: ProposedChain[] = ["c-chain", "p-chain"];
const LABEL: Record<ProposedChain, string> = { "c-chain": "C-Chain", "p-chain": "P-Chain" };

const CCHAIN_ID: Record<string, number> = { mainnet: 43114, fuji: 43113 };
const RECENT = 10;
const PAGE = 25;

type Cursor = string | number | undefined;

interface ProposedRows {
  cchain: BlockListResponse["blocks"];
  pchain: BlockSummary[];
  next: Cursor;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function useProposed(network: string, nodeId: string, chain: ProposedChain, limit: number, cursor: Cursor, live: boolean): ProposedRows {
  const opts = live ? { refreshMs: LIVE_REFRESH_MS } : undefined;
  const cid = CCHAIN_ID[network];
  const c = usePolledJson<BlockListResponse>(
    chain === "c-chain" && cid ? evmApiPath(cid, "blocks", { proposer: nodeId, limit, before: cursor }) : "",
    opts,
  );
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("pageToken", String(cursor));
  const p = usePolledJson<ProposedBlocksPage>(
    chain === "p-chain" ? `/api/pchain-proposed/${network}/${encodeURIComponent(nodeId)}?${qs}` : "",
    opts,
  );
  const r = chain === "c-chain" ? c : p;
  return {
    cchain: c.data?.blocks ?? [],
    pchain: p.data?.blocks ?? [],
    next: chain === "c-chain" ? c.data?.nextBefore : p.data?.nextPageToken,
    loading: r.loading && !r.data,
    error: r.data ? null : r.error,
    retry: r.retry,
  };
}

function CchainTable({ rows, network }: { rows: BlockListResponse["blocks"]; network: string }) {
  const cid = CCHAIN_ID[network];
  const showBurn = BURN_CHAINS.has(String(cid));
  const burnOf = useBlockBurns(showBurn ? cid : undefined, rows.map((b) => b.number));
  const cols = evmBlockCols({ root: false, burn: showBurn });
  return (
    <>
      <EvmBlockHead cols={cols} root={false} burn={showBurn} />
      {rows.map((b) => (
        <Link key={b.number} href={`/explorer/${network}/c-chain/block/${b.number}`} className={cn(ROW, cols)}>
          <EvmBlockCells
            b={{ ...b, timestampMs: b.timestamp * 1000 }}
            burn={showBurn && <BurnCell wei={burnOf(b.number)} sym="AVAX" />}
          />
        </Link>
      ))}
    </>
  );
}

function PchainTable({ rows, network, full }: { rows: BlockSummary[]; network: string; full: boolean }) {
  // every row is this node's: the layout without a proposer column
  const set = blockLayout([], full);
  return (
    <>
      <BlockHead {...set} />
      {rows.map((b) => (
        <BlockLine key={b.blockNumber} b={b} base={`/explorer/${network}/p-chain`} layout={set} />
      ))}
    </>
  );
}

function ProposedBody({ r, chain, network, full, n }: { r: ProposedRows; chain: ProposedChain; network: string; full: boolean; n: number }) {
  if (r.loading) return <RowSkeleton n={n} />;
  if (r.error)
    return (
      <EmptyRow>
        Couldn&apos;t load the blocks.{" "}
        <button onClick={r.retry} className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
          Retry
        </button>
      </EmptyRow>
    );
  if (chain === "c-chain") return r.cchain.length ? <CchainTable rows={r.cchain} network={network} /> : <EmptyRow>No C-Chain blocks proposed.</EmptyRow>;
  return r.pchain.length ? <PchainTable rows={r.pchain} network={network} full={full} /> : <EmptyRow>No P-Chain blocks proposed.</EmptyRow>;
}

function RecentProposed({ network, nodeId, chain }: { network: string; nodeId: string; chain: ProposedChain }) {
  const r = useProposed(network, nodeId, chain, RECENT, undefined, true);
  // a node with none on this chain, or a chain the indexer doesn't attribute, shows nothing
  if (!r.loading && !r.error && !(chain === "c-chain" ? r.cchain : r.pchain).length) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label={`Proposed ${LABEL[chain]} blocks`}
        action={<ViewAll href={`/explorer/${network}/p-chain/node/${encodeURIComponent(nodeId)}/blocks?chain=${chain}`} />}
      />
      <Board>
        <ProposedBody r={r} chain={chain} network={network} full={false} n={4} />
      </Board>
    </section>
  );
}

/** the node page's sections: the newest blocks it proposed on each chain */
export function NodeProposedBlocks({ network, nodeId }: { network: string; nodeId: string }) {
  return (
    <>
      {PROPOSED_CHAINS.map((c) => (
        <RecentProposed key={c} network={network} nodeId={nodeId} chain={c} />
      ))}
    </>
  );
}

const PAGER =
  "border border-zinc-200 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100";

function ProposedLedger({ network, nodeId, chain }: { network: string; nodeId: string; chain: ProposedChain }) {
  // the cursors of the pages walked so far: the last one is open
  const [stack, setStack] = useState<Cursor[]>([undefined]);
  const page = stack.length;
  const r = useProposed(network, nodeId, chain, PAGE, stack[page - 1], page === 1);
  return (
    <div className="flex flex-col gap-4">
      <Board>
        <ProposedBody r={r} chain={chain} network={network} full n={8} />
      </Board>
      <nav aria-label="Pages" className="flex items-center justify-center gap-3">
        <button className={PAGER} disabled={page === 1} onClick={() => setStack((s) => s.slice(0, -1))}>
          ← Newer
        </button>
        <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">Page {page}</span>
        <button className={PAGER} disabled={r.next === undefined || r.loading} onClick={() => setStack((s) => [...s, r.next])}>
          Older →
        </button>
      </nav>
    </div>
  );
}

/** `node/{id}/blocks`: every block the node proposed, a page at a time */
export function NodeBlocksBody({ network, nodeId, initial }: { network: string; nodeId: string; initial: ProposedChain }) {
  const [chain, setChain] = useState<ProposedChain>(initial);
  const select = (c: ProposedChain) => {
    setChain(c);
    window.history.replaceState(null, "", `?chain=${c}`);
  };
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <SectionHeader label="Blocks proposed" />
        <Link
          href={`/explorer/${network}/p-chain/node/${encodeURIComponent(nodeId)}`}
          className="break-all font-mono text-[13px] text-zinc-900 hover:text-[#E6212F] dark:text-zinc-100"
        >
          {nodeId}
        </Link>
      </div>
      <Tabs tabs={PROPOSED_CHAINS} active={chain} onChange={select} labels={LABEL} />
      {/* a tab or network switch starts the pages over */}
      <ProposedLedger key={`${network}:${chain}`} network={network} nodeId={nodeId} chain={chain} />
    </section>
  );
}
