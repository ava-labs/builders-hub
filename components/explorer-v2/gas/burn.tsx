"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePolledJson } from "@/components/explorer-v2/page-data";
import { RANGE_DAYS, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { Instrument, StackBlock, type StackCol, type StackLayer } from "@/components/explorer-v2/gas/instruments";
import { PTD, PTH } from "@/components/explorer-v2/gas/buyers";
import { BURN_RED, HELICON, avax, usdOf } from "@/components/explorer-v2/network/token-parts";
import { useNarrow } from "@/components/explorer-v2/evm/query/motion";
import { dayLong, dayShort, truncate } from "@/components/explorer-v2/format";
import { useContractNames } from "@/lib/sourcify-client";
import { BURNERS_CHAINS, MAX_BURN_DAYS, burnDays, dailyBurn, seriesCut, type Burner, type GasBurners } from "@/lib/gas-burners";

/* The AVAX that the C-Chain burns, on the gas page's clock: the burn of
   each complete UTC day, and the accounts that paid the most of it. Gas
   counts the work; this counts what the work cost in AVAX. */

/* the C-Chain's fees per UTC day, the same figure as the burn address's daily gain */
const SERIES_URL = "/api/chain-stats/43114?metrics=cChainFeesDaily&timeRange=1y";
/* the board's rows on the page; the route keeps more */
const SHOWN = 10;
/* the table's height while it has no rows: SHOWN rows at the ledger's pitch */
const BODY_H = "h-[440px]";
const LAYERS: StackLayer[] = [{ key: "burned", label: "Burned", what: "the fees of all C-Chain transactions", ...BURN_RED }];

/** the burn so far of today (UTC), from the hourly fees: the daily series holds whole days only */
interface TodayPayload {
  date: string;
  feesPaid: number;
}

interface SeriesPayload {
  /** when the route read the series (ms): its newest day was not over then */
  last_updated?: number;
  cChainFeesDaily?: { data?: { date: string; value: number | string }[] };
}

/** a window's days as the blocks write them: "Oct 5", "Sep 29 to Oct 5", or with the years when they differ */
function spanOf(from: string, to: string): string {
  if (from === to) return dayShort(from);
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${dayShort(from)}, ${from.slice(0, 4)} to ${dayShort(to)}, ${to.slice(0, 4)}`;
  return `${dayShort(from)} to ${dayShort(to)}`;
}

function TryAgain({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="underline decoration-dotted underline-offset-4 hover:text-[#E6212F]">
      Try again
    </button>
  );
}

export function GasBurn(props: { chainId: number; base: string; range: ExplorerRange; usd: number | null }) {
  return BURNERS_CHAINS.has(props.chainId) ? <BurnRow {...props} /> : null;
}

function BurnRow({ chainId, base, range, usd }: { chainId: number; base: string; range: ExplorerRange; usd: number | null }) {
  const series = usePolledJson<SeriesPayload>(SERIES_URL);
  // the day clock gets a week of days, as Gas Reserved does; a year is the longest the chart draws
  const seriesDays = Math.min(365, Math.max(7, RANGE_DAYS[range]));
  const rows = useMemo(() => {
    const data = series.data?.cChainFeesDaily?.data;
    // the route keeps a read for a day, so a day is complete only when it ended before the read
    return data ? dailyBurn(data, seriesCut(series.data?.last_updated, Date.now()), seriesDays) : null;
  }, [series.data, seriesDays]);

  const todayRead = usePolledJson<TodayPayload>(`/api/chain-stats/${chainId}/today`, { refreshMs: 5 * 60_000 });
  const today = useMemo(() => {
    const t = todayRead.data;
    const last = rows?.[rows.length - 1]?.d;
    // it follows a series that has loaded, and only a day past the series' last
    return t && last && t.date > last && Number.isFinite(t.feesPaid) ? { d: t.date, v: t.feesPaid } : null;
  }, [todayRead.data, rows]);

  const days = burnDays(RANGE_DAYS[range]);
  const board = usePolledJson<GasBurners>(`/api/explorer/${chainId}/burners?days=${days}`);

  return (
    <div className="flex flex-col gap-3">
      {/* side by side only where the table fits beside the chart */}
      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 xl:grid-cols-2">
        <BurnedBlock
          rows={rows?.length ? rows : null}
          today={today}
          // a read with no rows (the route answers without the series when its upstream fails) is a failed read
          failed={series.error !== null || (series.data !== null && !rows?.length)}
          // a new read helps after an error; an empty answer stays in the route's cache, so it gets no button
          retry={series.error !== null ? series.retry : null}
          note={range === "day" ? "7 days" : RANGE_DAYS[range] > 365 ? "1 year" : null}
          usd={usd}
        />
        <BurnersBlock
          board={board.data}
          failed={board.error !== null}
          retry={board.retry}
          stale={board.data !== null && board.data.days !== days}
          note={RANGE_DAYS[range] > MAX_BURN_DAYS ? `${MAX_BURN_DAYS} days, longest computed` : null}
          chainId={chainId}
          base={base}
        />
      </div>
      <p className="px-1 font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        A transaction burns all of its fee, the base fee and the tip: the gas it is charged times the price it pays. The fee goes to
        0x0100…0000, an address that no key controls. A wallet is the account that paid. Days are complete UTC days; the striped
        bar is today's burn so far.
      </p>
    </div>
  );
}

/** the AVAX burned on each day of the window, as cuboids, with Helicon marked */
function BurnedBlock({
  rows,
  today,
  failed,
  retry,
  note,
  usd,
}: {
  rows: { d: string; v: number }[] | null;
  /** today's burn so far: drawn apart, and kept out of the window's figures */
  today: { d: string; v: number } | null;
  failed: boolean;
  retry: (() => void) | null;
  note: string | null;
  usd: number | null;
}) {
  const narrow = useNarrow();
  const cols = useMemo<StackCol[]>(() => {
    const whole: StackCol[] = (rows ?? []).map((r) => ({ key: r.d, long: dayLong(r.d), tick: dayShort(r.d), parts: { burned: r.v } }));
    return rows?.length && today
      ? [...whole, { key: today.d, long: dayLong(today.d), tick: "Today", parts: { burned: today.v }, partial: true }]
      : whole;
  }, [rows, today]);
  const n = rows?.length ?? 0;
  const total = (rows ?? []).reduce((s, r) => s + r.v, 0);
  const price = usd ?? 0;
  return (
    <StackBlock
      label="AVAX Burned"
      note={note}
      figure={n ? avax(total) : failed ? undefined : "…"}
      unit={n ? "AVAX" : undefined}
      sub={
        rows && n ? (
          [usdOf(total, price), `${avax(total / n)} per day`, spanOf(rows[0].d, rows[n - 1].d), today ? `today so far ${avax(today.v)} AVAX` : ""]
            .filter(Boolean)
            .join(" · ")
        ) : failed ? (
          <>
            The daily burn did not load.{retry && <> <TryAgain onClick={retry} /></>}
          </>
        ) : undefined
      }
      cols={cols}
      layers={LAYERS}
      partialLabel="Today, so far"
      marker={rows?.some((r) => r.d === HELICON) ? { key: HELICON, label: "Helicon" } : undefined}
      // as tall as the board's ten rows, which it stands beside on a wide screen; a phone keeps it short
      height={narrow ? 220 : 456}
      fmt={(v) => `${avax(v)} AVAX`}
      tip={(c) => {
        const v = c.parts.burned ?? 0;
        return (
          <>
            <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">{c.long}</p>
            {c.partial && <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">So far: the day is still running (UTC), not its final burn</p>}
            <p className="whitespace-nowrap font-mono text-[11px] font-semibold tabular-nums text-[#E6212F]">
              {v.toLocaleString("en-US", { maximumFractionDigits: 2 })} AVAX burned{c.partial ? " so far" : ""}
            </p>
            {usdOf(v, price) && <p className="whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500">{usdOf(v, price)}</p>}
          </>
        );
      }}
    />
  );
}

const fmtAvax = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** the accounts that burned the most AVAX in the window, with the receiver of the transactions that burned the most of each one's AVAX */
function BurnersBlock({
  board,
  failed,
  retry,
  stale,
  note,
  chainId,
  base,
}: {
  board: GasBurners | null;
  failed: boolean;
  retry: () => void;
  stale: boolean;
  note: string | null;
  chainId: number;
  base: string;
}) {
  const shown = useMemo(() => board?.burners.slice(0, SHOWN) ?? [], [board]);
  // Sourcify names the receivers that the registry does not
  const names = useContractNames(
    chainId,
    useMemo(() => shown.flatMap((b) => (b.target && !b.targetName && b.targetKind !== "account" ? [b.target] : [])), [shown]),
  );
  return (
    <Instrument
      label="Top Burners"
      note={note}
      stale={stale}
      figure={board ? avax(board.wallets) : failed ? undefined : "…"}
      unit={board ? "wallets" : undefined}
      sub={board ? `paid ${avax(board.total)} AVAX · ${spanOf(board.from, board.to)}` : failed ? "The top burners did not load" : undefined}
    >
      <div className="overflow-x-auto">
        {/* the figures first: a phone drops the tx count, and the receiver column is the one that scrolls */}
        <table className="w-full min-w-[34rem] table-fixed border-collapse sm:min-w-[38rem]">
          <caption className="sr-only">Top burners</caption>
          <thead>
            <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
              <th className={cn(PTH, "w-[7%] pr-0 md:pr-0")}>#</th>
              <th className={cn(PTH, IN, "w-[20%]")}>Wallet</th>
              <th className={cn(PTH, IN, "w-[16%] whitespace-nowrap text-right")}>AVAX Burned</th>
              <th className={cn(PTH, IN, "w-[10%] text-right")}>Share</th>
              <th className={cn(PTH, IN, "hidden w-[12%] text-right sm:table-cell")}>Txs</th>
              <th className={cn(PTH, "w-[35%] pl-4 md:pl-4")}>Mostly Sent To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {board && shown.length > 0 ? (
              shown.map((b, i) => <BurnerRow key={b.wallet} b={b} rank={i + 1} name={b.target ? (b.targetName ?? names.get(b.target)) : undefined} base={base} />)
            ) : board || failed ? (
              <tr>
                <td colSpan={6} className={cn(PTD, BODY_H, "text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500")}>
                  {board ? (
                    "No transaction paid a fee in this window"
                  ) : (
                    <>
                      The top burners did not load. <TryAgain onClick={retry} />
                    </>
                  )}
                </td>
              </tr>
            ) : (
              Array.from({ length: SHOWN }).map((_, i) => (
                <tr key={i} className="h-11">
                  <td colSpan={6} className="px-5 md:px-6">
                    <div className="h-3 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Instrument>
  );
}

const LINK = "font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]";
const NUM = "text-right font-mono tabular-nums";
/* an inner cell's padding: the outer cells keep the block's edge */
const IN = "px-2 md:px-2";
const KIND = "block truncate font-mono text-[9.5px] uppercase leading-none tracking-[0.16em] text-zinc-400 dark:text-zinc-500";

/** a share in percent that reads 100 only when it is all of it */
function pctText(pct: number, digits: number): string {
  return pct < 100 ? Math.min(pct, 100 - 10 ** -digits).toFixed(digits) : "100";
}

function BurnerRow({ b, rank, name, base }: { b: Burner; rank: number; name: string | undefined; base: string }) {
  const kind = b.targetKind === "contract" ? "Contract" : b.targetKind === "account" ? "Account" : null;
  return (
    <tr className="h-11">
      <td className={cn(PTD, "pr-0 font-mono text-[11px] tabular-nums text-zinc-400 md:pr-0 dark:text-zinc-500")}>{rank}</td>
      <td className={cn(PTD, IN, "py-1.5")}>
        <Link href={`${base}/address/${b.wallet}`} title={b.wallet} className={cn(LINK, "block truncate font-mono text-[12px] leading-5")}>
          {truncate(b.wallet, 6)}
        </Link>
        {/* a fee payer always is an account: the chain refuses a sender with code */}
        <span className={KIND}>Account</span>
      </td>
      <td className={cn(PTD, IN, NUM, "text-zinc-900 dark:text-zinc-100")}>{fmtAvax(b.burned)}</td>
      <td className={cn(PTD, IN, NUM, "text-zinc-700 dark:text-zinc-300")}>{b.sharePct.toFixed(1)}%</td>
      <td className={cn(PTD, IN, NUM, "hidden text-zinc-500 sm:table-cell dark:text-zinc-400")}>{b.txs.toLocaleString("en-US")}</td>
      <td className={cn(PTD, "py-1.5 pl-4 md:pl-4")} title={`${pctText(b.targetPct, 1)}% of this wallet's burn was on transactions to ${b.target ?? "new contracts"}`}>
        {b.target ? (
          <Link href={`${base}/address/${b.target}`} className={cn(LINK, "block truncate leading-5", !name && "font-mono text-[12px]")}>
            {name ?? truncate(b.target, 6)}
          </Link>
        ) : (
          <span className="block truncate leading-5 text-zinc-500 dark:text-zinc-400">Contract creation</span>
        )}
        <span className={KIND}>{[kind, `${pctText(b.targetPct, 0)}% of its burn`].filter(Boolean).join(" · ")}</span>
      </td>
    </tr>
  );
}
