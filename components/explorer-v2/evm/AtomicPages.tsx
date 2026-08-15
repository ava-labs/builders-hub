"use client";

// C-chain "Atomic Transactions" pages. Atomic Import/Export txs are NOT EVM
// txs (they ride in blockExtraData with CB58 ids, invisible to eth_*), so
// they get their own list + detail surface, with cross-chain lineage links
// resolved from the ledger-backed API (claimedBy / origin).

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { crossChainTxUrl } from "@/lib/crosschain-links";
import { Board, SectionHeader, TxTypePill, idInk } from "@/components/explorer-v2/ui";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { ageOrDate, formatNumber, timeAgo, truncate as truncFmt } from "@/components/explorer-v2/format";
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

const mono = "font-mono text-[12px] text-zinc-900 dark:text-zinc-100";
const label = "font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500";
const link = "font-mono text-[12px] text-[#0061E2] underline-offset-2 hover:text-[#E6212F] hover:underline dark:text-[#5f9dff]";
const trunc = (s: string, n = 16) => (s.length <= n ? s : `${s.slice(0, n)}…`);
const navax = (v: string) => `${(Number(v) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 })} AVAX`;


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
      <SectionHeader label="Atomic Transactions" />
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Cross-chain imports and exports between the C-Chain and the P/X chains. These are not EVM
        transactions — they settle inside block extra data and carry Avalanche (CB58) ids.
      </p>
      <Board>
        <div className="hidden grid-cols-[2fr_1fr_1fr_0.8fr_0.7fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
          <span>Hash</span>
          <span>Type</span>
          <span>Counterpart</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Block</span>
          <span className="text-right">Age</span>
        </div>
        {rows.map((t) => (
          <Link
            key={t.txHash}
            href={`${base}/atomic-tx/${t.txHash}`}
            className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1fr_1fr_0.8fr_0.7fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
          >
            <span className={`truncate font-mono text-[12px] ${idInk}`}>{truncFmt(t.txHash, 18)}</span>
            <span className="justify-self-start"><TxTypePill type={t.txType} label={t.txType} /></span>
            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {t.txType === "ImportTx" ? `from ${chainName(t.sourceChain)}` : `to ${chainName(t.destinationChain)}`}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
              {t.amounts.length ? navax(t.amounts.reduce((a, b) => String(BigInt(a) + BigInt(b)), "0")) : "—"}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
              #{formatNumber(t.blockNumber)}
            </span>
            <span
              title={ageOrDate(t.timestamp).title}
              className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400"
            >
              {ageOrDate(t.timestamp).text}
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
            {page ? "no atomic transactions" : "Loading…"}
          </div>
        )}
      </Board>
      {!done && rows.length > 0 && (
        <button
          onClick={() => {
            setLoadingMore(true);
            setBefore(String(page?.nextBefore ?? ""));
          }}
          disabled={loadingMore}
          className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
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
        <Board divide={false} className="px-6 py-16 text-center">
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Loading…</span>
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

  const metaRows: [string, React.ReactNode][] = [
    ["Type", <TxTypePill key="t" type={t.txType} label={t.txType} />],
    [
      "Block",
      <Link key="b" href={`${base}/block/${t.blockNumber}`} className={`font-mono text-[12px] tabular-nums ${idInk}`}>
        #{formatNumber(t.blockNumber)}
      </Link>,
    ],
    [
      "Timestamp",
      <span key="ts" className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
        {new Date(t.timestamp * 1000).toUTCString()} · {ageOrDate(t.timestamp).text}
      </span>,
    ],
    [
      isImport ? "Source chain" : "Destination chain",
      <span key="c" className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
        {chainName(isImport ? t.sourceChain : t.destinationChain)}
      </span>,
    ],
  ];

  return (
    <EvmShell network={network}>
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeader label="Atomic Transaction" />
        <Board divide={false} className="border">
          <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Hash</span>
              <span className={`break-all font-mono text-[13px] ${idInk}`}>{t.txHash}</span>
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
          <div className="grid gap-6 lg:grid-cols-2">
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
                <div key={u.utxoId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{truncFmt(u.utxoId, 22)}</span>
                  <Link href={crossChainTxUrl(network, u.claimedBy!.chain, u.claimedBy!.txHash) ?? "#"} className={`font-mono text-[11px] ${idInk}`}>
                    claimed on {u.claimedBy!.chain} in {truncFmt(u.claimedBy!.txHash, 14)} →
                  </Link>
                </div>
              ))}
            {(d.importedUtxos ?? [])
              .filter((u) => u.origin)
              .map((u) => (
                <div key={u.utxoId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-6">
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{truncFmt(u.utxoId, 22)}</span>
                  <Link href={crossChainTxUrl(network, u.origin!.chain, u.origin!.txHash) ?? "#"} className={`font-mono text-[11px] ${idInk}`}>
                    ← exported from {u.origin!.chain} in {truncFmt(u.origin!.txHash, 14)}
                  </Link>
                </div>
              ))}
          </Board>
        </section>
      )}
    </div>
    </EvmShell>
  );
}
