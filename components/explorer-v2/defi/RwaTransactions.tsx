"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, HEAD, LoadMore, ROW, RowSkeleton, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { short } from "@/lib/explorer-query/values";
import { bigintToNumber } from "@/lib/rwa/utils";
import type { TransactionRecord } from "@/lib/rwa/types";
import { CHIP, OFF, ON } from "./ProtocolFilters";
import { Money } from "./rwa-parts";

/* The pilot's ledger: every USDC transfer of the tranche pool and the
   borrower, newest or largest first, cut by direction. A page holds 25
   rows; the CSV takes every row of the current cut. */

type Direction = TransactionRecord["direction"] | "all";
type Sort = "date" | "amount";

const DIRECTIONS: { key: Direction; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inbound", label: "Inbound" },
  { key: "outbound", label: "Outbound" },
  { key: "internal", label: "Internal" },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: "date", label: "Newest" },
  { key: "amount", label: "Largest" },
];
const DIRECTION_LABEL: Record<TransactionRecord["direction"], string> = { inbound: "Inbound", outbound: "Outbound", internal: "Internal" };

const PAGE_SIZE = 25;
/* the route's largest page, so a CSV of every row takes the fewest reads */
const CSV_PAGE = 100;
const GRID = "md:grid-cols-[9.5rem_5.5rem_8rem_minmax(0,1fr)_1.25rem]";
const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

interface Page {
  rows: TransactionRecord[];
  total: number;
}

/** the rows on screen, the cut they belong to and how many pages they took */
interface Ledger extends Page {
  cut: string;
  pages: number;
}

/** one row per transfer: a transaction can carry several */
const transferKey = (t: TransactionRecord) => `${t.txHash}-${t.from}-${t.to}`;

/** the ledger with its next page added; a page for a cut no longer on screen is dropped, and a transfer
 *  already listed is skipped (a new transfer between reads shifts the route's pages by a row) */
export function appendPage(prev: Ledger | null, cut: string, next: Page): Ledger | null {
  if (!prev || prev.cut !== cut) return prev;
  const listed = new Set(prev.rows.map(transferKey));
  return { cut, rows: [...prev.rows, ...next.rows.filter((t) => !listed.has(transferKey(t)))], total: next.total, pages: prev.pages + 1 };
}

async function readPage(slug: string, page: number, size: number, direction: Direction, sort: Sort): Promise<Page> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(size), direction, sortField: sort, sortDirection: "desc" });
  const res = await fetch(`/api/dapps/rwa/${slug}/transactions?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { transactions: (Omit<TransactionRecord, "amount"> & { amount: string })[]; total: number };
  return { rows: body.transactions.map((t) => ({ ...t, amount: BigInt(t.amount) })), total: body.total };
}

/** one end of a transfer: its label when the pilot names it, else the short address, either way a link to the address page */
function Party({ address, label }: { address: string; label: string }) {
  const named = label.toLowerCase() !== address.toLowerCase();
  return (
    <Link
      href={`/explorer/mainnet/c-chain/address/${address}`}
      title={address}
      className={cn("truncate hover:underline", named ? "text-zinc-900 dark:text-zinc-100" : idInk)}
    >
      {named ? label : short(address)}
    </Link>
  );
}

export function RwaTransactions({ slug }: { slug: string }) {
  const [direction, setDirection] = useState<Direction>("all");
  const [sort, setSort] = useState<Sort>("date");
  // the ledger remembers which cut it holds, so a switch never shows the old cut's rows
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const cut = `${direction}:${sort}`;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setMoreFailed(false);
    readPage(slug, 1, PAGE_SIZE, direction, sort)
      .then((page) => {
        if (!cancelled) setLedger({ ...page, cut: `${direction}:${sort}`, pages: 1 });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, direction, sort]);

  const shown = ledger?.cut === cut ? ledger : null;

  const showMore = async () => {
    if (!shown) return;
    // the cut this page is for: a switch while it loads drops it (appendPage)
    const askedFor = cut;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = await readPage(slug, shown.pages + 1, PAGE_SIZE, direction, sort);
      setLedger((prev) => appendPage(prev, askedFor, next));
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const downloadCsv = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      const first = await readPage(slug, 1, CSV_PAGE, direction, sort);
      const rest = await Promise.all(
        Array.from({ length: Math.ceil(first.total / CSV_PAGE) - 1 }, (_, i) => readPage(slug, i + 2, CSV_PAGE, direction, sort)),
      );
      const { exportTransactionsToCSV } = await import("@/lib/rwa/export/csv");
      exportTransactionsToCSV([...first.rows, ...rest.flatMap((page) => page.rows)]);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-1 md:justify-end">
      {DIRECTIONS.map((d) => (
        <button key={d.key} type="button" aria-pressed={direction === d.key} onClick={() => setDirection(d.key)} className={cn(CHIP, direction === d.key ? ON : OFF)}>
          {d.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden />
      {SORTS.map((s) => (
        <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => setSort(s.key)} className={cn(CHIP, sort === s.key ? ON : OFF)}>
          {s.label}
        </button>
      ))}
      <button type="button" onClick={downloadCsv} disabled={exporting || !shown?.total} className={cn(CHIP, OFF, "ml-1 uppercase tracking-[0.1em]")} title="Download this cut as CSV">
        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
        {exporting ? "CSV…" : exportFailed ? "Retry CSV" : "CSV"}
      </button>
    </div>
  );

  return (
    <section className="flex min-w-0 flex-col gap-3">
      {/* the cut's controls ride beside the title from md up and under it on a phone, so the title never truncates */}
      <SectionHeader label="Transactions" action={<div className="hidden md:block">{controls}</div>} />
      <div className="md:hidden">{controls}</div>
      <Board divide={false}>
        <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>When (UTC)</span>
          <span>Direction</span>
          <span className="text-right">Amount</span>
          <span>From → to</span>
          <span />
        </div>
        {!shown && !failed && <RowSkeleton n={8} />}
        {!shown && failed && <EmptyRow>Transactions are unavailable right now</EmptyRow>}
        {shown && shown.rows.length === 0 && <EmptyRow>No transactions in this cut</EmptyRow>}
        {shown?.rows.map((t) => (
          <div key={transferKey(t)} className={cn(ROW, GRID, "border-b border-zinc-100 font-mono text-[11.5px] last:border-b-0 dark:border-zinc-900")}>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{WHEN.format(new Date(t.timestamp))}</span>
            <span className="text-zinc-600 dark:text-zinc-300">{DIRECTION_LABEL[t.direction]}</span>
            <span className="tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
              <Money value={bigintToNumber(t.amount)} /> <span className="text-[10px] text-zinc-500 dark:text-zinc-400">USDC</span>
            </span>
            {/* sender and recipient each take half the cell, so every row's arrow and recipient line up */}
            <span className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 md:col-span-1">
              <Party address={t.from} label={t.fromLabel} />
              <ArrowRight className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <Party address={t.to} label={t.toLabel} />
            </span>
            <Link
              href={`/explorer/mainnet/c-chain/tx/${t.txHash}`}
              aria-label="Open the transaction"
              className="hidden justify-self-end text-zinc-500 hover:text-zinc-900 md:block dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </Board>
      {shown && shown.rows.length < shown.total && (
        <LoadMore
          onClick={showMore}
          disabled={loadingMore}
          label={moreFailed ? `Could not load more · retry · ${shown.rows.length} of ${shown.total}` : `Show more · ${shown.rows.length} of ${shown.total}`}
        />
      )}
    </section>
  );
}
