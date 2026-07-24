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
import { Board, Rise, SectionHeader, StatCell, StatDash, StatFigure } from "@/components/explorer-v2/ui";
import {
  PRIMARY_NETWORK_ID,
  fetchValidatorStats,
  useLiveValidatorCounts,
} from "@/components/explorer-v2/validator-stats";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import NetworkGlobe from "@/components/landing-v2/NetworkGlobe";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";

/* ------------------------------------------------------------------ */
/* /explorer — the portal: one search that takes any identifier, the   */
/* Primary Network's two chains as featured instruments, and a door    */
/* into every L1's own explorer. The front page of one cohesive app.   */
/* ------------------------------------------------------------------ */

/* One bar, anything: chains suggest live as you type — by name, chain ID,
   subnet ID, or blockchain ID (the shared chain-search engine) — P-Chain
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

  // what the identifier in the box resolves to — tx hashes race every
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
    // wins too — but identifier shapes (heights, hashes, IDs) keep their
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
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setError(null);
            setSel(-1);
            // typing IS focus — the autoFocus mount lands before React's
            // onFocus listener attaches, so the event alone can't be trusted
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search any chain, block, transaction, address, or node across Avalanche"
          spellCheck={false}
          className={cn(
            "w-full border bg-zinc-50/80 py-4 pl-12 pr-32 font-mono text-[13px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white md:py-5 md:pr-36 md:text-sm dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:bg-zinc-950",
            error ? "border-[#E6212F]" : "border-zinc-300 dark:border-zinc-700",
          )}
        />
        {/* the brand CTA makes it unmistakably a search bar */}
        {/* the BrandButton sweep, in form-submit clothing */}
        <button
          type="submit"
          disabled={busy}
          className="group/search absolute right-2 top-1/2 -translate-y-1/2 overflow-hidden bg-[#E6212F] px-4 py-2.5 disabled:opacity-70 md:px-6 md:py-3"
        >
          <span
            aria-hidden
            className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover/search:scale-x-100"
          />
          <span className="relative z-10 flex items-center gap-2 text-sm font-semibold text-white transition-colors duration-300 group-hover/search:text-[#1F1F1F]">
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <>
                Search
                <ArrowRight className="h-4 w-4 text-[#1F1F1F] transition-colors duration-300 group-hover/search:text-[#E6212F]" />
              </>
            )}
          </span>
        </button>
      </form>

      {/* live suggestions: the entity the identifier resolves to, then the
          shared chain rows every explorer search uses */}
      {showHits && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
        <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">
          {error}
        </p>
      )}
    </div>
  );
}

/* Shared frame for the Primary Network's two featured chains: the argument
   on top, the live plate holding the floor, links out to each network. */
function ChainBoard({
  logo,
  title,
  links,
}: {
  logo: string;
  title: string;
  /** disabledNote renders the link grayed-out with the note as its tooltip */
  links: { label: string; href: string; primary?: boolean; disabledNote?: string }[];
}) {
  return (
    <Board divide={false} className="h-full">
      <div className="px-5 py-8 md:px-6 lg:py-9">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex items-center gap-3.5">
            <Image src={logo} alt="" width={36} height={36} className="rounded-full object-contain" />
            <h2 className="v2-display text-2xl text-zinc-900 dark:text-zinc-50 md:text-3xl">
              {title}
              <span className="text-[#E6212F]">.</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4 py-2">
            {links.map((link) =>
              link.disabledNote ? (
                <span
                  key={link.href}
                  role="link"
                  aria-disabled="true"
                  title={link.disabledNote}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 dark:text-zinc-600"
                >
                  {link.label}
                  <span className="font-medium normal-case tracking-normal text-zinc-400 dark:text-zinc-500">soon</span>
                </span>
              ) : link.primary ? (
                <BrandButton key={link.href} href={link.href}>
                  {link.label}
                </BrandButton>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {link.label}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </Board>
  );
}

/* The coordination layer: the chain the network itself runs on. */
function PlatformChainBoard() {
  return (
    <ChainBoard
      logo="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
      title="Platform Chain"
      links={[
        { label: "Explore Mainnet", href: "/explorer/mainnet/p-chain", primary: true },
        { label: "FUJI TESTNET", href: "/explorer/fuji/p-chain" },
      ]}
    />
  );
}

/* The execution layer: the shared EVM where most building starts. */
function ContractChainBoard() {
  return (
    <ChainBoard
      logo="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
      title="Contract Chain"
      links={[
        { label: "Explore Mainnet", href: "/explorer/mainnet/c-chain", primary: true },
        {
          label: "FUJI TESTNET",
          href: "/explorer/fuji/c-chain",
          // keep in sync with UNAVAILABLE_TESTNET in ExplorerSubnav.tsx
          disabledNote:
            "We're having trouble indexing the Fuji C-Chain right now — it'll be available later.",
        },
      ]}
    />
  );
}

/* Doors into every EVM chain's own explorer — validated against the P-Chain:
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
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] dark:text-zinc-600" />
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
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] dark:text-zinc-600" />
      </Link>
    </div>
  );
}

/* The network at a glance — the same figures the homepage ledger and
   /stats/overview report, read from the same feed (/api/overview-stats,
   60s repoll), so the portal can never disagree with the front door.
   The stake headline follows the homepage recipe exactly: Primary Network
   stake from validator-stats, spot price for USD, supply for the share. */

// money is set to the cent, always — a ledger doesn't round its own entries
const fmtUsd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface OverviewAggregate {
  totalTxCount: number;
  totalICMMessages: number;
  totalValidators: number;
  activeL1Count: number;
}

function TokenStack({ srcs }: { srcs: string[] }) {
  return (
    <span className="flex -space-x-1.5">
      {srcs.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          className="h-5 w-5 rounded-full bg-white object-contain p-px ring-2 ring-white dark:ring-zinc-950"
          loading="lazy"
        />
      ))}
    </span>
  );
}

function NetworkBoard() {
  const [agg, setAgg] = useState<OverviewAggregate | null>(null);
  const [stakeAvax, setStakeAvax] = useState<number | null>(null);
  const [avaxUsd, setAvaxUsd] = useState<number | null>(null);
  const [supply, setSupply] = useState<number | null>(null);
  const [defi, setDefi] = useState<{
    tvlUsd: number | null;
    stablesUsd: number | null;
    dexVolume30dUsd: number | null;
  }>({ tvlUsd: null, stablesUsd: null, dexVolume30dUsd: null });

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
        // an all-zero aggregate means the upstream cache is warming — keep
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
  // board's 60s clock until it lands — a tab opened during an API hiccup
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

  // on-chain capital — the homepage's exact llama.fi recipe, run client-side
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tvl, stables, dex] = await Promise.all([
        fetch("https://api.llama.fi/v2/chains")
          .then((r) => (r.ok ? r.json() : null))
          .then((rows) => rows?.find((c: { name: string; tvl?: number }) => c.name === "Avalanche")?.tvl ?? null)
          .catch(() => null),
        fetch("https://stablecoins.llama.fi/stablecoinchains")
          .then((r) => (r.ok ? r.json() : null))
          .then((rows) => {
            // sum every peg (USD, EUR, JPY, SGD, ...) — values are USD-denominated
            const pegs = rows?.find((c: { name: string }) => c.name === "Avalanche")?.totalCirculatingUSD;
            if (!pegs) return null;
            return Object.values(pegs).reduce(
              (sum: number, v) => sum + (typeof v === "number" && Number.isFinite(v) ? v : 0),
              0,
            );
          })
          .catch(() => null),
        fetch(
          "https://api.llama.fi/overview/dexs/avalanche?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.total30d ?? null)
          .catch(() => null),
      ]);
      if (cancelled) return;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
      setDefi({ tvlUsd: num(tvl), stablesUsd: num(stables), dexVolume30dUsd: num(dex) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stakeUsd = stakeAvax !== null && avaxUsd !== null ? stakeAvax * avaxUsd : null;
  const stakedPct = stakeAvax !== null && supply !== null ? (stakeAvax / supply) * 100 : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="divide-y divide-zinc-200 border border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
        {/* the homepage ledger strip: same labels, same destinations */}
        <div className="grid grid-cols-2 divide-x divide-zinc-200 lg:grid-cols-4 dark:divide-zinc-800">
          <StatCell label="Transactions · 30d" live href="/stats/network-metrics">
            {agg && agg.totalTxCount > 0 ? <StatFigure value={agg.totalTxCount} /> : <StatDash />}
          </StatCell>
          <StatCell label="Cross-chain msgs · 30d" live href="/explorer/mainnet/icm">
            {agg && agg.totalICMMessages > 0 ? <StatFigure value={agg.totalICMMessages} /> : <StatDash />}
          </StatCell>
          <StatCell label="Active L1s" href="/explorer/mainnet/chains">
            {agg && agg.activeL1Count > 0 ? <StatFigure value={agg.activeL1Count} /> : <StatDash />}
          </StatCell>
          <StatCell label="Validators" href="/explorer/mainnet/validators">
            {agg && agg.totalValidators > 0 ? <StatFigure value={agg.totalValidators} /> : <StatDash />}
          </StatCell>
        </div>

        {/* on-chain capital, as on the homepage board */}
        <div className="grid grid-cols-1 divide-y divide-zinc-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:divide-zinc-800">
          <Link
            href="/explorer/mainnet/apps"
            className="flex flex-col gap-1.5 px-5 py-6 transition-colors hover:bg-zinc-100 md:px-6 dark:hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                Stablecoins on-chain
              </span>
              <TokenStack srcs={["/logos/tokens/usdc.png", "/logos/tokens/usdt.png", "/logos/tokens/eurc.png", "/logos/tokens/jpyc.png", "/logos/tokens/xsgd.png"]} />
            </span>
            <span className="font-mono text-2xl tabular-nums tracking-tight text-zinc-900 md:text-[1.75rem] dark:text-zinc-50">
              {defi.stablesUsd !== null ? fmtUsd(defi.stablesUsd) : "—"}
            </span>
          </Link>
          <Link
            href="/explorer/mainnet/apps"
            className="flex flex-col gap-1.5 px-5 py-6 transition-colors hover:bg-zinc-100 md:px-6 dark:hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                DeFi TVL
              </span>
              <TokenStack srcs={["/logos/tokens/aave.png", "/logos/tokens/benqi.png", "/logos/tokens/gmx.png"]} />
            </span>
            <span className="font-mono text-2xl tabular-nums tracking-tight text-zinc-900 md:text-[1.75rem] dark:text-zinc-50">
              {defi.tvlUsd !== null ? fmtUsd(defi.tvlUsd) : "—"}
            </span>
          </Link>
          <Link
            href="/explorer/mainnet/apps"
            className="flex flex-col gap-1.5 px-5 py-6 transition-colors hover:bg-zinc-100 md:px-6 dark:hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
                </span>
                DEX volume · 30d
              </span>
              <TokenStack srcs={["/logos/tokens/uniswap.png", "/logos/tokens/lfj.png", "/logos/tokens/pharaoh.png"]} />
            </span>
            <span className="font-mono text-2xl tabular-nums tracking-tight text-zinc-900 md:text-[1.75rem] dark:text-zinc-50">
              {defi.dexVolume30dUsd !== null ? fmtUsd(defi.dexVolume30dUsd) : "—"}
            </span>
          </Link>
        </div>

        {/* the economic security headline, as on the homepage board */}
        <Link
          href="/explorer/mainnet/validators"
          className="flex flex-col justify-center gap-3 px-5 py-8 transition-colors hover:bg-zinc-100 md:px-6 dark:hover:bg-zinc-900"
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Stake securing the network
          </span>
          <span className="font-mono text-3xl tabular-nums tracking-tight text-zinc-900 sm:text-4xl md:text-5xl dark:text-zinc-50">
            {stakeUsd !== null
              ? fmtUsd(stakeUsd)
              : stakeAvax !== null
                ? `${stakeAvax.toLocaleString("en-US")} AVAX`
                : "—"}
          </span>
          {stakeUsd !== null && stakeAvax !== null && (
            <span className="font-mono text-xs tracking-[0.16em] text-zinc-600 dark:text-zinc-300">
              {stakeAvax.toLocaleString("en-US")} AVAX
              {stakedPct !== null && ` · ${stakedPct.toFixed(1)}% OF CIRCULATING SUPPLY`}
            </span>
          )}
        </Link>

        {/* board footer: the full instrument lives at /stats */}
        <Link
          href="/explorer/mainnet"
          className="group relative flex items-center justify-between overflow-hidden bg-[#E6212F] px-5 py-4 md:px-6"
        >
          <span
            aria-hidden
            className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100"
          />
          <span className="relative z-10 text-sm font-medium text-white transition-colors duration-300 group-hover:text-[#1F1F1F]">
            Explore all network stats
          </span>
          <ArrowRight className="relative z-10 h-4 w-4 text-white transition-colors duration-300 group-hover:text-[#E6212F]" />
        </Link>
      </div>
    </section>
  );
}

export default function ExplorerPortal() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      {/* the drafting-sheet triangle lattice, snowfall only — as on /solutions */}
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-24 pt-14 md:px-6">
        {/* top-to-bottom load sequence, as on the homepage and /solutions */}
        <header className="flex flex-col gap-9 pb-16 md:gap-10 md:pb-20">
          <Rise delay={0.05}>
            <h1 className="v2-display mt-4 text-center text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50">
              Every chain, observed<span className="text-[#E6212F]">.</span>
            </h1>
          </Rise>
          <Rise delay={0.12} className="mx-auto w-full max-w-5xl">
            <UniversalSearch />
          </Rise>
        </header>

        {/* the Primary Network's two chains, with the network itself
            turning beside them */}
        <Rise delay={0.18}>
          <section className="grid gap-4 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-center lg:gap-10">
            <div className="flex flex-col gap-4">
              <ContractChainBoard />
              <PlatformChainBoard />
            </div>
            <NetworkGlobe
              extended
              className="pointer-events-none hidden items-center justify-center lg:flex"
              sizeClassName="h-60 w-auto xl:h-72"
            />
          </section>
        </Rise>

        {/* the same numbers the homepage and /stats/overview report */}
        <Rise delay={0.26}>
          <NetworkBoard />
        </Rise>

        <Rise delay={0.32}>
          <section className="mt-14 flex flex-col gap-4">
            <SectionHeader label="L1 Explorers" />
            <ChainDoors />
          </section>
        </Rise>
      </div>
    </main>
  );
}
