"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, EmptyRow, HEAD, LoadMore, ROW, RowSkeleton } from "@/components/explorer-v2/ui";
import { changeOf, deltaOf, type DefiProtocol, type Span } from "@/lib/defi/llama";
import type { Sort, SortKey } from "@/lib/defi/protocol-filters";
import { GROUP } from "@/lib/defi/taxonomy";
import { groupTone, signedPct, signedUsd, usd } from "./palette";

/* The protocol table: every column sorts, a row opens in place to show
   the protocol's own numbers (its Avalanche TVL over the last month,
   borrowing, volume, fees, how much of it lives on Avalanche) and the
   ways out: its site, DefiLlama, X, and its contract in the explorer. */

const GRID = "md:grid-cols-[2.25rem_minmax(0,1fr)_6.5rem_5.5rem_6.5rem_6.5rem_5.5rem_7rem_1.25rem]";
const NA = <span className="text-zinc-300 dark:text-zinc-700">n/a</span>;
const DAY = 86_400;

function ago(unix: number, now: number): string {
  const d = Math.floor((now - unix) / DAY);
  if (d < 30) return `${Math.max(1, d)}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${(d / 365).toFixed(d < 3650 ? 1 : 0)}y`;
}

function dateOf(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function Logo({ p, size = 20 }: { p: DefiProtocol; size?: number }) {
  if (!p.logo) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-[9px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" style={{ width: size, height: size }}>
        {p.name.slice(0, 1)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.logo} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" style={{ width: size, height: size }} />;
}

export function ProtocolTable({
  rows,
  loading,
  span,
  sort,
  onSort,
  open,
  onOpen,
  shown,
  onMore,
  now,
}: {
  rows: DefiProtocol[] | null;
  loading: boolean;
  span: Span;
  sort: Sort;
  onSort: (key: SortKey) => void;
  open: string | null;
  onOpen: (id: string | null) => void;
  shown: number;
  onMore: () => void;
  now: number;
}) {
  const SortHead = ({ label, k, right = true }: { label: string; k: SortKey; right?: boolean }) => {
    const active = sort.key === k;
    return (
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100", right && "text-right", active && "text-zinc-900 dark:text-zinc-100")}
      >
        {label}
        {active ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Board divide={false}>
        <div className="overflow-x-auto">
          <div className="md:min-w-[60rem]">
            <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
              <span>#</span>
              <span>
                <SortHead label="Protocol" k="name" right={false} />
              </span>
              <span className="text-right">
                <SortHead label="TVL" k="tvl" />
              </span>
              <span className="text-right">
                <SortHead label={span} k="change" />
              </span>
              <span className="text-right">
                <SortHead label={`${span} $`} k="delta" />
              </span>
              <span className="text-right">
                <SortHead label="Volume 24h" k="volume" />
              </span>
              <span className="text-right">
                <SortHead label="Fees 24h" k="fees" />
              </span>
              <span className="text-right">
                <SortHead label="On Avalanche" k="share" />
              </span>
              <span />
            </div>
            {loading && <RowSkeleton n={12} />}
            {rows?.slice(0, shown).map((p, i) => {
              const pct = changeOf(p, span);
              const d = deltaOf(p, span);
              const isOpen = open === p.id;
              return (
                <div key={p.id} id={`defi-row-${p.id}`} className="scroll-mt-28 border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => onOpen(isOpen ? null : p.id)}
                    className={cn(ROW, GRID, "w-full text-left", isOpen && "bg-zinc-50 dark:bg-zinc-900")}
                  >
                    <span className="hidden font-mono text-[12px] tabular-nums text-zinc-400 md:block dark:text-zinc-500">{i + 1}</span>
                    <span className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
                      <Logo p={p} />
                      <span className="flex min-w-0 flex-col md:flex-row md:items-baseline md:gap-2">
                        <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{p.name}</span>
                        <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: groupTone(p.group) }} />
                          {GROUP[p.group].label}
                          {p.listedAt !== null && now - p.listedAt <= 90 * DAY && <span className="ml-1 rounded-[2px] bg-zinc-900 px-1 text-[9px] uppercase tracking-[0.08em] text-white dark:bg-zinc-100 dark:text-zinc-900">new</span>}
                        </span>
                      </span>
                    </span>
                    <span className="md:text-right">
                      <CellLabel>TVL</CellLabel>
                      <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{usd(p.tvl)}</span>
                    </span>
                    <span className="md:text-right">
                      <CellLabel>{span}</CellLabel>
                      <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-zinc-700 dark:text-zinc-300">
                        {pct === null ? NA : <>{pct > 0.05 ? "▲" : pct < -0.05 ? "▼" : "■"} {Math.abs(pct) >= 100 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1)}%</>}
                      </span>
                    </span>
                    <span className="md:text-right">
                      <CellLabel>{span} $</CellLabel>
                      <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{d === null ? NA : signedUsd(d)}</span>
                    </span>
                    <span className="md:text-right">
                      <CellLabel>Volume 24h</CellLabel>
                      <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{p.volume24h ? usd(p.volume24h) : NA}</span>
                    </span>
                    <span className="md:text-right">
                      <CellLabel>Fees 24h</CellLabel>
                      <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{p.fees24h ? usd(p.fees24h) : NA}</span>
                    </span>
                    <span className="md:text-right">
                      <CellLabel>On Avalanche</CellLabel>
                      {p.avalancheShare === null ? (
                        NA
                      ) : (
                        <span className="flex items-center gap-2 md:justify-end" title={`${(p.avalancheShare * 100).toFixed(1)}% of the protocol's TVL across ${p.chains} chain${p.chains === 1 ? "" : "s"} is on Avalanche`}>
                          <span className="block h-1.5 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, p.avalancheShare * 100)}%`, background: groupTone(p.group) }} />
                          </span>
                          <span className="w-9 text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{(p.avalancheShare * 100).toFixed(0)}%</span>
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn("hidden h-3.5 w-3.5 justify-self-end text-zinc-300 transition-transform md:block dark:text-zinc-600", isOpen && "rotate-180 text-zinc-900 dark:text-zinc-100")} />
                  </button>
                  {isOpen && <Detail p={p} now={now} />}
                </div>
              );
            })}
            {rows && rows.length === 0 && <EmptyRow>No protocols match this filter.</EmptyRow>}
          </div>
        </div>
      </Board>
      {rows && shown < rows.length && <LoadMore onClick={onMore} label={`Load more · ${(rows.length - shown).toLocaleString("en-US")} remaining`} />}
    </div>
  );
}

/** the protocol's own page in place: its numbers, what DefiLlama counts, and the ways out */
function Detail({ p, now }: { p: DefiProtocol; now: number }) {
  const track = [
    { label: "30d ago", v: p.prevMonth },
    { label: "7d ago", v: p.prevWeek },
    { label: "1d ago", v: p.prevDay },
    { label: "now", v: p.tvl },
  ];
  const known = track.filter((t): t is { label: string; v: number } => t.v !== null);
  const lo = Math.min(...known.map((t) => t.v));
  const hi = Math.max(...known.map((t) => t.v));
  const y = (v: number) => (hi === lo ? 20 : 36 - ((v - lo) / (hi - lo)) * 32);
  const note =
    p.category === "RWA" || p.category === "Bridge" || p.category === "Canonical Bridge"
      ? "DefiLlama keeps real-world assets and bridges out of its Avalanche TVL."
      : p.doubleCounted > 0
        ? "A vault: its deposits sit in other protocols, so DefiLlama's Avalanche TVL does not count them again."
        : p.liquidStaking > 0
          ? "Liquid staking: DefiLlama shows it apart from its Avalanche TVL."
          : null;
  const links = [
    p.url ? { href: p.url, label: "Website", external: true } : null,
    { href: `https://defillama.com/protocol/${p.slug}`, label: "DefiLlama", external: true },
    p.twitter ? { href: `https://x.com/${p.twitter}`, label: "X", external: true } : null,
    p.address ? { href: `/explorer/mainnet/c-chain/address/${p.address}`, label: "Contract", external: false } : null,
  ].filter((l): l is { href: string; label: string; external: boolean } => l !== null);
  const facts: [string, string][] = [
    ["Category", `${GROUP[p.group].label} · ${p.category}`],
    ["Chains", `${p.chains}${p.avalancheShare !== null ? ` · ${(p.avalancheShare * 100).toFixed(1)}% of its TVL on Avalanche` : ""}`],
  ];
  if (p.borrowed !== null) facts.push(["Borrowed", `${usd(p.borrowed)}${p.tvl > 0 ? ` · ${((p.borrowed / (p.tvl + p.borrowed)) * 100).toFixed(0)}% of supplied` : ""}`]);
  if (p.volume24h !== null) facts.push(["DEX volume", [p.volume24h, p.volume7d, p.volume30d].map((v, i) => `${v === null ? "n/a" : usd(v)} ${["24h", "7d", "30d"][i]}`).join(" · ")]);
  if (p.fees24h !== null) facts.push(["Fees", [p.fees24h, p.fees7d, p.fees30d].map((v, i) => `${v === null ? "n/a" : usd(v)} ${["24h", "7d", "30d"][i]}`).join(" · ")]);
  if (p.mcap) facts.push(["Market cap", `${usd(p.mcap)}${p.tvl > 0 ? ` · ${(p.mcap / p.tvl).toFixed(2)}× its Avalanche TVL` : ""}`]);
  if (p.listedAt !== null) facts.push(["Listed", `${dateOf(p.listedAt)} · ${ago(p.listedAt, now)} ago`]);

  return (
    <div className="grid gap-6 border-t border-zinc-100 bg-zinc-50/60 px-5 py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:px-6 dark:border-zinc-900 dark:bg-zinc-900/30">
      <div className="flex min-w-0 flex-col gap-4">
        {p.description && <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{p.description}</p>}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Avalanche TVL · last 30 days</span>
          {known.length >= 2 ? (
            <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-4">
              <svg viewBox="0 0 120 40" className="h-10 w-32" aria-hidden>
                <polyline
                  fill="none"
                  stroke={groupTone(p.group)}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  points={track.map((t, i) => (t.v === null ? null : `${10 + i * 33},${y(t.v)}`)).filter(Boolean).join(" ")}
                />
                {track.map((t, i) => (t.v === null ? null : <circle key={t.label} cx={10 + i * 33} cy={y(t.v)} r="2.5" fill={groupTone(p.group)} />))}
              </svg>
              <div className="grid grid-cols-4 gap-2">
                {track.map((t) => (
                  <span key={t.label} className="flex flex-col">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">{t.label}</span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">{t.v === null ? "n/a" : usd(t.v)}</span>
                    {t.v !== null && t.label !== "now" && t.v > 0 && (
                      <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{signedPct(((p.tvl - t.v) / t.v) * 100)} to now</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">DefiLlama has no earlier reading.</span>
          )}
        </div>
        {note && <p className="font-mono text-[10.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{note}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-2">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{k}</dt>
              <dd className="min-w-0 font-mono text-[11.5px] tabular-nums text-zinc-800 [overflow-wrap:anywhere] dark:text-zinc-200">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) =>
            l.external ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 border border-zinc-200 bg-white px-2 py-1 font-mono text-[10.5px] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
              >
                {l.label} <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                className="inline-flex items-center gap-1 border border-[#0061E2]/40 bg-white px-2 py-1 font-mono text-[10.5px] text-[#0061E2] transition-colors hover:border-[#0061E2] dark:border-[#5f9dff]/40 dark:bg-zinc-950 dark:text-[#5f9dff]"
              >
                {l.label} in the explorer
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

