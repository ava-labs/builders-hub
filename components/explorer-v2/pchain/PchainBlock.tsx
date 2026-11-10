"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, DetailSkeleton, EmptyRow, HEAD, HashChip, ROW, RowDoor, SectionHeader, SpecLine, SpecSheet, SubjectHeadline, TxTypePill, idInk } from "@/components/explorer-v2/ui";
import { formatBytes, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { NotFound, RailRow } from "@/components/explorer-v2/detail-parts";
import { usePolledJson } from "@/components/explorer-v2/page-data";
import { blockTypeLabel, pchainApiPath, txTypeLabel, type Block, type BlocksList, type BlockTx } from "@/lib/pchain-explorer";
import { usePchainData } from "./hooks";
import { STORY, STORY_LINK } from "./tx-story";

/* One P-Chain block in the C-Chain block page's grammar: previous and
   next in the header, the height as the subject with its time beside it,
   then the split. Left: one sentence saying what the block did, then its
   identifiers. Right: the readings (final, kind, txs, size). Its txs in
   a headed table below. The P-Chain's own turn: a proposal block holds
   one tx for the validators to decide on, and the block after it commits
   or aborts it, so the sentence reads the neighbor that completes it. */

/** what a tx's commit or abort does: a reward tx pays or forfeits; any other tx takes effect or does not */
function outcome(tx: BlockTx | undefined, kind: "Commit" | "Abort"): string {
  if (tx?.txType.startsWith("Reward")) return kind === "Commit" ? "pays the stake's reward" : "pays no reward";
  return kind === "Commit" ? "takes effect" : "does not take effect";
}

/** "2 Add Delegator, 1 Import": a block's txs by type, in block order */
function typeList(txs: BlockTx[]): string {
  const counts = new Map<string, number>();
  for (const t of txs) counts.set(txTypeLabel(t.txType), (counts.get(txTypeLabel(t.txType)) ?? 0) + 1);
  return [...counts].map(([label, n]) => `${n} ${label}`).join(", ");
}

export function PchainBlock({ chain, network, id }: { chain: string; network: string; id: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: b, loading, error } = usePchainData<Block>(network, `block/${id}`);
  const height = b ? Number(b.blockNumber) : null;
  const kind = b ? blockTypeLabel(b.blockType) : "";

  // the neighbor that completes the story, read once the block is on screen:
  // a proposal's decision is the block after it (a list read, which answers
  // without a 404 when that block is not in yet); a decision's proposal is the block before
  const decision = usePolledJson<BlocksList>(kind === "Proposal" && height !== null ? pchainApiPath(network, "blocks", { limit: 1, before: height + 2 }) : "");
  const proposal = usePolledJson<Block>((kind === "Commit" || kind === "Abort") && height !== null && height > 0 ? pchainApiPath(network, `block/${height - 1}`) : "");

  const blockLink = (n: number) => (
    <Link href={`${base}/block/${n}`} className={STORY_LINK}>
      #{formatNumber(n)}
    </Link>
  );
  const txLink = (t: BlockTx) => (
    <>
      the {txTypeLabel(t.txType)} tx{" "}
      <Link href={`${base}/tx/${t.txHash}`} className={STORY_LINK} title={t.txHash}>
        {truncate(t.txHash, 8)}
      </Link>
    </>
  );
  const proposer = b?.proposerNodeId ? (
    <Link href={`${base}/node/${b.proposerNodeId}`} className={STORY_LINK} title={b.proposerNodeId}>
      {truncate(b.proposerNodeId, 13)}
    </Link>
  ) : null;

  const sentence = (() => {
    if (!b || height === null) return null;
    if (kind === "Proposal") {
      const tx = b.transactions[0];
      const next = decision.data?.blocks?.[0];
      const decided = next && next.blockNumber === height + 1 ? (blockTypeLabel(next.blockType) as "Commit" | "Abort") : null;
      return (
        <>
          {proposer ?? "This block"} proposed {tx ? txLink(tx) : "a tx"} for the validators to decide on.{" "}
          {decided === "Commit" || decided === "Abort" ? (
            <>
              Block {blockLink(height + 1)} {decided === "Commit" ? "committed" : "aborted"} it, so it {outcome(tx, decided)}.
            </>
          ) : (
            <>The block after it commits or aborts it.</>
          )}
        </>
      );
    }
    if (kind === "Commit" || kind === "Abort") {
      const tx = proposal.data?.transactions?.[0];
      return (
        <>
          This block {kind === "Commit" ? "commits" : "aborts"} the proposal of block {blockLink(height - 1)}
          {tx ? (
            <>
              : {txLink(tx)} {outcome(tx, kind)}.
            </>
          ) : (
            "."
          )}
        </>
      );
    }
    const n = b.transactions.length;
    if (!n) return <>{proposer ?? "This block"} holds no transactions.</>;
    return (
      <>
        {proposer ? <>{proposer} proposed this block with</> : <>This block holds</>} {n === 1 ? txLink(b.transactions[0]) : `${n} txs: ${typeList(b.transactions)}`}.
      </>
    );
  })();

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Block" />}
      {error && <NotFound label="Block not found" id={id} />}
      {b && height !== null && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader
              label="Block"
              action={
                <span className="flex shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {height > 0 && (
                    <Link href={`${base}/block/${height - 1}`} className="transition-colors hover:text-[#E6212F]">
                      ← #{formatNumber(height - 1)}
                    </Link>
                  )}
                  <Link href={`${base}/block/${height + 1}`} className="transition-colors hover:text-[#E6212F]">
                    #{formatNumber(height + 1)} →
                  </Link>
                </span>
              }
            />

            {/* the subject, and when it happened, on one baseline */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
              <SubjectHeadline value={b.blockNumber} display={`#${formatNumber(height)}`} copyLabel="Copy block number" />
              <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatTime(b.timestamp)}
                <span className="text-zinc-400 dark:text-zinc-500"> · {timeAgo(b.timestamp)}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="flex min-w-0 flex-col gap-6">
                <Board divide={false}>
                  <p className={STORY}>{sentence}</p>
                </Board>
                <Board divide={false} className="px-5 md:px-6">
                  <SpecSheet>
                    <SpecLine label="Hash">
                      <HashChip value={b.blockHash} len={66} />
                    </SpecLine>
                    <SpecLine label="Parent">
                      <HashChip value={b.parentHash} href={height > 0 ? `${base}/block/${height - 1}` : undefined} len={66} />
                    </SpecLine>
                    {b.proposerNodeId && (
                      <SpecLine label="Proposer">
                        <HashChip value={b.proposerNodeId} href={`${base}/node/${b.proposerNodeId}`} len={66} />
                      </SpecLine>
                    )}
                    {b.proposerPChainHeight !== undefined && b.proposerPChainHeight > 0 && (
                      <SpecLine label="Proposer P-Chain Height">
                        <Link href={`${base}/block/${b.proposerPChainHeight}`} className={cn("font-mono hover:text-[#E6212F]", idInk)}>
                          #{formatNumber(b.proposerPChainHeight)}
                        </Link>
                        <span className="ml-3 font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500">the validator set this block was proposed under</span>
                      </SpecLine>
                    )}
                    <SpecLine label="Timestamp">
                      <span className="font-mono tabular-nums">{b.timestamp}</span>
                      <span className="ml-3 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">unix seconds</span>
                    </SpecLine>
                  </SpecSheet>
                </Board>
              </div>

              {/* the readings: a block is final the moment it is accepted */}
              <Board divide={false} className="flex flex-col border">
                <RailRow label="Status">Final</RailRow>
                <RailRow label="Type" sub={b.blockType}>
                  {kind}
                </RailRow>
                <RailRow label="Transactions" href={b.transactions.length > 0 ? "#transactions" : undefined}>
                  {formatNumber(b.txCount)}
                </RailRow>
                <RailRow label="Size">{formatBytes(b.blockSizeBytes)}</RailRow>
              </Board>
            </div>
          </section>

          <section id="transactions" className="flex flex-col gap-4">
            <SectionHeader label={`Transactions · ${b.transactions.length}`} />
            <Board divide={false}>
              <div className={cn(HEAD, "md:grid-cols-[minmax(0,1fr)_14rem] border-b border-zinc-200 dark:border-zinc-800")}>
                <span>Hash</span>
                <span>Type</span>
              </div>
              {b.transactions.length === 0 && <EmptyRow>no transactions</EmptyRow>}
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {b.transactions.map((t) => (
                  <RowDoor key={t.txHash} href={`${base}/tx/${t.txHash}`} className={cn(ROW, "md:grid-cols-[minmax(0,1fr)_14rem]")}>
                    <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{t.txHash}</span>
                    <span className="flex min-w-0 max-md:justify-end">
                      <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />
                    </span>
                  </RowDoor>
                ))}
              </div>
            </Board>
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}
