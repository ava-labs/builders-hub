"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, HEAD, ROW, RowSkeleton, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { short } from "@/lib/explorer-query/values";
import { bigintToNumber } from "@/lib/rwa/utils";
import type { TransactionRecord } from "@/lib/rwa/types";
import { CHIP, OFF, ON } from "./ProtocolFilters";
import { Money } from "./rwa-parts";

/* The old dashboard's recent transactions: every USDC transfer of the
   tranche pool and the borrower, one row per transfer, cut by direction,
   sorted by date or amount either way, searched by hash, address or name,
   five or twenty rows a page. Each address and hash copies with a click,
   and a transaction opens on the explorer the reader picks. */

type Direction = TransactionRecord["direction"] | "all";
type SortField = "date" | "amount";
type SortDir = "asc" | "desc";
export type TxExplorer = "bh" | "snowtrace" | "avalanche";

const DIRECTIONS: { key: Direction; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inbound", label: "Inbound" },
  { key: "outbound", label: "Outbound" },
  { key: "internal", label: "Internal" },
];
const EXPLORERS: { v: TxExplorer; label: string }[] = [
  { v: "bh", label: "Builder Hub" },
  { v: "snowtrace", label: "Snowtrace" },
  { v: "avalanche", label: "Avalanche Explorer" },
];
const DIRECTION_LABEL: Record<TransactionRecord["direction"], string> = { inbound: "Inbound", outbound: "Outbound", internal: "Internal" };
/* the old table's two page sizes */
const SIZES = { compact: 5, expanded: 20 } as const;
/* the route's largest page, so reading every row takes the fewest reads */
const ALL_PAGE = 100;
const GRID = "md:grid-cols-[9.5rem_5rem_minmax(0,1fr)_minmax(0,1fr)_7.5rem_8.5rem]";
const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** where a transaction opens: the Builder Hub explorer, Snowtrace or the Avalanche explorer */
export function txHref(explorer: TxExplorer, hash: string): string {
  if (explorer === "snowtrace") return `https://snowtrace.io/tx/${hash}`;
  if (explorer === "avalanche") return `https://explorer.avax.network/c-chain/tx/${hash}`;
  return `/explorer/mainnet/c-chain/tx/${hash}`;
}

/** a search over the hash, both addresses and their names, in any case */
export function matchesSearch(t: TransactionRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [t.txHash, t.from, t.to, t.fromLabel, t.toLabel].some((v) => v.toLowerCase().includes(q));
}

interface Page {
  rows: TransactionRecord[];
  total: number;
}

/** one row per transfer: a transaction can carry several */
const transferKey = (t: TransactionRecord) => `${t.txHash}-${t.from}-${t.to}`;

async function readPage(slug: string, page: number, size: number, direction: Direction, sort: SortField, dir: SortDir): Promise<Page> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(size), direction, sortField: sort, sortDirection: dir });
  const res = await fetch(`/api/dapps/rwa/${slug}/transactions?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { transactions: (Omit<TransactionRecord, "amount"> & { amount: string })[]; total: number };
  return { rows: body.transactions.map((t) => ({ ...t, amount: BigInt(t.amount) })), total: body.total };
}

/** a cut of rows already read: one direction or all, by date or amount either way, as the route sorts */
export function cutOf(rows: TransactionRecord[], direction: Direction, sort: SortField, dir: SortDir): TransactionRecord[] {
  const sign = dir === "asc" ? 1 : -1;
  const order = (a: TransactionRecord, b: TransactionRecord) =>
    sort === "amount" ? (a.amount === b.amount ? 0 : a.amount < b.amount ? -1 : 1) : Date.parse(a.timestamp) - Date.parse(b.timestamp);
  return (direction === "all" ? [...rows] : rows.filter((t) => t.direction === direction)).sort((a, b) => sign * order(a, b));
}

/** every row of a cut, a hundred a read; a transfer landing between reads shifts the pages, so each is kept once */
export async function readAll(slug: string, direction: Direction, sort: SortField, dir: SortDir): Promise<TransactionRecord[]> {
  const first = await readPage(slug, 1, ALL_PAGE, direction, sort, dir);
  const rest = await Promise.all(Array.from({ length: Math.ceil(first.total / ALL_PAGE) - 1 }, (_, i) => readPage(slug, i + 2, ALL_PAGE, direction, sort, dir)));
  const listed = new Set<string>();
  return [...first.rows, ...rest.flatMap((p) => p.rows)].filter((t) => {
    const key = transferKey(t);
    if (listed.has(key)) return false;
    listed.add(key);
    return true;
  });
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* the clipboard can be blocked; the value stays on screen */
    }
  };
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${value}`} title="Copy" className="-m-1 shrink-0 p-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** one end of a transfer: its name when the pilot names it, else the short address; a link to the address page and a copy */
function Party({ address, label }: { address: string; label: string }) {
  const named = label.toLowerCase() !== address.toLowerCase();
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link href={`/explorer/mainnet/c-chain/address/${address}`} title={address} className={cn("truncate hover:underline", named ? "text-zinc-900 dark:text-zinc-100" : idInk)}>
        {named ? label : short(address)}
      </Link>
      <CopyButton value={address} />
    </span>
  );
}

function TxCell({ hash, explorer }: { hash: string; explorer: TxExplorer }) {
  const href = txHref(explorer, hash);
  const open = "shrink-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
  const name = EXPLORERS.find((x) => x.v === explorer)?.label ?? "the explorer";
  return (
    <span className="flex min-w-0 items-center gap-1.5 md:justify-end">
      <span className={cn("truncate", idInk)} title={hash}>
        {short(hash)}
      </span>
      <CopyButton value={hash} />
      {explorer === "bh" ? (
        <Link href={href} aria-label={`Open on ${name}`} className={open}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open on ${name}`} className={open}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

function SortHead({ label, field, sort, dir, onSort, className }: { label: string; field: SortField; sort: SortField; dir: SortDir; onSort: (f: SortField) => void; className?: string }) {
  const Icon = sort !== field ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => onSort(field)} aria-label={`Sort by ${label.toLowerCase()}`} className={cn("inline-flex items-center gap-1 uppercase hover:text-zinc-900 dark:hover:text-zinc-100", className)}>
      {label}
      {/* a step darker than the head's ink, so the glyph holds 3:1 */}
      <Icon className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
    </button>
  );
}

export function RwaTransactions({ slug }: { slug: string }) {
  const [direction, setDirection] = useState<Direction>("all");
  const [sort, setSort] = useState<SortField>("date");
  const [dir, setDir] = useState<SortDir>("desc");
  const [explorer, setExplorer] = useState<TxExplorer>("bh");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const size = expanded ? SIZES.expanded : SIZES.compact;
  const cut = `${direction}:${sort}:${dir}`;
  const searching = query.trim().length > 0;
  const pageKey = `${cut}:${page}:${size}`;

  // the server's page while nothing is searched; while something is, every transfer, read once for the view
  // and cut here, so a new direction or sort costs no read (each full read is a dozen, against a per-minute limit)
  const [served, setServed] = useState<(Page & { key: string }) | null>(null);
  const [everything, setEverything] = useState<TransactionRecord[] | null>(null);

  useEffect(() => {
    if (searching) return;
    let cancelled = false;
    setFailed(false);
    readPage(slug, page, size, direction, sort, dir)
      .then((p) => {
        if (!cancelled) setServed({ ...p, key: pageKey });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // pageKey spells out the page, its size and its cut
  }, [slug, pageKey, searching]);

  useEffect(() => {
    if (!searching || everything) return;
    let cancelled = false;
    setFailed(false);
    readAll(slug, "all", "date", "desc")
      .then((rows) => {
        if (!cancelled) setEverything(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, searching, everything]);

  const found = useMemo(
    () => (searching && everything ? cutOf(everything, direction, sort, dir).filter((t) => matchesSearch(t, query)) : null),
    [searching, everything, direction, sort, dir, query],
  );
  const rows = searching ? (found ? found.slice((page - 1) * size, page * size) : null) : served?.key === pageKey ? served.rows : null;
  const total = searching ? (found?.length ?? 0) : (served?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / size));

  // a new cut, size or search starts on the first page
  const restart = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const onSort = (field: SortField) =>
    restart(() => {
      if (field === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSort(field);
        setDir("desc");
      }
    });

  const downloadCsv = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      // the same full read search uses, kept for the next export or search
      const rows = everything ?? (await readAll(slug, "all", "date", "desc"));
      setEverything(rows);
      const { exportTransactionsToCSV } = await import("@/lib/rwa/export/csv");
      exportTransactionsToCSV(cutOf(rows, direction, sort, dir).filter((t) => matchesSearch(t, query)));
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-1 lg:justify-end">
      <label className={cn(CHIP, OFF, "gap-1.5")}>
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => restart(() => setQuery(e.target.value))}
          placeholder="Search tx hash or address"
          aria-label="Search transactions"
          className="w-44 bg-transparent font-mono text-[10.5px] text-zinc-900 outline-none placeholder:text-zinc-500 sm:w-52 dark:text-zinc-100 dark:placeholder:text-zinc-400"
        />
      </label>
      <select value={explorer} onChange={(e) => setExplorer(e.target.value as TxExplorer)} aria-label="Open transactions on" className={cn(CHIP, OFF, "cursor-pointer")}>
        {EXPLORERS.map((x) => (
          <option key={x.v} value={x.v}>
            {x.label}
          </option>
        ))}
      </select>
      <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden />
      {DIRECTIONS.map((d) => (
        <button key={d.key} type="button" aria-pressed={direction === d.key} onClick={() => restart(() => setDirection(d.key))} className={cn(CHIP, direction === d.key ? ON : OFF)}>
          {d.label}
        </button>
      ))}
      <button type="button" onClick={downloadCsv} disabled={exporting || total === 0} className={cn(CHIP, OFF, "ml-1 uppercase tracking-[0.1em]")} title="Download this cut as CSV">
        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
        {exporting ? "CSV…" : exportFailed ? "Retry CSV" : "CSV"}
      </button>
    </div>
  );

  return (
    <section id="rwa-transactions" className="flex min-w-0 scroll-mt-40 flex-col gap-3">
      {/* the controls ride beside the title from lg up and under it below, so the title never truncates */}
      <SectionHeader label="Recent Transactions" action={<div className="hidden lg:block">{controls}</div>} />
      <div className="lg:hidden">{controls}</div>
      <Board divide={false}>
        <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
          <SortHead label="Date (UTC)" field="date" sort={sort} dir={dir} onSort={onSort} />
          <span>Direction</span>
          <span>From</span>
          <span>To</span>
          <SortHead label="Amount" field="amount" sort={sort} dir={dir} onSort={onSort} className="md:justify-self-end" />
          <span className="md:text-right">Tx hash</span>
        </div>
        {!rows && !failed && <RowSkeleton n={size} />}
        {!rows && failed && <EmptyRow>Transactions are unavailable right now</EmptyRow>}
        {rows && rows.length === 0 && <EmptyRow>{searching ? "No transfer matches this search" : "No transfers in this cut"}</EmptyRow>}
        {rows?.map((t) => (
          <div key={transferKey(t)} className={cn(ROW, GRID, "border-b border-zinc-100 font-mono text-[11.5px] last:border-b-0 dark:border-zinc-900")}>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{WHEN.format(new Date(t.timestamp))}</span>
            <span className="text-zinc-600 dark:text-zinc-300">{DIRECTION_LABEL[t.direction]}</span>
            <Party address={t.from} label={t.fromLabel} />
            <Party address={t.to} label={t.toLabel} />
            <span className="tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
              <Money value={bigintToNumber(t.amount)} /> <span className="text-[10px] text-zinc-500 dark:text-zinc-400">USDC</span>
            </span>
            <TxCell hash={t.txHash} explorer={explorer} />
          </div>
        ))}
      </Board>
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>
          {total.toLocaleString("en-US")} transfer{total === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => restart(() => setExpanded((e) => !e))} className={cn(CHIP, OFF)}>
            {expanded ? `Show ${SIZES.compact} rows` : `Show ${SIZES.expanded} rows`}
          </button>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page" className={cn(CHIP, OFF, "px-1.5")}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-nums">
              {page} / {pages}
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page" className={cn(CHIP, OFF, "px-1.5")}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </span>
        </span>
      </div>
    </section>
  );
}
