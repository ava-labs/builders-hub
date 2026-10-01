"use client";

import { useEffect, useRef, useState } from "react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, EmptyRow, LoadMore, RowSkeleton, SectionHeader, TypeFilterRail } from "@/components/explorer-v2/ui";
import { Belt, MotionRow } from "@/components/explorer-v2/evm/belt";
import { pchainApiPath, type BlocksList, type BlockSummary } from "@/lib/pchain-explorer";
import { LIVE_REFRESH_MS, usePchainData } from "./hooks";
import { BlockHead, BlockLine, blockLayout } from "./boards";

// The upstream /blocks endpoint has no type param (?type= is ignored), so
// the filter runs over the loaded window and "Load more" deepens it. A
// value matches a substring of blockType, so "Commit" catches the Banff
// and Apricot eras alike.
const BLOCK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Standard", label: "Standard" },
  { value: "Proposal", label: "Proposal" },
  { value: "Commit", label: "Commit" },
  { value: "Abort", label: "Abort" },
];
const PAGE = 25;

/** two windows of blocks as one, newest first, each block once */
function merged(a: BlockSummary[], b: BlockSummary[]): BlockSummary[] {
  const byHeight = new Map<number, BlockSummary>();
  for (const x of [...b, ...a]) byHeight.set(x.blockNumber, x);
  return [...byHeight.values()].sort((x, y) => y.blockNumber - x.blockNumber);
}

export function PchainBlocksList({ chain, network }: { chain: string; network: string }) {
  return (
    <ExplorerShell chain={chain} network={network}>
      {/* a network switch starts the ledger over */}
      <BlocksLedger key={network} network={network} base={`/explorer/${network}/${chain}`} />
    </ExplorerShell>
  );
}

function BlocksLedger({ network, base }: { network: string; base: string }) {
  // the newest page, polled; it opens from memory when a link warmed it
  const head = usePchainData<BlocksList>(network, "blocks", { limit: PAGE }, { refreshMs: LIVE_REFRESH_MS });
  // every block seen since the page opened: the polls' and the older pages'
  const [seen, setSeen] = useState<BlockSummary[]>([]);
  const [type, setType] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [done, setDone] = useState(false);
  // the top block when the pointer came over the ledger: newer ones wait above it
  const [heldAt, setHeldAt] = useState<number | null>(null);

  useEffect(() => {
    const fresh = head.data?.blocks;
    if (!fresh?.length) return;
    // a jump past a whole page (a hidden tab's pause) would leave a hole: start over from the newest page
    setSeen((prev) => (prev.length && fresh[fresh.length - 1].blockNumber > prev[0].blockNumber + 1 ? fresh : merged(fresh, prev)));
  }, [head.data]);

  const blocks = seen.length ? seen : (head.data?.blocks ?? []);
  // the rows it opens with stand still; a block that comes after them slides in
  const top = useRef<number | null>(null);
  if (top.current === null && blocks.length) top.current = blocks[0].blockNumber;

  const loadOlder = async () => {
    const last = blocks[blocks.length - 1];
    if (!last || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(pchainApiPath(network, "blocks", { limit: PAGE, before: last.blockNumber }));
      const data: BlocksList = res.ok ? await res.json() : { blocks: [] };
      const page = data.blocks ?? [];
      if (!page.length || !data.nextBefore) setDone(true);
      setSeen((prev) => merged(prev.length ? prev : blocks, page));
    } catch {
      setDone(true);
    } finally {
      setLoadingOlder(false);
    }
  };

  const visible = type ? blocks.filter((b) => b.blockType.includes(type)) : blocks;
  // the ledger holds still under the pointer so a row can be clicked; an
  // older page still lands beneath it
  const shown = heldAt === null ? visible : visible.filter((b) => b.blockNumber <= heldAt);
  const layout = blockLayout(shown, true);
  const activeLabel = BLOCK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";
  const clear = (
    <button
      onClick={() => setType("")}
      className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
    >
      Clear filter ✕
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Blocks" action={type ? clear : undefined} />
      <TypeFilterRail options={BLOCK_TYPE_OPTIONS} value={type} onChange={setType} />
      <Board divide={false} onMouseEnter={() => setHeldAt(blocks[0]?.blockNumber ?? null)} onMouseLeave={() => setHeldAt(null)}>
        <BlockHead {...layout} />
        {shown.length === 0 &&
          (head.loading ? (
            <RowSkeleton n={12} />
          ) : (
            <EmptyRow>
              {type ? `No ${activeLabel} blocks in the loaded range. Load more below.` : "no blocks"}
              {type && (
                <button
                  onClick={() => setType("")}
                  className="ml-3 uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                >
                  Show all
                </button>
              )}
            </EmptyRow>
          ))}
        <Belt rows={shown.length}>
          {shown.map((b) => (
            <MotionRow key={b.blockNumber} animateIn={top.current !== null && b.blockNumber > top.current}>
              <BlockLine b={b} base={base} layout={layout} />
            </MotionRow>
          ))}
        </Belt>
        {loadingOlder && <RowSkeleton n={3} />}
      </Board>
      {!done && blocks.length > 0 && <LoadMore onClick={loadOlder} disabled={loadingOlder} />}
    </section>
  );
}
