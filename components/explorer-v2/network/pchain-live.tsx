"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { EASE_CSS, useStill } from "@/components/explorer-v2/motion";
import { Belt, MotionRow } from "@/components/explorer-v2/evm/LiveBoards";
import { useTicker } from "@/components/explorer-v2/network/ticker";
import { chainDisplayName, pchainApiPath, txTypeLabel, type PchainNetwork, type Tx } from "@/lib/pchain-explorer";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { FAM, Logo, famOf } from "@/components/explorer-v2/network/icm-map";
import { actsOnSubnet, useTxTargets } from "@/components/explorer-v2/network/tx-targets";
import { PCHAIN_LOGO } from "@/components/explorer-v2/network/city-model";
import type { PchainPulse, PulseTx } from "@/components/explorer-v2/network/pchain-pulse";
import type { NodeBlockTx } from "@/lib/pchain-block";
import { Age, ChainLogo, Heading, Note, Shimmer, SkeletonRows, StatusLine } from "@/components/explorer-v2/network/chain-live";
import { catalogBySubnet } from "@/lib/explorer-catalog";

/* The P-Chain's live preview in the city: its newest transactions as the
   ring gets them, newest first, each with what it acts on. The city opens
   it at the right when downtown's P wing is picked.

   The pane reads the ledger the city already streams (usePchainPulse, the
   last 96 txs) and the newest blocks from the node (/api/live/pchain, shared
   by every viewer), because the indexer's ledger runs about a minute behind
   the chain: a tx shows the moment its block lands, and its indexer row
   takes that place, with more on it, when it arrives. When the node is
   silent the list says how far behind the chain it is. The L1 an operation
   acts on comes from the same session-wide lookups the ring uses. The feed's rows carry no amounts, and the per-tx read that
   has them is the origin's heaviest query, so the pane shows the stake's
   period and node instead. */

/** an L1 by its subnet, as the city names it */
export interface PaneL1 {
  name: string;
  logo: string;
}

const baseOf = (network: PchainNetwork) => `/explorer/${network}/p-chain`;
/* rows on the pane, the one sliding out under the list's foot included */
const ROWS = 20;
/* the ledger reads the tip every other 12 s poll: this long without a word, it has stopped */
const SILENT_MS = 60_000;
/* this long without a first ledger, the status says what it waits on; this long, the feed is not answering */
const SLOW_MS = 8_000;
const OPEN_MS = 30_000;
/* the first paint's stagger, a row after a row */
const ROW_STEP_MS = 45;
/* the node's newest blocks are read this often; the route shares one read among every viewer */
const TIP_MS = 3_000;

/* an L1 by its subnet, as the network's catalog names it */
function catalogL1(network: PchainNetwork, subnet: string): PaneL1 | null {
  const c = catalogBySubnet(network).get(subnet);
  return c ? { name: c.chainName, logo: c.chainLogoURI ?? "" } : null;
}

/* the node's rows: converted once per tx, so a row keeps its identity across
   polls, and each remembers its place in its block for the list's order */
const NODE_ROWS = new Map<string, PulseTx>();
const PLACE = new Map<string, number>();

function nodeRow(t: NodeBlockTx): PulseTx {
  let row = NODE_ROWS.get(t.hash);
  if (!row) {
    row = { hash: t.hash, type: t.type, height: t.height, ts: t.ts, nodeId: t.nodeId, seq: -1, fresh: false, replay: false, lane: 0 };
    NODE_ROWS.set(t.hash, row);
    PLACE.set(t.hash, t.index);
    if (NODE_ROWS.size > 600) {
      for (const k of [...NODE_ROWS.keys()].slice(0, 300)) {
        NODE_ROWS.delete(k);
        PLACE.delete(k);
      }
    }
  }
  return row;
}

/** newest block first, then by place in the block; negative when `a` is newer */
const rowNewer = (a: PulseTx, b: PulseTx) => b.height - a.height || (PLACE.get(a.hash) ?? 0) - (PLACE.get(b.hash) ?? 0) || a.hash.localeCompare(b.hash);

/** the indexer's rows over the node's: a tx the indexer has read keeps its row, with more on it, in the node row's place */
function mergeRows(indexed: PulseTx[], node: NodeBlockTx[]): PulseTx[] {
  const by = new Map<string, PulseTx>();
  for (const t of node) by.set(t.hash, nodeRow(t));
  for (const t of indexed) by.set(t.hash, t);
  return [...by.values()].sort(rowNewer);
}

interface NodeFeed {
  height: number;
  /** unix seconds of the newest block read */
  time: number;
  txs: NodeBlockTx[];
}

/** the P-Chain's newest blocks as the node sees them; null until the first read, and kept when a read fails */
function useNodeFeed(network: string): NodeFeed | null {
  const [feed, setFeed] = useState<NodeFeed | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live/pchain/${network}`, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
        if (res.ok) {
          const w = (await res.json()) as { height: number; time: number; txs?: NodeBlockTx[] };
          // a window from behind (a stale answer) never replaces a newer one
          if (alive && w.height) setFeed((prev) => (prev && prev.height > w.height ? prev : { height: w.height, time: w.time, txs: w.txs ?? [] }));
        }
      } catch {
        /* the last window stands */
      }
      if (alive) schedule();
    };
    // a hidden tab does not read; the next look does
    const schedule = () => {
      timer = setTimeout(() => (document.visibilityState === "hidden" ? schedule() : void poll()), TIP_MS);
    };
    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [network]);
  return feed;
}

/** "58 min", "1.4 h": the span the ledger covers */
function spanOf(txs: PulseTx[]): string | null {
  if (txs.length < 2) return null;
  const s = txs[0].ts - txs[txs.length - 1].ts;
  return s < 5400 ? `${Math.max(1, Math.round(s / 60))} min` : `${(s / 3600).toFixed(1)} h`;
}

/* ------------------------------------------------------------------ */
/* one tx on two lines: what it is and its family, then what it acts on and when */

const TX_ROW =
  "grid h-11 grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 px-4 py-[5px] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900";

/** what the tx acts on: the L1 an operation names, else the Primary Network */
function Target({ t, subnet, l1Of }: { t: PulseTx; subnet: string | undefined; l1Of: (subnetId: string) => PaneL1 | null }) {
  if (subnet) {
    const l1 = l1Of(subnet);
    return l1 ? (
      <span className="flex min-w-0 items-center gap-1.5">
        <Logo uri={l1.logo} name={l1.name} />
        <span className="truncate text-zinc-800 dark:text-zinc-200">{l1.name}</span>
      </span>
    ) : (
      <span className="truncate font-mono text-[11px]" title={subnet}>
        Subnet {truncate(subnet, 6)}
      </span>
    );
  }
  // an operation whose L1 the lookup has not named yet, or could not
  if (actsOnSubnet(t.type)) return <span className="truncate text-zinc-400 dark:text-zinc-500">An L1</span>;
  return <span className="shrink-0">Primary Network</span>;
}

/* ------------------------------------------------------------------ */
/* a tx's card, beside its row while the pointer rests on it: who the tx touched */

/** a row under the pointer: its tx, the subnet it acts on, and where the row stands on screen */
interface HoverRow {
  t: PulseTx;
  subnet: string | undefined;
  rect: DOMRect;
}

/* the tx's full read names who it touched; it is the origin's heaviest
   query, so the card asks only once the pointer rests on a row, one read at
   a time, and keeps what it gets for the session (a tx is final once
   accepted, and the proxy caches it a day). A failed read is tried again
   on a later hover */
const REST_MS = 280;
const READ_MS = 10_000;
const RETRY_MS = 30_000;
const READS = new Map<string, Tx | "failed">();

function useTxRead(hash: string, network: PchainNetwork): Tx | "reading" | "failed" {
  const [, landed] = useState(0);
  useEffect(() => {
    if (READS.has(hash)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(pchainApiPath(network, `tx/${hash}`), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(READ_MS)]) })
        .then((res) => (res.ok ? (res.json() as Promise<Tx>) : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((tx) => READS.set(hash, tx))
        .catch(() => {
          if (controller.signal.aborted) return;
          READS.set(hash, "failed");
          setTimeout(() => READS.get(hash) === "failed" && READS.delete(hash), RETRY_MS);
        })
        .finally(() => !controller.signal.aborted && landed((n) => n + 1));
    }, REST_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hash, network]);
  return READS.get(hash) ?? "reading";
}

type Party = { label: string; value: ReactNode };

const sumOf = (list: { amount: string }[] | undefined) => (list ?? []).reduce((n, a) => n + Number(a.amount || 0), 0);
const addrsOf = (list: { addresses: string[] }[] | undefined) => [...new Set((list ?? []).flatMap((u) => u.addresses))];
/** the first address, and how many more */
const few = (addrs: string[]) => (addrs.length ? `${truncate(addrs[0], 10)}${addrs.length > 1 ? ` +${addrs.length - 1}` : ""}` : null);
/** nAVAX as the card reads it: two decimals from one AVAX up, four under it */
const avax = (n: number) => {
  if (!(n > 0)) return null;
  const v = n / 1e9;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: v >= 1 ? 2 : 4 })} AVAX`;
};

/* who a tx touched: what it acts on (an L1 or the Primary Network) and the
   validator from its row, then, once its read lands, whose AVAX moved where */
function partiesOf(t: PulseTx, tx: Tx | null, subnet: string | undefined, l1: PaneL1 | null): Party[] {
  const out: Party[] = [];
  const add = (label: string, value: ReactNode | null | undefined) => {
    if (value) out.push({ label, value });
  };
  add(
    "On",
    l1 ? (
      <>
        <Logo uri={l1.logo} name={l1.name} />
        <span className="truncate font-sans">{l1.name}</span>
      </>
    ) : subnet && subnet !== PRIMARY_SUBNET_ID ? (
      `Subnet ${truncate(subnet, 6)}`
    ) : actsOnSubnet(t.type) ? (
      "An L1"
    ) : (
      "Primary Network"
    ),
  );
  const node = tx?.nodeId ?? t.nodeId;
  add("Validator", node && truncate(node, 14));
  if (!tx) return out;
  const type = tx.txType;
  if (/Reward/.test(type)) {
    add("Paid to", few(addrsOf(tx.emittedUtxos)));
    add("Reward", tx.details?.rewardPaid === false ? "Not paid" : avax(sumOf(tx.emittedUtxos)));
    add("For stake", tx.details?.stakingTxId && truncate(tx.details.stakingTxId, 8));
  } else if (type === "ImportTx") {
    add("From", tx.importedFrom?.chainName ?? chainDisplayName(tx.details?.sourceChain ?? tx.importedFrom?.chainId));
    add("Sender", few(tx.importedFrom?.exports.flatMap((e) => e.evmSenders ?? []) ?? []));
    add("To", few(addrsOf(tx.emittedUtxos)));
    add("Amount", avax(sumOf(tx.emittedUtxos)));
  } else if (type === "ExportTx") {
    add("To", chainDisplayName(tx.details?.destinationChain));
    add("From", few(addrsOf(tx.consumedUtxos)));
    add("Amount", avax(sumOf(tx.value)));
  } else if (/L1|Convert/.test(type)) {
    add("Validation", tx.details?.validationId && truncate(tx.details.validationId, 8));
    add("Weight", tx.details?.weight !== undefined && formatNumber(tx.details.weight));
    add("Balance", tx.details?.l1Balance !== undefined && (avax(tx.details.l1Balance) ?? "0 AVAX"));
  } else if (/Validator|Delegator/.test(type)) {
    add("Stake", avax(sumOf(tx.amountStaked)) ?? (tx.details?.weight ? avax(tx.details.weight) : null));
    add("Rewards to", few(tx.rewardAddresses ?? []));
    add("Period", tx.periodHuman ?? t.period);
  } else if (type === "CreateChainTx") {
    add("Chain", tx.details?.chainName);
  } else if (type === "CreateSubnetTx") {
    add("Owners", few(tx.details?.subnetOwners ?? []));
  } else {
    add("From", few(addrsOf(tx.consumedUtxos)));
    add("To", few(addrsOf(tx.emittedUtxos)));
  }
  return out;
}

function TxCard({ row, l1Of, network }: { row: HoverRow; l1Of: (subnetId: string) => PaneL1 | null; network: PchainNetwork }) {
  const { t, subnet, rect } = row;
  const read = useTxRead(t.hash, network);
  const tx = read === "reading" || read === "failed" ? null : read;
  const l1 = subnet ? l1Of(subnet) : null;
  const parties = partiesOf(t, tx, subnet, l1);
  // over the city at the pane's left, level with the row; a low row hangs it upward so it stays on screen
  const low = rect.top > window.innerHeight * 0.55;
  const style = { right: window.innerWidth - rect.left + 10, ...(low ? { bottom: window.innerHeight - rect.bottom } : { top: rect.top }) };
  return createPortal(
    <div role="tooltip" className="pointer-events-none fixed z-50 w-[264px] animate-[bh-fade_160ms_ease-out]" style={style}>
      <TipPlate>
        <p className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="truncate text-[12px] font-medium text-zinc-900 dark:text-zinc-100">{txTypeLabel(t.type)}</span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400">Block {formatNumber(t.height)}</span>
        </p>
        {parties.map((p) => (
          <p key={p.label} className="flex items-center justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
            <span className="shrink-0 text-zinc-500">{p.label}</span>
            <span className="flex min-w-0 items-center justify-end gap-1.5 truncate">{p.value}</span>
          </p>
        ))}
        {read === "reading" && <Shimmer className="my-1.5 h-2.5 w-36" />}
        <p className="mt-1 font-mono text-[10px] text-zinc-400">Click to open the tx</p>
      </TipPlate>
    </div>,
    document.body,
  );
}

const TxList = memo(function TxList({
  txs,
  loading,
  l1Of,
  network,
  onRow,
}: {
  txs: PulseTx[];
  loading: boolean;
  l1Of: (subnetId: string) => PaneL1 | null;
  network: PchainNetwork;
  /** the row under the pointer or the keyboard's focus, and null as it leaves */
  onRow?: (row: HoverRow | null) => void;
}) {
  // the ticker: a poll's txs enter one at a time at the ledger's pace, and
  // the list holds still while the pointer is over it so a row can be clicked
  const [hover, setHover] = useState(false);
  const rows = useTicker(txs, ROWS, { key: (t) => t.hash, newer: rowNewer, paused: hover });
  // the ring's own lookups, shared for the session: asking again costs nothing
  const targets = useTxTargets(rows, network);
  const still = useStill();
  // the first paint's rows, by their place: they fade up over the skeleton's hairlines in turn, where a later row slides in
  const intro = useRef<Map<string, number> | null>(null);
  if (intro.current === null && rows.length > 0) intro.current = new Map(rows.map((t, i) => [t.hash, i]));

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        onRow?.(null);
      }}
      onScroll={() => onRow?.(null)}
    >
      {loading && rows.length === 0 && <SkeletonRows n={8} />}
      {rows.length > 0 && (
        <Belt rows={ROWS - 1}>
          {rows.map((t, i) => {
            const f = famOf(t.type);
            const at = intro.current?.get(t.hash);
            const fade = at !== undefined && !still ? { animation: `bh-fade-up 520ms ${EASE_CSS} ${at * ROW_STEP_MS}ms both` } : undefined;
            return (
              <MotionRow key={t.hash} animateIn={at === undefined && !still} overflow={i >= ROWS - 1}>
                <Link
                  href={`${baseOf(network)}/tx/${t.hash}`}
                  className={TX_ROW}
                  style={fade}
                  data-live-row
                  onMouseEnter={(e) => onRow?.({ t, subnet: targets.get(t.hash), rect: e.currentTarget.getBoundingClientRect() })}
                  onFocus={(e) => onRow?.({ t, subnet: targets.get(t.hash), rect: e.currentTarget.getBoundingClientRect() })}
                  onBlur={() => onRow?.(null)}
                >
                  <span className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-[12.5px] font-medium text-zinc-900 dark:text-zinc-50">{txTypeLabel(t.type)}</span>
                    {t.period && <span className="shrink-0 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">{t.period}</span>}
                  </span>
                  {/* the family in the ring's clay, so a row reads as its tile */}
                  <span className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                    <span className={cn("h-2.5 w-1.5 shrink-0", FAM[f].bg)} aria-hidden />
                    {FAM[f].label}
                  </span>
                  <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    <Target t={t} subnet={targets.get(t.hash)} l1Of={l1Of} />
                    {t.nodeId && (
                      <>
                        <span className="shrink-0 text-zinc-300 dark:text-zinc-700">·</span>
                        <span className="truncate font-mono text-[11px]" title={t.nodeId}>
                          {truncate(t.nodeId, 11)}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="col-start-2 row-start-2 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    <Age ms={t.ts * 1000} />
                  </span>
                </Link>
              </MotionRow>
            );
          })}
        </Belt>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */

export function PChainLive({
  pulse,
  network,
  l1Of,
  compact = false,
  onClose,
  onTarget,
}: {
  /** the ledger the city already streams (useCityData's `pulse`); the pane polls nothing */
  pulse: PchainPulse;
  /** the P-Chain the ledger reads: its node, its tx reads and its links */
  network: PchainNetwork;
  /** an L1 by its subnet, as the city names it; the catalog's name when absent */
  l1Of?: (subnetId: string) => PaneL1 | null;
  /** under a view that already names the P-Chain and opens its explorer: no name row, no close, no footer */
  compact?: boolean;
  onClose: () => void;
  /** the L1 a tx under the pointer acts on, by its subnet, so the city can light its tower; null as the pointer leaves */
  onTarget?: (subnetId: string | null) => void;
}) {
  const { txs, stats, epoch } = pulse;
  // the node's newest blocks over the indexer's ledger: a tx shows from the
  // node the moment its block lands, and its indexer row takes the place when it arrives
  const node = useNodeFeed(network);
  const rows = useMemo(() => mergeRows(txs, node?.txs ?? []), [txs, node]);
  // an L1 by its subnet: the city's name, else the network's catalog's
  const nameL1 = useCallback((subnet: string) => l1Of?.(subnet) ?? catalogL1(network, subnet), [l1Of, network]);

  // the tx under the pointer: its card at the pane's left, and the L1 it acts on lit in the city
  const [row, setRow] = useState<HoverRow | null>(null);
  useEffect(() => setRow(null), [epoch]);
  const target = row?.subnet && row.subnet !== PRIMARY_SUBNET_ID ? row.subnet : null;
  useEffect(() => {
    if (!target) return;
    onTarget?.(target);
    return () => onTarget?.(null);
    // the parent's callback identity does not matter, only the target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // the ledger speaks at least every other poll (the tip); a minute in view
  // without a word, it has stopped. A hidden tab does not count: the ledger rests with it
  const [silent, setSilent] = useState(false);
  useEffect(() => {
    let quiet = 0;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      quiet += 5_000;
      if (quiet >= SILENT_MS) setSilent(true);
    }, 5_000);
    return () => {
      clearInterval(id);
      setSilent(false);
    };
  }, [txs, stats]);
  // no first ledger after eight seconds: the status says what it waits on; after half a minute, the feed is not answering
  const [slow, setSlow] = useState(false);
  const [late, setLate] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setSlow(true), SLOW_MS);
    const b = setTimeout(() => setLate(true), OPEN_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  // the tip: the node's, else the stats' when they are newer, else the newest row's block
  const head = rows[0] ?? null;
  const known = [node, stats && { height: stats.tipHeight, time: stats.tipTimestamp }, head && { height: head.height, time: head.ts }].filter(
    (t): t is { height: number; time: number } => Boolean(t && t.height),
  );
  const top = known.sort((a, b) => b.height - a.height)[0] ?? null;
  const tipHeight = top?.height ?? null;
  // a block without a time (a commit block) leaves the age out
  const tipAt = top?.time ? top.time : null;
  // the P-Chain seals a block for every transaction, so the list is this many
  // behind the chain; with the node's rows in it, only when the node has gone quiet
  const behind = node && head ? Math.max(0, node.height - head.height) : 0;
  const span = useMemo(() => spanOf(txs), [txs]);

  const empty = rows.length === 0;
  const status = empty ? (late ? "Not answering" : slow ? "Waiting for the P-Chain's feed" : "Connecting") : silent ? "Not answering" : "Live";
  const note = empty && late ? "The P-Chain's feed is not answering; the pane fills in when it does." : null;

  // a figure shimmers until its value lands, then the value fades in once
  const figure = (label: string, value: ReactNode, sub: ReactNode, pending: boolean) => (
    <div className="flex min-w-0 flex-col gap-0.5 bg-white px-3 py-2 dark:bg-zinc-950">
      <dt className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="truncate font-mono text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {pending ? <Shimmer className="my-[5px] h-3.5 w-24" /> : <span className="animate-[bh-fade_300ms_ease-out]">{value}</span>}
      </dd>
      {pending ? (
        <dd>
          <Shimmer className="mt-1 h-2 w-16" delay={60} />
        </dd>
      ) : (
        sub && <dd className="animate-[bh-fade_300ms_ease-out] truncate font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">{sub}</dd>
      )}
    </div>
  );
  // no ledger yet and not given up on: the dot breathes and the figures shimmer
  const waitingNow = empty && !late;
  const statusLine = <StatusLine label={status} state={status === "Live" ? "live" : waitingNow ? "waiting" : "still"} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* a div, not a <header>: the site styles header elements for its navbar, and that padding would push the name in */}
      <div className={cn("shrink-0 px-4 pb-4", compact ? "pt-0" : "pt-3.5")}>
        {compact ? (
          statusLine
        ) : (
          <div className="flex items-center gap-3">
            <ChainLogo uri={PCHAIN_LOGO} name="P-Chain" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">P-Chain</h3>
              <div className="mt-1">{statusLine}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the live view"
              title="Close the live view"
              className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          {figure(
            "Height",
            tipHeight === null ? "—" : formatNumber(tipHeight),
            tipAt !== null && (
              <>
                <Age ms={tipAt * 1000} /> ago
              </>
            ),
            waitingNow && tipHeight === null,
          )}
          {figure("Txs · 24h", stats ? formatNumber(stats.txCount24h) : "—", span && `last ${txs.length} in ${span}`, waitingNow && !stats)}
        </dl>
      </div>

      {note && <Note>{note}</Note>}

      {empty && late ? (
        <div className="flex-1" />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col">
          <Heading label="Transactions" aside={behind > 1 ? `${formatNumber(behind)} blocks behind the chain` : undefined} />
          {/* a ledger reloaded whole (a tab hidden a long time) paints whole, not as a cascade */}
          <TxList key={epoch} txs={rows} loading={empty} l1Of={nameL1} network={network} onRow={setRow} />
          {row && <TxCard row={row} l1Of={nameL1} network={network} />}
        </section>
      )}

      {!compact && (
        <Link
          href={baseOf(network)}
          className="flex shrink-0 items-center justify-between border-t border-zinc-200/80 px-4 py-2.5 font-mono text-[11.5px] text-[#0061E2] transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-[#5f9dff] dark:hover:bg-zinc-900"
        >
          Explorer
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
