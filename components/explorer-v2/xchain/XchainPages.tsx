"use client";

// X-chain explorer pages — the SAME experience as the P-chain pages: the
// shared explorer-v2 primitives (ExplorerShell, Board, StatCell, TxTypePill,
// FundFlowDiagram) over the /x-api surface via the /api/xchain proxy.
//
// One honest divergence, by design: DAG-era txs (pre-Cortina) carry
// timeSource "index-node" — the index node's acceptance time, NOT consensus
// time (none exists in a DAG). Those rows get an "indexed" badge so replay
// dates are never presented as chain truth.

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  BoardHeader,
  CellLabel,
  SectionHeader,
  StatCell,
  SubjectHeadline,
  TxTypePill,
  TypeFilterRail,
  idInk,
} from "@/components/explorer-v2/ui";
import { ageOrDate, formatNumber, formatUsd, timeAgo, truncate } from "@/components/explorer-v2/format";
import { BlockTape, BlockTapeSkeleton, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import { useAvaxUsd } from "@/components/explorer-v2/pchain/hooks";
import { FundFlowDiagram, NoFundMovement, hasFundMovement } from "@/components/explorer-v2/pchain/FundFlowDiagram";
import { UtxoColumn } from "@/components/explorer-v2/pchain/PchainTx";
import type { AssetAmount, Utxo } from "@/lib/pchain-explorer";
import { crossChainTxUrl } from "@/lib/crosschain-links";

const LIVE_REFRESH_MS = 12_000;

/** Same-origin fetch against the /api/xchain proxy, with the pchain hook's
 *  semantics: silent background refresh, last-good data kept on failure. */
function useXchain<T>(path: string | null, refreshMs?: number): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      fetch(path)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setData(d);
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    load();
    if (!refreshMs) return () => void (alive = false);
    const id = setInterval(() => document.visibilityState === "visible" && load(), refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [path, refreshMs]);
  return { data, loading };
}


interface XTxSummary {
  txHash: string;
  txType: string;
  era: string;
  blockNumber?: number;
  timestamp: number;
  timeSource: string;
}
interface LineageHop {
  chain: string;
  txHash: string;
  timestamp: number;
  blockNumber: number;
}
interface XUtxo {
  utxoId: string;
  txHash: string;
  outputIndex: number;
  assetId: string;
  symbol?: string;
  denomination: number;
  utxoType: string;
  amount: string;
  addresses: string[];
  locktime?: number;
  threshold?: number;
  claimedBy?: LineageHop;
  origin?: LineageHop;
}

/** DAG-era badge: this timestamp is the index node's acceptance time. */
function IndexedBadge({ src }: { src?: string }) {
  if (src !== "index-node") return null;
  return (
    <span
      className="border border-amber-400/50 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400"
      title="DAG-era transaction: index-node acceptance time, not consensus time"
    >
      indexed
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Overview — Chain Stats board + recent txs/blocks, the PchainHome
   grammar (bordered plate, fused title bar, uniform figure grid). */

const FIG =
  "min-w-0 whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50";

export function XchainHome({ network }: { network: string }) {
  const base = `/explorer/${network}/x-chain`;
  const { data: s } = useXchain<{ tipHeight: number; tipTimestamp: number; txCount: number; assetCount: number }>(
    `/api/xchain/${network}/stats`,
    LIVE_REFRESH_MS,
  );
  const { data: txs } = useXchain<{ transactions: XTxSummary[] }>(`/api/xchain/${network}/txs?limit=8`, LIVE_REFRESH_MS);
  const { data: blocks } = useXchain<{ blocks: { height: number; hash: string; timestamp: number; txCount: number }[] }>(
    `/api/xchain/${network}/blocks?limit=20`,
    LIVE_REFRESH_MS,
  );
  const tape = blocks?.blocks ?? [];
  const tapeBlocks: TapeBlock[] = tape.map((b) => ({
    key: String(b.height),
    number: formatNumber(b.height),
    txCount: b.txCount,
    ago: timeAgo(b.timestamp),
    href: `${base}/block/${b.height}`,
  }));
  const grid =
    "grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800";
  const cells: { label: string; href?: string; value: React.ReactNode }[] = [
    { label: "Tip height", href: `${base}/blocks`, value: <span className={FIG}>{s ? `#${formatNumber(s.tipHeight)}` : "—"}</span> },
    { label: "Transactions", href: `${base}/txs`, value: <span className={FIG}>{s ? formatNumber(s.txCount) : "—"}</span> },
    { label: "Assets", value: <span className={FIG}>{s ? formatNumber(s.assetCount) : "—"}</span> },
    { label: "Last block", value: <span className={FIG}>{s ? timeAgo(s.tipTimestamp) : "—"}</span> },
  ];
  return (
    <ExplorerShell chain="x-chain" network={network}>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          {!blocks && !tape.length ? <BlockTapeSkeleton /> : tapeBlocks.length > 0 && <BlockTape blocks={tapeBlocks} />}
        </div>
        <Board divide={false} className="border">
          <BoardHeader label="Chain Stats" display />
          <div className={grid}>
            {cells.map((c) => (
              <StatCell key={c.label} label={c.label} href={c.href}>
                {c.value}
              </StatCell>
            ))}
          </div>
        </Board>

        <div className="grid gap-10 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-4">
            <SectionHeader
              label="Latest Blocks"
              action={
                <Link href={`${base}/blocks`} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
                  View all →
                </Link>
              }
            />
            <Board>
              {(blocks?.blocks ?? []).slice(0, 8).map((b) => (
                <Link
                  key={b.height}
                  href={`${base}/block/${b.height}`}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1fr_2fr_0.7fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className={`font-mono text-[12px] tabular-nums ${idInk}`}>#{formatNumber(b.height)}</span>
                  <span className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{truncate(b.hash, 16)}</span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {b.txCount} tx{b.txCount === 1 ? "" : "s"}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {timeAgo(b.timestamp)}
                  </span>
                </Link>
              ))}
              {!blocks && <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>}
            </Board>
          </section>
          <section className="flex min-w-0 flex-col gap-4">
            <SectionHeader
              label="Latest Transactions"
              action={
                <Link href={`${base}/txs`} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
                  View all →
                </Link>
              }
            />
            <Board>
              {(txs?.transactions ?? []).map((t) => (
                <Link
                  key={t.txHash}
                  href={`${base}/tx/${t.txHash}`}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncate(t.txHash, 16)}</span>
                  <span className="flex items-center gap-1.5 justify-self-start">
                    <TxTypePill type={t.txType} label={t.txType} />
                    <IndexedBadge src={t.timeSource} />
                  </span>
                  <span
                    title={ageOrDate(t.timestamp).title}
                    className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400"
                  >
                    {ageOrDate(t.timestamp).text}
                  </span>
                </Link>
              ))}
              {!txs && <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>}
            </Board>
          </section>
        </div>
      </div>
    </ExplorerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Transactions list — PchainTxsList's exact board + filter rail. */

const X_TYPE_OPTIONS = ["", "BaseTx", "ImportTx", "ExportTx", "CreateAssetTx", "OperationTx"].map((value) => ({
  value,
  label: value || "All types",
}));

export function XchainTxsList({ network }: { network: string }) {
  const base = `/explorer/${network}/x-chain`;
  const [type, setType] = useState("");
  const { data, loading } = useXchain<{ transactions: XTxSummary[]; nextCursor?: string }>(
    `/api/xchain/${network}/txs?limit=50`,
    LIVE_REFRESH_MS,
  );
  const [older, setOlder] = useState<XTxSummary[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pagedOut, setPagedOut] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const live = data?.transactions ?? [];
  const seen = new Set(live.map((t) => t.txHash));
  const all = [...live, ...older.filter((t) => !seen.has(t.txHash))];
  const txs = type ? all.filter((t) => t.txType === type) : all;
  const loadOlder = async () => {
    const c = cursor ?? data?.nextCursor;
    if (!c || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/xchain/${network}/txs?limit=50&cursor=${encodeURIComponent(c)}`);
      const page: { transactions: XTxSummary[]; nextCursor?: string } = res.ok ? await res.json() : { transactions: [] };
      if (page.transactions.length === 0 || !page.nextCursor) setPagedOut(true);
      setCursor(page.nextCursor);
      setOlder((o) => [...o, ...page.transactions]);
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <ExplorerShell chain="x-chain" network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Transactions" />
        <TypeFilterRail options={X_TYPE_OPTIONS} value={type} onChange={setType} />
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
              <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncate(t.txHash, 16)}</span>
              <span className="flex items-center gap-1.5 justify-self-start">
                <TxTypePill type={t.txType} label={t.txType} />
                <IndexedBadge src={t.timeSource} />
              </span>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Block</CellLabel>
                {t.era === "linear" ? `#${formatNumber(t.blockNumber ?? 0)}` : "DAG"}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                <span title={ageOrDate(t.timestamp).title}>{ageOrDate(t.timestamp).text}</span>
              </div>
            </Link>
          ))}
          {loading && txs.length === 0 && (
            <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>
          )}
          {!loading && txs.length === 0 && (
            <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no transactions</div>
          )}
        </Board>
        {txs.length > 0 && !pagedOut && (
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

/* ------------------------------------------------------------------ */
/* Blocks list — PchainBlocksList's board. */

export function XchainBlocksList({ network }: { network: string }) {
  const base = `/explorer/${network}/x-chain`;
  const { data, loading } = useXchain<{ blocks: { height: number; hash: string; timestamp: number; txCount: number }[]; nextBefore?: number }>(
    `/api/xchain/${network}/blocks?limit=50`,
    LIVE_REFRESH_MS,
  );
  const [older, setOlder] = useState<{ height: number; hash: string; timestamp: number; txCount: number }[]>([]);
  const [pagedOut, setPagedOut] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const live = data?.blocks ?? [];
  const seen = new Set(live.map((b) => b.height));
  const blocks = [...live, ...older.filter((b) => !seen.has(b.height))];
  const loadOlder = async () => {
    const last = blocks[blocks.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/xchain/${network}/blocks?limit=50&before=${last.height}`);
      const page: { blocks: typeof blocks } = res.ok ? await res.json() : { blocks: [] };
      if (page.blocks.length === 0) setPagedOut(true);
      setOlder((o) => [...o, ...page.blocks]);
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <ExplorerShell chain="x-chain" network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Blocks" />
        <Board className={cn(loading && blocks.length > 0 && "opacity-60 transition-opacity")}>
          <div className="hidden grid-cols-[1fr_2fr_0.8fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Height</span>
            <span>Hash</span>
            <span className="text-right">Txs</span>
            <span className="text-right">Age</span>
          </div>
          {blocks.map((b) => (
            <Link
              key={b.height}
              href={`${base}/block/${b.height}`}
              className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1fr_2fr_0.8fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
            >
              <span className={`font-mono text-[12px] tabular-nums ${idInk}`}>#{formatNumber(b.height)}</span>
              <span className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{truncate(b.hash, 22)}</span>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Txs</CellLabel>
                {b.txCount}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                {timeAgo(b.timestamp)}
              </div>
            </Link>
          ))}
          {loading && blocks.length === 0 && (
            <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>
          )}
        </Board>
        {blocks.length > 0 && !pagedOut && (
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

/* ------------------------------------------------------------------ */
/* Tx detail — the PchainTx experience: meta board + FundFlowDiagram
   (the SAME component) + cross-chain lineage links. */

function toPchainUtxo(u: XUtxo, thisTxHash: string, ts: number): Utxo {
  const asset: AssetAmount = {
    assetId: u.assetId,
    name: u.symbol ?? "",
    symbol: u.symbol ?? truncate(u.assetId, 8),
    denomination: u.denomination ?? 0,
    amount: u.amount,
  };
  return {
    addresses: u.addresses ?? [],
    utxoId: u.utxoId,
    txHash: u.txHash || thisTxHash,
    outputIndex: u.outputIndex,
    blockTimestamp: ts,
    blockNumber: "",
    consumingTxHash: u.claimedBy?.txHash,
    consumingBlockTimestamp: u.claimedBy?.timestamp,
    consumingBlockNumber: u.claimedBy ? String(u.claimedBy.blockNumber) : undefined,
    assetId: u.assetId,
    asset,
    utxoType: u.utxoType,
    amount: u.amount,
    platformLocktime: u.locktime ?? 0,
    threshold: u.threshold ?? 0,
    createdOnChainId: u.utxoType === "atomic-import" ? (u.origin?.chain ?? "") : "",
    consumedOnChainId: u.claimedBy?.chain ?? "",
    staked: false,
  };
}

export function XchainTx({ network, txHash }: { network: string; txHash: string }) {
  const base = `/explorer/${network}/x-chain`;
  const [flowView, setFlowView] = useState<"diagram" | "table">("diagram");
  const { data: tx, loading } = useXchain<{
    txHash: string;
    txType: string;
    era: string;
    timestamp: number;
    timeSource: string;
    blockNumber?: number;
    blockHash?: string;
    dagIndex?: number;
    sourceChain?: string;
    destinationChain?: string;
    memo?: string;
    assetCreated?: { name: string; symbol: string; denomination: number; assetId: string };
    emittedUtxos: XUtxo[];
    consumedUtxos: XUtxo[];
  }>(`/api/xchain/${network}/tx/${encodeURIComponent(txHash)}`);
  // Genesis assets are identified by a CreateAssetTx id
  // Probe the asset endpoint before declaring "not found"
  const { data: assetFallback } = useXchain<{ assetId: string; name: string; symbol: string }>(
    !loading && !tx ? `/api/xchain/${network}/asset/${encodeURIComponent(txHash)}` : null,
  );
  if (loading || !tx) {
    return (
      <ExplorerShell chain="x-chain" network={network}>
        <Board divide={false} className="px-6 py-16 text-center">
          {assetFallback ? (
            <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
              This ID is the X-chain asset {assetFallback.name} ({assetFallback.symbol}) — created at genesis, so no transaction page exists.{" "}
              <Link href={`/explorer/${network}/x-chain/asset/${txHash}`} className={idInk}>
                View asset →
              </Link>
            </span>
          ) : (
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{loading ? "Loading…" : "Transaction not found"}</span>
          )}
        </Board>
      </ExplorerShell>
    );
  }
  const consumed = tx.consumedUtxos.map((u) => toPchainUtxo(u, tx.txHash, tx.timestamp));
  const emitted = tx.emittedUtxos.map((u) => toPchainUtxo(u, tx.txHash, tx.timestamp));
  const metaRows: [string, React.ReactNode][] = [
    [
      "Type",
      <span key="t" className="flex items-center gap-2">
        <TxTypePill type={tx.txType} label={tx.txType} />
        <IndexedBadge src={tx.timeSource} />
      </span>,
    ],
    [
      "Timestamp",
      <span key="ts" className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
        {new Date(tx.timestamp * 1000).toUTCString()}
      </span>,
    ],
    tx.era === "linear"
      ? [
          "Block",
          <Link key="b" href={`${base}/block/${tx.blockNumber}`} className={`font-mono text-[12px] tabular-nums ${idInk}`}>
            #{formatNumber(tx.blockNumber ?? 0)}
          </Link>,
        ]
      : [
          "DAG position",
          <span key="d" className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
            #{formatNumber(tx.dagIndex ?? 0)} (pre-Cortina)
          </span>,
        ],
  ];
  if (tx.memo)
    metaRows.push([
      "Memo",
      <span key="m" className="break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        {tx.memo}
      </span>,
    ]);
  if (tx.assetCreated)
    metaRows.push([
      "Asset created",
      <span key="a" className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
        {tx.assetCreated.name} ({tx.assetCreated.symbol}) · denomination {tx.assetCreated.denomination}
      </span>,
    ]);

  // Cross-chain lineage rows (forward claims on exported outputs; backward
  // origins on atomic imports) — the drill-forward the flow diagram links.
  const claims = tx.emittedUtxos.filter((u) => u.claimedBy);
  const origins = tx.consumedUtxos.filter((u) => u.origin);

  return (
    <ExplorerShell chain="x-chain" network={network}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <SectionHeader label="Transaction" />
          <Board divide={false} className="border">
            <div className="flex flex-col gap-0 divide-y divide-zinc-200 dark:divide-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Hash</span>
                <span className={`break-all font-mono text-[13px] ${idInk}`}>{tx.txHash}</span>
              </div>
              {metaRows.map(([k, v]) => (
                <div key={k as string} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{k}</span>
                  {v}
                </div>
              ))}
            </div>
          </Board>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Fund Flow"
            action={
              <div className="flex border border-zinc-200 dark:border-zinc-800">
                {(["diagram", "table"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFlowView(v)}
                    className={cn(
                      "px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                      flowView === v
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            }
          />
          {!hasFundMovement({
            consumed,
            emitted,
            burned: [],
            sourceChain: tx.sourceChain,
            destinationChain: tx.destinationChain,
          }) ? (
            <Board divide={false} className="px-5 py-6 md:px-6">
              <NoFundMovement txType={tx.txType} />
            </Board>
          ) : flowView === "diagram" ? (
            <Board divide={false} className="px-5 py-6 md:px-6">
              <FundFlowDiagram
                consumed={consumed}
                emitted={emitted}
                burned={[]}
                txType={tx.txType}
                base={base}
                sourceChain={tx.sourceChain}
                destinationChain={tx.destinationChain}
              />
            </Board>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <UtxoColumn base={base} title={`Consumed · ${consumed.length}`} utxos={consumed} side="in" />
              <UtxoColumn base={base} title={`Emitted · ${emitted.length}`} utxos={emitted} side="out" />
            </div>
          )}
        </section>

        {(claims.length > 0 || origins.length > 0) && (
          <section className="flex flex-col gap-4">
            <SectionHeader label="Cross-Chain Lineage" />
            <Board>
              {claims.map((u) => (
                <div key={u.utxoId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    output #{u.outputIndex} · {truncate(u.utxoId, 18)}
                  </span>
                  <Link href={crossChainTxUrl(network, u.claimedBy!.chain, u.claimedBy!.txHash) ?? "#"} className={`font-mono text-[11px] ${idInk}`}>
                    claimed on {u.claimedBy!.chain} in {truncate(u.claimedBy!.txHash, 14)} →
                  </Link>
                </div>
              ))}
              {origins.map((u) => (
                <div key={u.utxoId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">input · {truncate(u.utxoId, 18)}</span>
                  <Link href={crossChainTxUrl(network, u.origin!.chain, u.origin!.txHash) ?? "#"} className={`font-mono text-[11px] ${idInk}`}>
                    ← exported from {u.origin!.chain} in {truncate(u.origin!.txHash, 14)}
                  </Link>
                </div>
              ))}
            </Board>
          </section>
        )}
      </div>
    </ExplorerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Address — balances board + tx list, the PchainAddress grammar. */

export function XchainAddress({ network, addr }: { network: string; addr: string }) {
  const base = `/explorer/${network}/x-chain`;
  const [utxoLimit, setUtxoLimit] = useState(25);
  const avaxUsd = useAvaxUsd(network === "mainnet");
  const { data: d, loading } = useXchain<{
    address: string;
    balances: { assetId: string; symbol?: string; denomination: number; balance: string; utxoCount: number }[];
    utxoCount: number;
    utxos: {
      utxoId: string; txHash: string; outputIndex: number; assetId: string; symbol?: string;
      denomination: number; amount: string; utxoKind: string; locktime?: number;
      blockNumber: number; blockTimestamp: number;
    }[];
    transactions: XTxSummary[];
  }>(`/api/xchain/${network}/address/${encodeURIComponent(addr)}`);
  if (loading || !d) {
    return (
      <ExplorerShell chain="x-chain" network={network}>
        <Board divide={false} className="px-6 py-16 text-center">
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{loading ? "Loading…" : "Address not found"}</span>
        </Board>
      </ExplorerShell>
    );
  }
  const fmtAmount = (amount: string, denom: number, symbol?: string) =>
    `${denom > 0 ? (Number(amount) / 10 ** denom).toLocaleString(undefined, { maximumFractionDigits: denom }) : amount} ${symbol ?? ""}`.trim();
  const avax = d.balances.find((b) => b.symbol === "AVAX" && b.assetId.startsWith("FvwEAhmxKfei"));

  return (
    <ExplorerShell chain="x-chain" network={network}>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <SectionHeader label="Address" />
          <SubjectHeadline value={d.address} copyLabel="Copy address" />
        </section>

        <section className="flex flex-col gap-4">
          {/* the PchainAddress MetricTable grammar: label left, figure right,
              the AVAX balance as the lead figure with its fiat line */}
          <Board divide={false}>
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                <tr>
                  <th scope="row" className="px-5 py-3.5 text-left align-baseline font-mono text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-500 md:px-6 dark:text-zinc-400">
                    Balance
                  </th>
                  <td className="px-5 py-3.5 text-right align-baseline md:px-6">
                    <span className="block font-mono text-lg font-bold tabular-nums tracking-tight text-zinc-900 md:text-xl dark:text-zinc-50">
                      {avax ? fmtAmount(avax.balance, avax.denomination, "AVAX") : "0 AVAX"}
                    </span>
                  </td>
                </tr>
                {formatUsd(avax?.balance, avaxUsd) && (
                  <tr>
                    <th scope="row" className="px-5 py-3.5 text-left align-baseline font-mono text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-500 md:px-6 dark:text-zinc-400">
                      In USD
                    </th>
                    <td className="px-5 py-3.5 text-right align-baseline md:px-6">
                      <span className="block font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatUsd(avax?.balance, avaxUsd)}
                      </span>
                      <span className="mt-1 block font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                        at ${avaxUsd?.toFixed(2)}/AVAX
                      </span>
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row" className="px-5 py-3.5 text-left align-baseline font-mono text-[11px] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-500 md:px-6 dark:text-zinc-400">
                    Unspent UTXOs
                  </th>
                  <td className="px-5 py-3.5 text-right align-baseline md:px-6">
                    <span className="block font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">{formatNumber(d.utxoCount)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Board>
        </section>

        {d.balances.filter((b) => b !== avax).length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeader label="Other assets" />
            <Board>
              {d.balances.filter((b) => b !== avax).map((b) => (
                <div key={b.assetId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <Link href={`${base}/asset/${b.assetId}`} className={`font-mono text-[12px] ${idInk}`}>
                    {b.symbol ?? truncate(b.assetId, 12)}
                  </Link>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      {fmtAmount(b.balance, b.denomination, b.symbol)}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      {b.utxoCount} utxo{b.utxoCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </Board>
          </section>
        )}

        <div className="grid gap-10 xl:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader label="Transactions" />
          <Board>
            {d.transactions.map((t) => (
              <Link
                key={t.txHash}
                href={`${base}/tx/${t.txHash}`}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_0.8fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
              >
                <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncate(t.txHash, 16)}</span>
                <span className="flex items-center gap-1.5 justify-self-start">
                  <TxTypePill type={t.txType} label={t.txType} />
                  <IndexedBadge src={t.timeSource} />
                </span>
                <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Block</CellLabel>
                  {t.era === "linear" ? `#${formatNumber(t.blockNumber ?? 0)}` : "DAG"}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Age</CellLabel>
                  <span title={ageOrDate(t.timestamp).title}>{ageOrDate(t.timestamp).text}</span>
                </div>
              </Link>
            ))}
            {d.transactions.length === 0 && (
              <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no transactions</div>
            )}
          </Board>
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader
            label={`Unspent UTXOs · ${formatNumber(d.utxoCount)}`}
            action={
              d.utxos.length > utxoLimit ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  showing {formatNumber(utxoLimit)} of {formatNumber(d.utxos.length)}
                </span>
              ) : undefined
            }
          />
          <Board>
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
              <span>Amount</span>
              <span>Kind</span>
              <span>Created in</span>
              <span className="text-right">Block</span>
            </div>
            {d.utxos.slice(0, utxoLimit).map((u, i) => (
              <div
                key={`${u.utxoId}-${i}`}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[1.4fr_1fr_1fr_0.8fr] md:items-center md:px-6"
              >
                <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                  {fmtAmount(u.amount, u.denomination, u.symbol)}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                  {u.utxoKind}
                </span>
                <Link href={`${base}/tx/${u.txHash}`} className={`truncate font-mono text-[11px] ${idInk}`}>
                  {truncate(u.txHash, 12)}
                </Link>
                {u.blockNumber > 0 ? (
                  <Link href={`${base}/block/${u.blockNumber}`} className={`font-mono text-[11px] tabular-nums md:text-right ${idInk}`}>
                    #{formatNumber(u.blockNumber)}
                  </Link>
                ) : (
                  <span className="font-mono text-[11px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">DAG</span>
                )}
              </div>
            ))}
            {d.utxos.length === 0 && (
              <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no unspent UTXOs</div>
            )}
            {d.utxos.length > utxoLimit && (
              <button
                type="button"
                onClick={() => setUtxoLimit((n) => n + 100)}
                className="w-full px-5 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-6 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                Show more
              </button>
            )}
          </Board>
        </section>
        </div>
      </div>
    </ExplorerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Block detail — meta board + the block's txs, the PchainBlock shape. */

export function XchainBlock({ network, height }: { network: string; height: string }) {
  const base = `/explorer/${network}/x-chain`;
  const { data: b, loading } = useXchain<{
    height: number;
    hash: string;
    parentHash: string;
    timestamp: number;
    txCount: number;
    transactions: XTxSummary[];
  }>(`/api/xchain/${network}/block/${encodeURIComponent(height)}`);
  if (loading || !b) {
    return (
      <ExplorerShell chain="x-chain" network={network}>
        <Board divide={false} className="px-6 py-16 text-center">
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{loading ? "Loading…" : "Block not found"}</span>
        </Board>
      </ExplorerShell>
    );
  }
  const rows: [string, React.ReactNode][] = [
    ["Height", <span key="h" className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">#{formatNumber(b.height)}</span>],
    ["Hash", <span key="hash" className={`break-all font-mono text-[12px] ${idInk}`}>{b.hash}</span>],
    [
      "Parent",
      b.height > 0 ? (
        <Link key="p" href={`${base}/block/${b.height - 1}`} className={`break-all font-mono text-[12px] ${idInk}`}>
          {b.parentHash}
        </Link>
      ) : (
        <span key="p" className="break-all font-mono text-[12px] text-zinc-500">{b.parentHash}</span>
      ),
    ],
    ["Timestamp", <span key="t" className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">{new Date(b.timestamp * 1000).toUTCString()}</span>],
  ];
  return (
    <ExplorerShell chain="x-chain" network={network}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <SectionHeader label="Block" />
          <Board divide={false} className="border">
            <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map(([k, v]) => (
                <div key={k as string} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{k}</span>
                  {v}
                </div>
              ))}
            </div>
          </Board>
        </section>
        <section className="flex flex-col gap-4">
          <SectionHeader label={`Transactions (${b.txCount})`} />
          <Board>
            {b.transactions.map((t) => (
              <Link
                key={t.txHash}
                href={`${base}/tx/${t.txHash}`}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
              >
                <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncate(t.txHash, 16)}</span>
                <span className="justify-self-start"><TxTypePill type={t.txType} label={t.txType} /></span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">{" "}<span title={ageOrDate(t.timestamp).title}>{ageOrDate(t.timestamp).text}</span></span>
              </Link>
            ))}
            {b.transactions.length === 0 && (
              <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no transactions</div>
            )}
          </Board>
        </section>
      </div>
    </ExplorerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Asset detail — registry row + lifetime figures. */

export function XchainAsset({ network, assetId }: { network: string; assetId: string }) {
  const { data: a, loading } = useXchain<{
    assetId: string; name: string; symbol: string; denomination: number;
    source: string; lifetimeHolders: number; lifetimeUtxos: number;
  }>(`/api/xchain/${network}/asset/${encodeURIComponent(assetId)}`);
  if (loading || !a) {
    return (
      <ExplorerShell chain="x-chain" network={network}>
        <Board divide={false} className="px-6 py-16 text-center">
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{loading ? "Loading…" : "Asset not found"}</span>
        </Board>
      </ExplorerShell>
    );
  }
  const rows: [string, string][] = [
    ["Name", a.name],
    ["Symbol", a.symbol],
    ["Denomination", String(a.denomination)],
    ["Origin", a.source === "rpc" ? "Genesis (no creating transaction)" : "CreateAssetTx"],
    ["Lifetime holders", formatNumber(a.lifetimeHolders)],
    ["Lifetime UTXOs", formatNumber(a.lifetimeUtxos)],
  ];
  return (
    <ExplorerShell chain="x-chain" network={network}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <SectionHeader label="Asset" />
          <SubjectHeadline value={a.assetId} copyLabel="Copy asset ID" />
        </section>
        <Board divide={false} className="border">
          <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{k}</span>
                <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">{v}</span>
              </div>
            ))}
          </div>
        </Board>
        {a.source !== "rpc" && (
          <Link href={`/explorer/${network}/x-chain/tx/${a.assetId}`} className={`font-mono text-[11px] ${idInk}`}>
            View creating transaction →
          </Link>
        )}
      </div>
    </ExplorerShell>
  );
}
