"use client";

// C-chain "Atomic Transactions" pages. Atomic Import/Export txs are NOT EVM
// txs (they ride in blockExtraData with CB58 ids, invisible to eth_*), so
// they get their own list + detail surface, with cross-chain lineage links
// resolved from the ledger-backed API (claimedBy / origin).

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { crossChainTxUrl } from "@/lib/crosschain-links";
import { Board, SectionHeader, TxTypePill, idInk, HEAD, ROW, LoadMore, Tabs, EmptyRow, RowSkeleton, HashChip, SpecLine, SpecSheet, StatCell, StatStrip, SubjectHeadline, FIG, UNIT } from "@/components/explorer-v2/ui";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { formatNumber, formatTime, timeAgo, truncate as truncFmt, ageShort } from "@/components/explorer-v2/format";
import { FundFlowDiagram, NoFundMovement, hasFundMovement } from "@/components/explorer-v2/pchain/FundFlowDiagram";
import { UtxoColumn } from "@/components/explorer-v2/pchain/PchainTx";
import type { AssetAmount, Utxo } from "@/lib/pchain-explorer";

function useAtomic<T>(path: string | null): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!path) return;
    const c = new AbortController();
    fetch(path, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => c.abort();
  }, [path]);
  return data;
}

const trunc = (s: string, n = 16) => (s.length <= n ? s : `${s.slice(0, n)}…`);
/** nAVAX → AVAX with the ledger's precision: two places when it is money, four when small, a floor for dust */
function avaxAmount(nano: string): string {
  const v = Number(nano) / 1e9;
  if (v === 0) return "0";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 0.0001) return v.toFixed(4);
  return "<0.0001";
}
const sumNano = (amounts: string[]) => amounts.reduce((a, b) => String(BigInt(a) + BigInt(b)), "0");
/** the lane a transfer travels: source → destination, the C-Chain named as itself */
function lane(t: { txType: string; sourceChain?: string; destinationChain?: string }): { from: string; to: string } {
  return t.txType === "ImportTx" ? { from: chainName(t.sourceChain), to: "C-Chain" } : { from: "C-Chain", to: chainName(t.destinationChain) };
}


interface AtomicTxRow {
  txHash: string; txType: string; blockNumber: number; timestamp: number;
  sourceChain?: string; destinationChain?: string;
  evmAddresses: string[]; amounts: string[]; assetIds: string[];
}
interface LineageHop { chain: string; txHash: string; timestamp: number; blockNumber: number }

export function AtomicTxsList({ network, chainSlug, address }: { network: string; chainSlug: string; address?: string }) {
  const [pages, setPages] = useState<AtomicTxRow[][]>([]);
  const [before, setBefore] = useState<string>("");
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const path = `/api/catomic/${network}/atomic-txs?limit=25${address ? `&address=${address}` : ""}${before ? `&before=${before}` : ""}`;
  const page = useAtomic<{ atomicTransactions: AtomicTxRow[]; nextBefore?: number }>(path);
  useEffect(() => {
    if (!page) return;
    setPages((p) => [...p, page.atomicTransactions]);
    setLoadingMore(false);
    if (!page.nextBefore) setDone(true);
  }, [page]);
  const rows = pages.flat();
  const base = `/explorer/${network}/${chainSlug}`;
  return (
    <EvmShell network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Atomic Transactions"
          action={
            rows.length ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {done ? `${rows.length} loaded · end of history` : `${rows.length} loaded`}
              </span>
            ) : undefined
          }
        />
        <Board divide={false}>
          <div className={cn(HEAD, "md:grid-cols-[7.5rem_6rem_minmax(0,1fr)_minmax(0,10rem)_7rem_3.5rem]", "border-b border-zinc-200 dark:border-zinc-800")}>
            <span>Hash</span>
            <span>Type</span>
            <span>Lane</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Block</span>
            <span className="text-right">Age</span>
          </div>
          {rows.map((t) => {
            const l = lane(t);
            return (
              <Link key={t.txHash} href={`${base}/atomic-tx/${t.txHash}`} className={cn(ROW, "md:grid-cols-[7.5rem_6rem_minmax(0,1fr)_minmax(0,10rem)_7rem_3.5rem]", "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}>
                <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{truncFmt(t.txHash, 6)}</span>
                <span className="justify-self-start">
                  <TxTypePill type={t.txType} label={t.txType.replace(/Tx$/, "")} />
                </span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                  <span className={l.from === "C-Chain" ? "text-zinc-900 dark:text-zinc-50" : undefined}>{l.from}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">→</span>
                  <span className={l.to === "C-Chain" ? "text-zinc-900 dark:text-zinc-50" : undefined}>{l.to}</span>
                </span>
                <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                  {t.amounts.length ? (
                    <>
                      {avaxAmount(sumNano(t.amounts))} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                    </>
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-700">—</span>
                  )}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">#{formatNumber(t.blockNumber)}</span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">{ageShort(t.timestamp)}</span>
              </Link>
            );
          })}
          {rows.length === 0 && (page ? <EmptyRow>no atomic transactions</EmptyRow> : <RowSkeleton n={12} />)}
        </Board>
        {!done && rows.length > 0 && (
          <LoadMore
            onClick={() => {
              setLoadingMore(true);
              setBefore(String(page?.nextBefore ?? ""));
            }}
            disabled={loadingMore}
          />
        )}
        <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
          imports and exports between the C-Chain and the P-Chain or X-Chain. Not EVM transactions: they ride in block extra data and carry CB58 ids
        </p>
      </section>
    </EvmShell>
  );
}

function chainName(c?: string): string {
  if (!c) return "?";
  // API returns blockchain ids; map the well-known ones for display.
  const m: Record<string, string> = {
    "11111111111111111111111111111111LpoYY": "P-Chain",
    "2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM": "X-Chain",
    "2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm": "X-Chain",
  };
  return m[c] ?? trunc(c, 10);
}

export function AtomicTxDetail({ network, chainSlug, txHash }: { network: string; chainSlug: string; txHash: string }) {
  const base = `/explorer/${network}/${chainSlug}`;
  const [flowView, setFlowView] = useState<"diagram" | "table">("diagram");
  const d = useAtomic<{
    tx: AtomicTxRow;
    exportedUtxos?: { utxoId: string; assetId: string; amount: string; addresses: string[]; claimedBy?: LineageHop }[];
    importedUtxos?: { utxoId: string; assetId?: string; amount?: string; addresses?: string[]; origin?: LineageHop }[];
  }>(`/api/catomic/${network}/atomic-tx/${txHash}`);
  if (!d) {
    return (
      <EvmShell network={network}>
        <Board divide={false}>
          <RowSkeleton n={6} />
        </Board>
      </EvmShell>
    );
  }
  const t = d.tx;
  const isImport = t.txType === "ImportTx";
  const AVAX: Omit<AssetAmount, "amount"> = {
    assetId: "FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z",
    name: "Avalanche",
    symbol: "AVAX",
    denomination: 9,
  };
  const pseudoUtxo = (
    txId: string,
    idx: number,
    amount: string,
    addresses: string[],
    kind: string,
    claim?: LineageHop,
  ): Utxo => ({
    addresses,
    utxoId: `${txId}:${idx}`,
    txHash: txId,
    outputIndex: idx,
    blockTimestamp: t.timestamp,
    blockNumber: String(t.blockNumber),
    consumingTxHash: claim?.txHash,
    consumingBlockTimestamp: claim?.timestamp,
    consumingBlockNumber: claim ? String(claim.blockNumber) : undefined,
    assetId: AVAX.assetId,
    asset: { ...AVAX, amount },
    utxoType: kind,
    amount,
    platformLocktime: 0,
    threshold: 1,
    createdOnChainId: kind === "IMPORTED" ? (t.sourceChain ?? "") : "",
    consumedOnChainId: claim?.chain ?? "",
    staked: false,
  });
  // ImportTx: consumed = shared-memory UTXOs (source-chain detail from the
  // ledgers), emitted = EVM credits. ExportTx: consumed = EVM debits,
  // emitted = the exported UTXOs (with their claim lineage).
  const consumed: Utxo[] = isImport
    ? (d.importedUtxos ?? []).map((u, i) =>
        pseudoUtxo(u.utxoId.split(":")[0], Number(u.utxoId.split(":")[1] ?? i), u.amount ?? "0", u.addresses ?? [], "IMPORTED", undefined),
      )
    : t.evmAddresses.map((a, i) => pseudoUtxo(t.txHash, i, t.amounts[i] ?? "0", [a], "EVM DEBIT"));
  const emitted: Utxo[] = isImport
    ? t.evmAddresses.map((a, i) => pseudoUtxo(t.txHash, i, t.amounts[i] ?? "0", [a], "EVM CREDIT"))
    : (d.exportedUtxos ?? []).map((u, i) =>
        pseudoUtxo(t.txHash, i, u.amount, u.addresses, "EXPORTED", u.claimedBy),
      );

  const l = lane(t);
  const total = sumNano(t.amounts);

  return (
    <EvmShell network={network}>
    <div className="flex flex-col gap-10">
      {/* the tx page's grammar: the subject and its time, the readings, the identifiers */}
      <section className="flex flex-col gap-5">
        <SectionHeader label="Atomic Transaction" action={<TxTypePill type={t.txType} label={t.txType.replace(/Tx$/, "")} />} />
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <SubjectHeadline value={t.txHash} copyLabel="Copy transaction id" />
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {formatTime(t.timestamp)}
            <span className="text-zinc-400 dark:text-zinc-500"> · {timeAgo(t.timestamp)}</span>
          </span>
        </div>
        <StatStrip cols={4}>
          <StatCell label="Amount" even>
            <span className={FIG}>
              {avaxAmount(total)} <span className={UNIT}>AVAX</span>
            </span>
          </StatCell>
          <StatCell label="Lane" even sub={isImport ? "imported into the C-Chain" : "exported from the C-Chain"}>
            <span className={FIG}>
              {l.from} <span className={UNIT}>→</span> {l.to}
            </span>
          </StatCell>
          <StatCell label="Block" href={`${base}/block/${t.blockNumber}`} even>
            <span className={FIG}>#{formatNumber(t.blockNumber)}</span>
          </StatCell>
          <StatCell label={isImport ? "Inputs" : "Outputs"} even sub={isImport ? "shared-memory UTXOs consumed" : "UTXOs exported"}>
            <span className={FIG}>{isImport ? (d.importedUtxos ?? []).length : (d.exportedUtxos ?? []).length}</span>
          </StatCell>
        </StatStrip>
        <Board divide={false} className="px-5 md:px-6">
          <SpecSheet>
            <SpecLine label="Type">{t.txType}</SpecLine>
            <SpecLine label={isImport ? "Source Chain" : "Destination Chain"}>
              <span className="inline-flex flex-wrap items-baseline gap-x-3">
                {chainName(isImport ? t.sourceChain : t.destinationChain)}
                <span className="font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500">{isImport ? t.sourceChain : t.destinationChain}</span>
              </span>
            </SpecLine>
            <SpecLine label={isImport ? "Credited" : "Debited"} align="start">
              <span className="flex flex-col gap-1">
                {t.evmAddresses.map((a, i) => (
                  <span key={a + i} className="inline-flex flex-wrap items-baseline gap-x-3">
                    <HashChip value={a} href={`${base}/address/${a}`} len={66} />
                    <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{avaxAmount(t.amounts[i] ?? "0")} AVAX</span>
                  </span>
                ))}
              </span>
            </SpecLine>
          </SpecSheet>
        </Board>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Fund Flow"
          action={
            <Tabs tabs={["diagram", "table"] as const} active={flowView} onChange={setFlowView} labels={{ diagram: "Diagram", table: "Table" }} />
          }
        />
        {!hasFundMovement({
          consumed,
          emitted,
          burned: [],
          sourceChain: t.sourceChain,
          destinationChain: t.destinationChain,
        }) ? (
          <Board divide={false} className="px-5 py-6 md:px-6">
            <NoFundMovement txType={t.txType} />
          </Board>
        ) : flowView === "diagram" ? (
          <Board divide={false} className="px-5 py-6 md:px-6">
            <FundFlowDiagram
              consumed={consumed}
              emitted={emitted}
              burned={[]}
              txType={t.txType}
              base={base}
              sourceChain={t.sourceChain}
              destinationChain={t.destinationChain}
            />
          </Board>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <UtxoColumn base={base} title={`Consumed · ${consumed.length}`} utxos={consumed} side="in" />
            <UtxoColumn base={base} title={`Emitted · ${emitted.length}`} utxos={emitted} side="out" />
          </div>
        )}
      </section>

      {(emitted.some((u) => u.consumingTxHash) || (d.importedUtxos ?? []).some((u) => u.origin)) && (
        <section className="flex flex-col gap-4">
          <SectionHeader label="Cross-Chain Lineage" />
          <Board>
            {(d.exportedUtxos ?? [])
              .filter((u) => u.claimedBy)
              .map((u) => (
                <div key={u.utxoId} className={cn(ROW, "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")}>
                  <span className="min-w-0 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400" title={u.utxoId}>{truncFmt(u.utxoId, 12)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">claimed on {u.claimedBy!.chain}</span>
                  <HashChip value={u.claimedBy!.txHash} href={crossChainTxUrl(network, u.claimedBy!.chain, u.claimedBy!.txHash) ?? "#"} len={12} />
                </div>
              ))}
            {(d.importedUtxos ?? [])
              .filter((u) => u.origin)
              .map((u) => (
                <div key={u.utxoId} className={cn(ROW, "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")}>
                  <span className="min-w-0 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400" title={u.utxoId}>{truncFmt(u.utxoId, 12)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">exported from {u.origin!.chain}</span>
                  <HashChip value={u.origin!.txHash} href={crossChainTxUrl(network, u.origin!.chain, u.origin!.txHash) ?? "#"} len={12} />
                </div>
              ))}
          </Board>
        </section>
      )}
    </div>
    </EvmShell>
  );
}
