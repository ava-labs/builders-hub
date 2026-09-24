"use client";

// C-chain "Atomic Transactions" pages. Atomic Import/Export txs are NOT EVM
// txs (they ride in blockExtraData with CB58 ids, invisible to eth_*), so
// they get their own list + detail surface, with cross-chain lineage links
// resolved from the ledger-backed API (claimedBy / origin).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { chainOfId, crossChainTxUrl } from "@/lib/crosschain-links";
import { Board, CellLabel, SectionHeader, TxTypePill, idInk, HEAD, ROW, INK, MUTED, LoadMore, Tabs, EmptyRow, RowDoor, RowSkeleton, HashChip, SpecLine, SpecSheet, StatCell, StatStrip, SubjectHeadline, FIG, UNIT } from "@/components/explorer-v2/ui";
import { Party } from "@/components/explorer-v2/evm/LiveBoards";
import { usePrice, usdOfWei } from "@/components/explorer-v2/evm/hooks";
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
/** the AVAX asset id on mainnet and on Fuji */
const AVAX_IDS = new Set(["FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z", "U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK"]);
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

/** The Transactions tab's two views on the C-Chain: the EVM receipts and
 *  the shared-memory transfers. Links, not buttons, so each view has a
 *  URL to share (txs, txs/atomic). */
export function TxsViewSwitch({ base, view }: { base: string; view: "evm" | "atomic" }) {
  const views = [
    { key: "evm", label: "EVM", title: "EVM transactions: calls, transfers, deployments", href: `${base}/txs` },
    { key: "atomic", label: "Atomic", title: "Atomic imports and exports with the P-Chain and X-Chain", href: `${base}/txs/atomic` },
  ] as const;
  return (
    // a div, not a nav: the global `nav a` rules would restyle the chips
    <div role="group" aria-label="Transaction view" className="flex shrink-0 items-center gap-1.5">
      {views.map((v) => (
        <Link
          key={v.key}
          href={v.href}
          title={v.title}
          aria-current={view === v.key ? "page" : undefined}
          className={cn(
            "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
            view === v.key
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

type Claim = LineageHop | null;

/** An export's claim state, read from its detail: the list feed carries no
 *  lineage. undefined while it loads, null while the UTXO sits unclaimed in
 *  shared memory. Imports need no lookup: the import IS the claim. */
function useClaims(network: string, rows: AtomicTxRow[]): Map<string, Claim> {
  const [claims, setClaims] = useState<Map<string, Claim>>(new Map());
  const asked = useRef(new Set<string>());
  const want = rows.filter((t) => t.txType === "ExportTx" && !asked.current.has(t.txHash)).map((t) => t.txHash);
  const key = want.join(",");
  useEffect(() => {
    if (!key) return;
    const hashes = key.split(",");
    hashes.forEach((h) => asked.current.add(h));
    for (const h of hashes) {
      fetch(`/api/catomic/${network}/atomic-tx/${h}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { exportedUtxos?: { claimedBy?: LineageHop }[] } | null) => {
          if (!d) return;
          const hop = (d.exportedUtxos ?? []).find((u) => u.claimedBy)?.claimedBy ?? null;
          setClaims((m) => new Map(m).set(h, hop));
        })
        .catch(() => {});
    }
  }, [network, key]);
  return claims;
}

/** "3m 32s": the crossing time between an export and its claim */
function span(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

/** where the transfer stands: an import is done on arrival; an export is
 *  done once the destination chain imports its UTXO */
function AtomicStatus({ t, claim }: { t: AtomicTxRow; claim: Claim | undefined }) {
  if (t.txType === "ImportTx") return <StatusMark tone="done" label="imported" />;
  if (claim === undefined) return <span className="h-3 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />;
  if (claim === null) return <StatusMark tone="open" label="in shared memory" title="exported, not yet imported on the destination chain" />;
  return <StatusMark tone="done" label={`claimed · ${span(claim.timestamp - t.timestamp)}`} title={`imported on ${claim.chain} ${span(claim.timestamp - t.timestamp)} after the export`} />;
}

function StatusMark({ tone, label, title }: { tone: "done" | "open"; label: string; title?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300" title={title}>
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0", tone === "done" ? "bg-zinc-900 dark:bg-zinc-100" : "border border-zinc-400 dark:border-zinc-500")}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

const isEvmAddress = (a?: string) => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

export function AtomicTxsList({ network, chainSlug, address }: { network: string; chainSlug: string; address?: string }) {
  const addr = isEvmAddress(address) ? address!.toLowerCase() : undefined;
  const [pages, setPages] = useState<AtomicTxRow[][]>([]);
  const [before, setBefore] = useState<string>("");
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const path = `/api/catomic/${network}/atomic-txs?limit=25${addr ? `&address=${addr}` : ""}${before ? `&before=${before}` : ""}`;
  const page = useAtomic<{ atomicTransactions: AtomicTxRow[]; nextBefore?: number }>(path);
  useEffect(() => {
    if (!page) return;
    setPages((p) => [...p, page.atomicTransactions]);
    setLoadingMore(false);
    if (!page.nextBefore) setDone(true);
  }, [page]);
  const rows = pages.flat();
  const base = `/explorer/${network}/${chainSlug}`;
  const claims = useClaims(network, rows);
  const { price } = usePrice(network === "fuji" ? 43113 : 43114);
  const usd = price?.price ?? null;

  // the loaded window's flow: what crossed in, what crossed out, the net
  const inflow = sumNano(rows.filter((t) => t.txType === "ImportTx").flatMap((t) => t.amounts));
  const outflow = sumNano(rows.filter((t) => t.txType === "ExportTx").flatMap((t) => t.amounts));
  const net = BigInt(inflow) - BigInt(outflow);
  const imports = rows.filter((t) => t.txType === "ImportTx").length;
  const oldest = rows.length ? rows[rows.length - 1].timestamp : 0;

  // the address takes what the fixed columns leave: at 1400px and up that
  // is room for the whole of it
  const cols = "md:grid-cols-[8rem_4.5rem_minmax(0,9.5rem)_minmax(0,1fr)_minmax(0,10rem)_minmax(0,9rem)_3rem]";

  return (
    <EvmShell network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Atomic Transactions" action={<TxsViewSwitch base={base} view="atomic" />} />
        <StatStrip cols={3}>
          <StatCell label="Into C-Chain" even sub={rows.length ? `${imports} imports` : undefined}>
            <span className={FIG}>
              {rows.length ? avaxAmount(inflow) : "—"} <span className={UNIT}>AVAX</span>
            </span>
          </StatCell>
          <StatCell label="Out of C-Chain" even sub={rows.length ? `${rows.length - imports} exports` : undefined}>
            <span className={FIG}>
              {rows.length ? avaxAmount(outflow) : "—"} <span className={UNIT}>AVAX</span>
            </span>
          </StatCell>
          <StatCell label="Net Flow" even sub={rows.length ? `across the ${rows.length} loaded · since ${timeAgo(oldest)}` : undefined}>
            <span className={FIG}>
              {rows.length ? `${net < BigInt(0) ? "−" : "+"}${avaxAmount((net < BigInt(0) ? -net : net).toString())}` : "—"}{" "}
              <span className={UNIT}>AVAX</span>
            </span>
          </StatCell>
        </StatStrip>
        {addr && (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Address</span>
            <HashChip value={addr} href={`${base}/address/${addr}`} len={66} />
            <Link href={`${base}/txs/atomic`} className="inline-flex items-center gap-1 text-zinc-400 hover:text-[#E6212F] dark:text-zinc-500">
              <X className="h-3 w-3" /> clear
            </Link>
          </div>
        )}
        <Board divide={false}>
          <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
            <span>Tx ID</span>
            <span>Direction</span>
            <span>Route</span>
            <span>C-Chain Address</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span className="text-right">Age</span>
          </div>
          {rows.map((t) => {
            const l = lane(t);
            const isImport = t.txType === "ImportTx";
            const total = sumNano(t.amounts);
            const dollars = usdOfWei(BigInt(total) * BigInt(1e9), usd);
            const who = t.evmAddresses[0];
            return (
              <RowDoor key={t.txHash} href={`${base}/atomic-tx/${t.txHash}`} className={cn(ROW, cols, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}>
                <Link href={`${base}/atomic-tx/${t.txHash}`} className={cn(INK, idInk, "truncate hover:text-[#E6212F]")} title={t.txHash} onClick={(e) => e.stopPropagation()}>
                  {truncFmt(t.txHash, 8)}
                </Link>
                <span className="justify-self-end md:justify-self-start">
                  <TxTypePill type={t.txType} label={isImport ? "Import" : "Export"} />
                </span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                  <span className={cn("shrink-0", l.from === "C-Chain" && "text-zinc-900 dark:text-zinc-50")}>{l.from}</span>
                  <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                  <span className={cn("shrink-0", l.to === "C-Chain" && "text-zinc-900 dark:text-zinc-50")}>{l.to}</span>
                </span>
                <span className="flex min-w-0 flex-col font-mono text-[12px] md:flex-row md:items-center">
                  <CellLabel>{isImport ? "Credited" : "Debited"}</CellLabel>
                  {who ? (
                    <Party addr={who} name={null} href={`${base}/address/${who}`} full />
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-700">—</span>
                  )}
                  {t.evmAddresses.length > 1 && (
                    <span className="ml-2 shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">+{t.evmAddresses.length - 1}</span>
                  )}
                </span>
                <span className="min-w-0 truncate font-mono text-[12.5px] tabular-nums md:text-right">
                  <CellLabel>Amount</CellLabel>
                  {t.amounts.length ? (
                    <span className="text-zinc-900 dark:text-zinc-50" title={`${BigInt(total).toLocaleString("en-US")} nAVAX`}>
                      {avaxAmount(total)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                      {dollars && !dollars.startsWith("<") && <span className="ml-2 hidden text-[11px] md:inline text-zinc-400 dark:text-zinc-500">{dollars}</span>}
                    </span>
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-700">—</span>
                  )}
                </span>
                <span className="flex min-w-0 flex-col md:flex-row md:items-center">
                  <CellLabel>Status</CellLabel>
                  <AtomicStatus t={t} claim={claims.get(t.txHash)} />
                </span>
                <span className={cn(MUTED, "col-span-2 md:col-span-1 md:text-right")} title={`${formatTime(t.timestamp)} · block #${formatNumber(t.blockNumber)}`}>
                  <CellLabel>Age</CellLabel>
                  {ageShort(t.timestamp)}
                </span>
              </RowDoor>
            );
          })}
          {rows.length === 0 && (page ? <EmptyRow>{addr ? "no atomic transactions for this address" : "no atomic transactions"}</EmptyRow> : <RowSkeleton n={12} />)}
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
        <p className="font-mono text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
          imports and exports between the C-Chain and the P-Chain or X-Chain through shared memory. Not EVM transactions: they ride in block extra data, carry CB58 ids and never show in eth_* calls
          {rows.length > 0 && <> · {rows.length} loaded{done ? " · end of history" : ""}</>}
        </p>
      </section>
    </EvmShell>
  );
}

function chainName(c?: string): string {
  if (!c) return "?";
  // the API returns blockchain ids: name the Primary Network's on every network
  return chainOfId(c) ?? trunc(c, 10);
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
  // an export is done once its destination imports the UTXO; an import is
  // itself that claim
  const claim = (d.exportedUtxos ?? []).find((u) => u.claimedBy)?.claimedBy;
  const unclaimed = !isImport && (d.exportedUtxos ?? []).some((u) => !u.claimedBy);
  const moved = isImport ? (d.importedUtxos ?? []).length : (d.exportedUtxos ?? []).length;

  return (
    <EvmShell network={network}>
    <div className="flex flex-col gap-10">
      {/* the tx page's grammar: the subject and its time, the readings, the identifiers */}
      <section className="flex flex-col gap-5">
        <SectionHeader
          label="Atomic Transaction"
          action={
            <span className="flex shrink-0 items-center gap-4">
              <TxTypePill type={t.txType} label={isImport ? "Import" : "Export"} />
              <Link
                href={`${base}/txs/atomic`}
                className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] sm:inline dark:text-zinc-500"
              >
                All atomic →
              </Link>
            </span>
          }
        />
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
          <StatCell label="Route" even sub={isImport ? "imported into the C-Chain" : "exported from the C-Chain"}>
            <span className={FIG}>
              {l.from} <span className={UNIT}>→</span> {l.to}
            </span>
          </StatCell>
          <StatCell
            label="Status"
            even
            href={claim && !unclaimed ? crossChainTxUrl(network, claim.chain, claim.txHash) : undefined}
            sub={
              isImport
                ? `${moved} shared-memory UTXO${moved === 1 ? "" : "s"} consumed`
                : unclaimed
                  ? `not yet imported on ${l.to}`
                  : claim
                    ? `on ${claim.chain} · ${span(claim.timestamp - t.timestamp)} after the export`
                    : undefined
            }
          >
            <span className={FIG}>{isImport ? "Imported" : unclaimed ? "In shared memory" : "Claimed"}</span>
          </StatCell>
          <StatCell label="Block" href={`${base}/block/${t.blockNumber}`} even sub="the C-Chain block it rides in">
            <span className={FIG}>#{formatNumber(t.blockNumber)}</span>
          </StatCell>
        </StatStrip>
        <Board divide={false} className="px-5 md:px-6">
          <SpecSheet>
            <SpecLine label="Type">
              <span className="inline-flex flex-wrap items-baseline gap-x-3">
                {t.txType}
                <span className="font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500">
                  {isImport ? "consumes UTXOs from shared memory, credits EVM balances" : "debits EVM balances, puts UTXOs in shared memory"}
                </span>
              </span>
            </SpecLine>
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
                    <Link
                      href={`${base}/txs/atomic?address=${a}`}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                    >
                      atomic history →
                    </Link>
                  </span>
                ))}
              </span>
            </SpecLine>
            <SpecLine label="Asset">
              <span className="inline-flex flex-wrap items-baseline gap-x-3">
                {AVAX_IDS.has(t.assetIds[0] ?? AVAX.assetId) ? "AVAX" : "Asset"}
                <span className="font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500">{t.assetIds[0] ?? AVAX.assetId}</span>
              </span>
            </SpecLine>
            <SpecLine label="Amount">
              <span className="font-mono text-[13px] tabular-nums">
                {BigInt(total).toLocaleString("en-US")} <span className="text-zinc-400 dark:text-zinc-500">nAVAX</span>
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
