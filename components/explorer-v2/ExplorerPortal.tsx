"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { buildTxUrl } from "@/utils/eip3091";
import { classifyLocally, hasRealChainLogo, pchainApiPath, type SearchResult } from "@/lib/pchain-explorer";
import {
  ChainHitRow,
  EntityHitRow,
  matchChains,
  looksLikeIdentifier,
  lookupTxAcrossChainsCached,
  useSearchEntity,
  type ChainHit,
} from "@/components/explorer-v2/chain-search";
import { Rise, SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import {
  complete,
  flowWindow,
  fmtCompact,
  fmtUsdCompact,
  levelWindow,
  useNetworkSeries,
  useSeatHistory,
  useStakeHistory,
  type DayPoint,
} from "@/components/explorer-v2/network/overview-series";
import {
  PRIMARY_NETWORK_ID,
  fetchValidatorStats,
  useLiveValidatorCounts,
} from "@/components/explorer-v2/validator-stats";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

/* ------------------------------------------------------------------ */
/* /explorer, the portal: one search that takes any identifier, the   */
/* Primary Network's two chains as featured instruments, and a door    */
/* into every L1's own explorer. The front page of one cohesive app.   */
/* ------------------------------------------------------------------ */

/* The image optimizer rejects SVG (dangerouslyAllowSVG is off), so chain
   logos in that format are served as-is. Raster sources keep the optimizer. */
const isSvgSource = (src: string) => /\.svg(?:[?#]|$)/i.test(src);

/* One bar, anything: chains suggest live as you type (by name, chain ID,
   subnet ID, or blockchain ID, via the shared chain-search engine), P-Chain
   shapes route locally, 0x hashes race every EVM chain's RPC, ambiguous
   CB58 hashes ask the search API. */
function UniversalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState(-1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // P-Chain liveness for ranking + the validator figure on each row,
  // fetched (via the shared feed) when name search first becomes possible
  const { live: liveValidators } = useLiveValidatorCounts("mainnet", q.trim().length >= 2);

  const hits = useMemo(() => matchChains(q, liveValidators), [q, liveValidators]);

  // what the identifier in the box resolves to: tx hashes race every
  // chain live, so the dropdown names the chain before Enter is pressed
  const entity = useSearchEntity(q, {
    network: "mainnet",
    blockBase: "/explorer/mainnet/p-chain",
    blockChainName: "P-Chain",
    evmAddressBase: "/explorer/mainnet/c-chain",
    evmAddressChainName: "C-Chain",
  });
  const showHits = focused && (hits.length > 0 || entity !== null);

  const goToHref = (href: string) => {
    setQ("");
    setSel(-1);
    inputRef.current?.blur();
    router.push(href);
  };

  const goToChain = (hit: ChainHit) => goToHref(hit.href);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setError(null);

    // a highlighted chain wins the Enter key; a name-like query's top hit
    // wins too, but identifier shapes (heights, hashes, IDs) keep their
    // plain-Enter search even while chain rows are on offer
    if (hits.length > 0 && (sel >= 0 || !looksLikeIdentifier(query))) {
      goToChain(hits[Math.max(0, sel)].chain);
      return;
    }

    // P-Chain shapes route instantly
    const local = classifyLocally(query);
    if (local) {
      router.push(`/explorer/mainnet/p-chain/${local.type}/${local.id}`);
      return;
    }

    setBusy(true);
    try {
      // EVM tx hashes race every chain's RPC (the dropdown's entity row
      // fills the same cache, so this is usually instant)
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        const result = await lookupTxAcrossChainsCached(query);
        if (result.found && result.chain) {
          router.push(buildTxUrl(`/explorer/mainnet/${result.chain.slug}`, query));
        } else {
          setError("Not found on any supported chain");
        }
        return;
      }
      // everything else: the P-Chain search API decides
      const res = await fetch(pchainApiPath("mainnet", "search", { q: query }));
      const r: SearchResult = res.ok ? await res.json() : { type: "none", id: query };
      if (r.type !== "none") {
        router.push(`/explorer/mainnet/p-chain/${r.type}/${r.id}`);
      } else {
        setError("Nothing matched that identifier");
      }
    } catch {
      setError("Search failed, try again");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showHits) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s <= 0 ? hits.length - 1 : s - 1));
    } else if (e.key === "Escape") {
      setSel(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <form onSubmit={submit} className="relative">
        {/* z-10: the input's backdrop forms a stacking context that would
            otherwise paint over the icon */}
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setError(null);
            setSel(-1);
            // typing IS focus: the autoFocus mount lands before React's
            // onFocus listener attaches, so the event alone can't be trusted
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search any chain, block, transaction, address, or node across Avalanche"
          spellCheck={false}
          className={cn(
            // the explorer's one search box, as every chain page wears it
            "w-full rounded-2xl border bg-white py-3 pl-11 pr-12 font-mono text-[13px] text-zinc-900 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.3)] outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 md:py-3.5 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100",
            error ? "border-[#E6212F]" : "border-zinc-300 dark:border-zinc-700",
            busy && "opacity-60",
          )}
        />
        {busy ? (
          <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        ) : (
          !focused &&
          !q && (
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 md:block dark:border-zinc-800 dark:text-zinc-500">
              /
            </kbd>
          )
        )}
      </form>

      {/* live suggestions: the entity the identifier resolves to, then the
          shared chain rows every explorer search uses */}
      {showHits && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_-20px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950">
          {entity && <EntityHitRow hit={entity} onSelect={goToHref} />}
          {hits.map((hit, i) => (
            <ChainHitRow
              key={hit.chain.href}
              match={hit}
              selected={i === sel}
              validators={hit.chain.subnetId ? liveValidators?.get(hit.chain.subnetId) : undefined}
              onSelect={() => goToChain(hit.chain)}
              onHover={() => setSel(i)}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">
          {error}
        </p>
      )}
    </div>
  );
}

/* The Primary Network's two chains as the first doors: mainnet on the
   tile, the testnet beside it. */
const PRIMARY = [
  {
    slug: "c-chain",
    name: "C-Chain",
    role: "EVM · contracts",
    logo: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
  },
  {
    slug: "p-chain",
    name: "P-Chain",
    role: "Validators · L1s",
    logo: "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg",
  },
];

function PrimaryDoors() {
  return (
    <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
      {PRIMARY.map((c) => (
        <div key={c.slug} className="flex items-stretch bg-white dark:bg-zinc-950">
          <Link
            href={`/explorer/mainnet/${c.slug}`}
            className="group flex min-w-0 flex-1 items-center gap-3.5 px-5 py-5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
          >
            <Image src={c.logo} alt="" width={32} height={32} unoptimized={isSvgSource(c.logo)} className="shrink-0 rounded-full object-contain" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold leading-none text-zinc-900 dark:text-zinc-50">{c.name}</span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{c.role}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
          </Link>
          <Link
            href={`/explorer/fuji/${c.slug}`}
            className="flex shrink-0 items-center border-l border-zinc-200 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-5 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            Fuji
          </Link>
        </div>
      ))}
    </div>
  );
}

/* Doors into every EVM chain's own explorer, validated against the P-Chain:
   a chain earns a door only if its subnet has stake-backed validators right
   now, and the doors rank by validator count. If the feed fails, fall back
   to the unvalidated catalog rather than an empty grid. */
function ChainDoors() {
  const { live: liveValidators, failed: feedFailed } = useLiveValidatorCounts();

  const chains = useMemo(() => {
    // the C-Chain has its own featured board above; the grid is for L1s
    const all = (l1ChainsData as L1Chain[]).filter(
      (c) => c.isTestnet !== true && c.rpcUrl && hasRealChainLogo(c.chainLogoURI) && c.slug !== "c-chain",
    );
    if (liveValidators) {
      return all
        .filter((c) => c.subnetId && liveValidators.has(c.subnetId))
        .sort((a, b) => (liveValidators.get(b.subnetId!) ?? 0) - (liveValidators.get(a.subnetId!) ?? 0))
        .slice(0, 11);
    }
    if (!feedFailed) return null; // still validating: skeleton doors
    return all.slice(0, 11); // feed down: the catalog beats an empty grid
  }, [liveValidators, feedFailed]);

  return (
    <div className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-3 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
      {chains === null
        ? Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 bg-white px-4 py-4 dark:bg-zinc-950">
              <span className="h-6 w-6 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
              <span className="h-3 w-24 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))
        : chains.map((chain) => (
            <Link
              key={chain.chainId}
              href={`/explorer/mainnet/${chain.slug}`}
              className="group flex items-center gap-3 bg-white px-4 py-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <Image
                src={chain.chainLogoURI}
                alt=""
                width={24}
                height={24}
                unoptimized={isSvgSource(chain.chainLogoURI)}
                className="rounded-full object-contain"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {chain.chainName}
              </span>
              {liveValidators?.has(chain.subnetId ?? "") && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                  {liveValidators.get(chain.subnetId!)}
                  <span className="ml-1 hidden xl:inline">VALIDATORS</span>
                </span>
              )}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
            </Link>
          ))}
      {/* the directory holds the long tail */}
      <Link
        href="/explorer/mainnet/chains"
        className="group flex items-center justify-between gap-3 bg-white px-4 py-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
          All chains
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
      </Link>
    </div>
  );
}

/* The network at a glance: the same figures the homepage ledger and the
   All Networks overview report, read from the same feed
   (/api/overview-stats, 60s repoll), so the portal can never disagree
   with the front door. The stake headline follows the homepage recipe:
   Primary Network stake from validator-stats, spot price for USD, supply
   for the share. Each figure carries its last 30 days as a spark and its
   move against the 30 days before. */

interface OverviewAggregate {
  totalTxCount: number;
  totalICMMessages: number;
  totalValidators: number;
  activeL1Count: number;
}

/* the portal's fixed window: it has no clock of its own */
const DAYS = 30;

type Llama = { value: number | null; history: DayPoint[] | null };

function NetworkBoard() {
  const [agg, setAgg] = useState<OverviewAggregate | null>(null);
  const [stakeAvax, setStakeAvax] = useState<number | null>(null);
  const [avaxUsd, setAvaxUsd] = useState<number | null>(null);
  const [supply, setSupply] = useState<number | null>(null);
  const [defi, setDefi] = useState<{ tvl: Llama; stables: Llama; dex: Llama } | null>(null);
  const series = useNetworkSeries(DAYS);
  const seats = useSeatHistory();
  const stake = useStakeHistory();

  // the shared overview feed, repolled like the homepage board
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // no-store: the route sends max-age=14400, which would pin this
        // 60s-repoll widget to a 4-hour-old browser cache entry. Skipping
        // the browser cache still lands on the CDN's s-maxage copy.
        const res = await fetch("/api/overview-stats?timeRange=month", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        // an all-zero aggregate means the upstream cache is warming: keep
        // dashes; a partial one still carries real figures (each cell gates
        // on its own value below)
        const a = data?.aggregated;
        if (!cancelled && a && (a.totalTxCount > 0 || a.totalValidators > 0)) setAgg(a);
      } catch {
        /* dashes hold the line */
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // stake headline: each source degrades independently (AVAX-only if the
  // price is missing, no share line if supply is), and each retries on the
  // board's 60s clock until it lands: a tab opened during an API hiccup
  // heals itself instead of holding the dash until a reload
  useEffect(() => {
    let cancelled = false;
    const landed = { stake: false, price: false, supply: false };
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      const [vres, pres, sres] = await Promise.allSettled([
        landed.stake ? null : fetchValidatorStats(),
        landed.price
          ? null
          : fetch("https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd").then((r) =>
              r.ok ? r.json() : null,
            ),
        landed.supply ? null : fetch("/api/avax-supply").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;
      if (!landed.stake && vres.status === "fulfilled" && Array.isArray(vres.value)) {
        const primary = vres.value.find((s: { id: string }) => s.id === PRIMARY_NETWORK_ID);
        if (primary?.totalStakeString) {
          setStakeAvax(Math.round(Number(BigInt(primary.totalStakeString) / 1_000_000_000n)));
          landed.stake = true;
        }
      }
      if (!landed.price && pres.status === "fulfilled") {
        const price = pres.value?.["avalanche-2"]?.usd;
        if (typeof price === "number" && price > 0) {
          setAvaxUsd(price);
          landed.price = true;
        }
      }
      if (!landed.supply && sres.status === "fulfilled") {
        const circ = Number(sres.value?.circulatingSupply);
        if (Number.isFinite(circ) && circ > 0) {
          setSupply(circ);
          landed.supply = true;
        }
      }
      if (landed.stake && landed.price && landed.supply && timer) clearInterval(timer);
    };
    load();
    timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // on-chain capital: the homepage's llama.fi recipe, run client-side,
  // with each figure's daily history for its spark
  useEffect(() => {
    let cancelled = false;
    const day = (t: number | string) => Math.floor(Number(t) / 86_400) * 86_400;
    const get = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    (async () => {
      const [tvl, stables, dex] = await Promise.all([
        get("https://api.llama.fi/v2/historicalChainTvl/Avalanche").then((rows: { date: number; tvl: number }[] | null) =>
          Array.isArray(rows) ? rows.map((r) => ({ t: day(r.date), v: r.tvl })) : null,
        ),
        get("https://stablecoins.llama.fi/stablecoincharts/Avalanche").then(
          (rows: { date: string; totalCirculatingUSD?: Record<string, number> }[] | null) =>
            Array.isArray(rows)
              ? rows.map((r) => ({
                  t: day(r.date),
                  // sum every peg (USD, EUR, JPY, SGD, ...); values are USD-denominated
                  v: Object.values(r.totalCirculatingUSD ?? {}).reduce(
                    (sum: number, v) => sum + (typeof v === "number" && Number.isFinite(v) ? v : 0),
                    0,
                  ),
                }))
              : null,
        ),
        get("https://api.llama.fi/overview/dexs/avalanche?excludeTotalDataChartBreakdown=true").then(
          (d: { total30d?: number; totalDataChart?: [number, number][] } | null) => d,
        ),
      ]);
      if (cancelled) return;
      const pos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
      // a level feed's figure is its latest day
      const level = (h: DayPoint[] | null): Llama => ({ value: pos(h?.[h.length - 1]?.v), history: h });
      setDefi({
        tvl: level(tvl),
        stables: level(stables),
        dex: {
          value: pos(dex?.total30d),
          // complete days only: today's partial day would read as a collapse
          history: Array.isArray(dex?.totalDataChart) ? complete(dex.totalDataChart.map(([t, v]) => ({ t: day(t), v }))) : null,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stakeUsd = stakeAvax !== null && avaxUsd !== null ? stakeAvax * avaxUsd : null;
  const stakedPct = stakeAvax !== null && supply !== null ? (stakeAvax / supply) * 100 : null;
  // "—" once a feed has answered without the figure, "…" while it is out
  const fig = (v: number | null | undefined, landed: boolean, fmt = fmtCompact) =>
    typeof v === "number" && v > 0 ? fmt(v) : landed ? "—" : null;

  const txWin = flowWindow(series?.txCount, DAYS);
  const icmWin = flowWindow(series?.icmMessages, DAYS);
  const seatWin = levelWindow(seats, DAYS);
  const stakeWin = levelWindow(stake, DAYS);
  const tvlWin = levelWindow(defi?.tvl.history, DAYS);
  const stablesWin = levelWindow(defi?.stables.history, DAYS);
  const dexWin = flowWindow(defi?.dex.history, DAYS);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Network · 30 days"
        action={
          <Link
            href="/explorer/mainnet"
            className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            All networks
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <div className="flex flex-col gap-5">
        <ReadoutRow>
          <Readout
            label="Transactions"
            live
            href="/stats/network-metrics"
            value={fig(agg?.totalTxCount, agg !== null)}
            delta={txWin.delta}
            spark={txWin.spark}
          />
          <Readout
            label="ICM Messages"
            live
            href="/explorer/mainnet/icm"
            value={fig(agg?.totalICMMessages, agg !== null)}
            delta={icmWin.delta}
            spark={icmWin.spark}
          />
          <Readout
            label="Validators"
            href="/explorer/mainnet/validators"
            value={fig(agg?.totalValidators, agg !== null, (v) => v.toLocaleString("en-US"))}
            sub="Primary and L1 seats"
            delta={seatWin.delta}
            spark={seatWin.spark}
          />
          <Readout
            label="Active L1s"
            href="/explorer/mainnet/chains"
            value={fig(agg?.activeL1Count, agg !== null, String)}
            sub="per the P-Chain"
          />
        </ReadoutRow>
        <ReadoutRow>
          <Readout
            label="Staked"
            href="/explorer/mainnet/validators"
            value={stakeUsd !== null ? fmtUsdCompact(stakeUsd) : stakeAvax !== null ? fmtCompact(stakeAvax) : null}
            unit={stakeUsd === null && stakeAvax !== null ? "AVAX" : undefined}
            sub={
              stakeUsd !== null && stakeAvax !== null
                ? `${fmtCompact(stakeAvax)} AVAX${stakedPct !== null ? ` · ${stakedPct.toFixed(1)}%` : ""}`
                : undefined
            }
            delta={stakeWin.delta}
            spark={stakeWin.spark}
          />
          <Readout
            label="Stablecoins"
            href="/explorer/mainnet/stablecoins"
            value={fig(defi?.stables.value, defi !== null, fmtUsdCompact)}
            delta={stablesWin.delta}
            spark={stablesWin.spark}
          />
          <Readout
            label="DeFi TVL"
            href="/explorer/mainnet/apps"
            value={fig(defi?.tvl.value, defi !== null, fmtUsdCompact)}
            delta={tvlWin.delta}
            spark={tvlWin.spark}
          />
          <Readout
            label="DEX Volume"
            live
            href="/explorer/mainnet/apps"
            value={fig(defi?.dex.value, defi !== null, fmtUsdCompact)}
            delta={dexWin.delta}
            spark={dexWin.spark}
          />
        </ReadoutRow>
      </div>
    </section>
  );
}

export default function ExplorerPortal() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      {/* the drafting-sheet triangle lattice, snowfall only, as on /solutions */}
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-24 pt-10 md:px-6">
        {/* the C-Chain home's order: the search leads, the figures follow,
            then the chains. No title: the search says what the page is */}
        <Rise delay={0.05} className="pb-10">
          <UniversalSearch />
        </Rise>

        <Rise delay={0.12}>
          <NetworkBoard />
        </Rise>

        <Rise delay={0.2}>
          <section className="mt-12 flex flex-col gap-4">
            <SectionHeader label="Primary Network" />
            <PrimaryDoors />
          </section>
        </Rise>

        <Rise delay={0.26}>
          <section className="mt-12 flex flex-col gap-4">
            <SectionHeader label="L1 Explorers" />
            <ChainDoors />
          </section>
        </Rise>
      </div>
    </main>
  );
}
