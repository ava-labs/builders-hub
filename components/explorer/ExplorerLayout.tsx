"use client";

import { ReactNode, useState, FormEvent, useMemo, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainHeader } from "@/components/explorer-v2/ChainHeader";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { Rise, StatFigure } from "@/components/explorer-v2/ui";
import { classifyLocally, pchainApiPath, type SearchResult } from "@/lib/pchain-explorer";
import {
  ChainHitRow,
  EntityHitRow,
  matchChains,
  looksLikeIdentifier,
  useSearchEntity,
  type ChainHit,
} from "@/components/explorer-v2/chain-search";
import { useLiveValidatorCounts } from "@/components/explorer-v2/validator-stats";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain, findCustomChainBySlug } from "@/components/explorer/utils/chainConverter";

/* ------------------------------------------------------------------ */
/* Per-L1 explorer chrome, in the drafting-sheet grammar shared with    */
/* the portal and the P-Chain explorer: mono breadcrumb, display title  */
/* with the red period, hairline search with the brand-sweep CTA. Chain */
/* theme colors stay out of the chrome; the sheet is neutral plus red.  */
/* ------------------------------------------------------------------ */

interface ExplorerLayoutProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor?: string;
  chainLogoURI?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  rpcUrl?: string;
  children: ReactNode;
  // Accepted for compatibility; the subnav rail replaced the breadcrumb.
  breadcrumbItems?: Array<{ label: string; href?: string }>;
  // Loading state - shows skeleton header
  loading?: boolean;
  // Show search bar in header (only for explorer home)
  showSearch?: boolean;
  // Drop the chain-identity header (ChainHeader + search) entirely — for
  // detail subpages that carry their own title and breadcrumb back up
  hideHeader?: boolean;
  // Latest block for validation (optional)
  latestBlock?: number;
}

export function ExplorerLayout({
  chainName,
  chainSlug,
  themeColor,
  chainLogoURI,
  description,
  website,
  socials,
  rpcUrl,
  children,
  loading = false,
  showSearch = false,
  hideHeader = false,
  latestBlock,
}: ExplorerLayoutProps) {
  // L1s wear their own brand color as the accent (live dots, tape cube,
  // active tab bar) via --chain-accent; every consumer falls back to the
  // Avalanche red, which is what the C-Chain and P-Chain keep.
  const accent = chainSlug !== "c-chain" ? themeColor : undefined;
  const router = useRouter();
  // the URL's network segment scopes every link this page builds — a Fuji
  // deployment's explorer must not leak back to its mainnet twin
  const params = useParams();
  const network = typeof params?.network === "string" ? params.network : "mainnet";
  const { glacierSupported, isTokenDataLoading } = useExplorer();

  // State for custom chain (loaded from localStorage on client)
  const [customChain, setCustomChain] = useState<L1Chain | null>(null);

  // Load custom chain from localStorage on mount (client-side only)
  useEffect(() => {
    // First check if it's in l1ChainsData (static chains)
    const staticChain = l1ChainsData.find((chain) => chain.slug === chainSlug);
    if (staticChain) {
      return; // No need to check custom chains
    }

    // Check custom chains from localStorage
    const testnetStore = getL1ListStore(true);
    const mainnetStore = getL1ListStore(false);

    const testnetChains: L1ListItem[] = testnetStore.getState().l1List;
    const mainnetChains: L1ListItem[] = mainnetStore.getState().l1List;

    const allChains = [...testnetChains, ...mainnetChains];
    const foundCustomChain = findCustomChainBySlug(allChains, chainSlug);

    if (foundCustomChain) {
      setCustomChain(convertL1ListItemToL1Chain(foundCustomChain));
    }
  }, [chainSlug]);

  // Find the current chain - check static chains first, then custom chains
  const currentChain = useMemo(() => {
    const staticChain = l1ChainsData.find((chain) => chain.slug === chainSlug) as L1Chain | undefined;
    if (staticChain) return staticChain;
    return customChain || undefined;
  }, [chainSlug, customChain]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sel, setSel] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // chain suggestions — same engine and rows as the portal and P-Chain
  // shell, so a name, chain ID, subnet ID, or blockchain ID finds its
  // chain from any page. Liveness (ranking + validators) loads on demand.
  const { live: liveValidators } = useLiveValidatorCounts("mainnet", searchQuery.trim().length >= 2);
  const hits = useMemo(() => matchChains(searchQuery, liveValidators), [searchQuery, liveValidators]);

  // what the identifier in the box resolves to — tx hashes race every
  // chain live, so the dropdown names the chain before Enter is pressed
  const entity = useSearchEntity(searchQuery, {
    network,
    blockBase: `/explorer/${network}/${chainSlug}`,
    blockChainName: chainName,
    evmAddressBase: `/explorer/${network}/${chainSlug}`,
    evmAddressChainName: chainName,
  });
  const showHits = searchFocused && !!searchQuery.trim() && (hits.length > 0 || entity !== null);

  const goToHref = (href: string) => {
    setSearchQuery("");
    setSel(-1);
    setSearchError(null);
    searchInputRef.current?.blur();
    router.push(href);
  };

  const goToChain = (hit: ChainHit) => goToHref(hit.href);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showHits) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s <= 0 ? hits.length - 1 : s - 1));
    } else if (e.key === "Escape") {
      setSel(-1);
      searchInputRef.current?.blur();
    }
  };

  // "/" focuses the search from anywhere on the page (matches the P-Chain shell)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // live tip height straight from the chain's RPC — the same instrument the
  // P-Chain overview wears top-right. Overview only (like the P-Chain), and
  // the poll pauses while the tab is hidden.
  const [tipHeight, setTipHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!rpcUrl || !showSearch) return;
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        });
        const json = await res.json();
        if (!cancelled && json?.result) setTipHeight(parseInt(json.result, 16));
      } catch {
        /* the hero is additive — the header stands without it */
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [rpcUrl, showSearch]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();

    if (!query) {
      setSearchError("Enter a block number, tx hash, or address");
      return;
    }

    setSearchError(null);

    // a highlighted chain wins the Enter key; a name-like query's top hit
    // wins too — but identifier shapes (heights, hashes, IDs) keep their
    // plain-Enter classification even while chain rows are on offer
    if (hits.length > 0 && (sel >= 0 || !looksLikeIdentifier(query))) {
      goToChain(hits[Math.max(0, sel)].chain);
      return;
    }

    setIsSearching(true);

    try {
      // Check if it's a block number (numeric string)
      if (/^\d+$/.test(query)) {
        const blockNum = parseInt(query);
        if (blockNum >= 0 && blockNum <= (latestBlock || Infinity)) {
          router.push(buildBlockUrl(`/explorer/${network}/${chainSlug}`, query));
          return;
        } else {
          setSearchError("Block number not found");
          return;
        }
      }

      // Check if it's a transaction hash (0x + 64 hex chars = 66 total)
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        router.push(buildTxUrl(`/explorer/${network}/${chainSlug}`, query));
        return;
      }

      // Check if it's an address (0x + 40 hex chars = 42 total)
      if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        router.push(buildAddressUrl(`/explorer/${network}/${chainSlug}`, query));
        return;
      }

      // Check if it's a hex block number (0x...)
      if (/^0x[a-fA-F0-9]+$/.test(query) && query.length < 42) {
        const blockNum = parseInt(query, 16);
        if (!isNaN(blockNum) && blockNum >= 0) {
          router.push(buildBlockUrl(`/explorer/${network}/${chainSlug}`, blockNum.toString()));
          return;
        }
      }

      // One search, whole platform: P-Chain shapes (NodeID-, P-avax1…)
      // route straight to the P-Chain explorer…
      const pchain = classifyLocally(query);
      if (pchain && pchain.type !== "block") {
        router.push(`/explorer/${network}/p-chain/${pchain.type}/${pchain.id}`);
        return;
      }

      // …and ambiguous identifiers (CB58 tx/block/subnet ids) ask the
      // P-Chain search API before we give up
      const res = await fetch(pchainApiPath("mainnet", "search", { q: query }));
      const r: SearchResult = res.ok ? await res.json() : { type: "none", id: query };
      if (r.type !== "none") {
        router.push(`/explorer/${network}/p-chain/${r.type}/${r.id}`);
        return;
      }

      // Show error for unrecognized format
      setSearchError("Nothing on Avalanche matched that identifier");
    } catch {
      setSearchError("Search failed, try again");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950"
      style={accent ? ({ "--chain-accent": accent } as React.CSSProperties) : undefined}
    >
      {/* the drafting-sheet triangle lattice, snowfall only — visible in the
          margins; the content column is an opaque sheet laid on top of it,
          bounded by the vertical rules */}
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white pt-10 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
      {/* the app's spine: chain switcher, section tabs, network. Rendered
          during loading too — the chain identity comes in via props. Hoisted
          out of the header box below: a sticky element only pins while its
          parent is on screen, so its parent must be this full-height column,
          not a box that ends with the header. */}
      {/* z-[35]: above page content, under the global navbar's menus (z-40) */}
      <div className="sticky top-[calc(var(--fd-banner-height,0px)+3.5rem)] z-[35]">
        <div className="mx-auto w-full max-w-[90rem] px-5 md:px-6">
          <ExplorerSubnav
            network={network}
            chainSlug={chainSlug}
            chainName={chainName}
            chainLogoURI={chainLogoURI}
          />
        </div>
      </div>
      {!hideHeader && (
      <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-4 pt-8 md:px-6">
        {loading ? (
          // skeleton header, square pulses in the sheet's rhythm
          <header className="flex flex-col gap-6 pb-6">
            {/* pl-0!/pr-0! fight the global `header > div` padding hack */}
            <div className="flex items-center gap-4 pl-0! pr-0!">
              <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-10 w-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <div className="h-14 w-full animate-pulse bg-zinc-100 pl-0! pr-0! dark:bg-zinc-900" />
          </header>
        ) : (
          // Rise wraps the <header> from OUTSIDE so its div never becomes a
          // `header > div` (the global navbar padding hack)
          <Rise delay={0.05}>
          <header className="flex flex-col gap-6 pb-6">
            {/* chain identity — shared with the stats surfaces */}
            <ChainHeader
              chainName={chainName}
              chainLogoURI={chainLogoURI}
              website={website}
              socials={socials}
              subnetId={currentChain?.subnetId}
              blockchainId={currentChain?.blockchainId}
              aside={
                showSearch && tipHeight !== null ? (
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--chain-accent,#E6212F)] opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--chain-accent,#E6212F)]" />
                      </span>
                      Chain Height
                    </span>
                    <StatFigure value={tipHeight} className="text-3xl md:text-[2.5rem]" />
                  </div>
                ) : undefined
              }
              wallet={
                rpcUrl
                  ? {
                      rpcUrl,
                      chainId: currentChain?.chainId ? parseInt(currentChain.chainId) : undefined,
                      tokenSymbol: currentChain?.networkToken?.symbol,
                    }
                  : undefined
              }
            />

            {/* search — identical grammar to the P-Chain shell's SearchBox:
                hairline field, icon left, "/" affordance, Enter to submit.
                Rendered on EVERY tab; only the tip-height aside and the
                colophon are overview-only. */}
            <div className="relative w-full pl-0! pr-0!">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                      setSel(-1);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Search chains by name or ID, block, tx hash, address, or any P-Chain ID"
                    spellCheck={false}
                    className={cn(
                      "w-full border bg-white/80 py-3 pl-11 pr-12 font-mono text-[13px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 md:py-3.5 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100",
                      searchError ? "border-[#E6212F]" : "border-zinc-200 dark:border-zinc-800",
                      isSearching && "opacity-60",
                    )}
                  />
                  {!searchQuery && (
                    <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 md:block dark:border-zinc-800 dark:text-zinc-500">
                      /
                    </kbd>
                  )}
                </form>
                {/* live suggestions: the entity the identifier resolves to,
                    then the shared chain rows every explorer search uses */}
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
                {searchError && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">{searchError}</p>
                )}
              </div>
          </header>
          </Rise>
        )}
      </div>
      )}

      {/* Glacier Support Warning - the sheet's voice: square, mono, edge bar */}
      {!loading && !isTokenDataLoading && glacierSupported === false && (
        <div className="relative mx-auto w-full max-w-[90rem] px-5 md:px-6">
          <div className="flex items-start gap-4 border border-zinc-200 border-l-2 border-l-amber-500 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:border-l-amber-500 dark:bg-zinc-950/80">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-500">
                No indexing support
              </span>{" "}
              <span className="block mt-1">
                Address portfolios, token transfers, and detailed transaction history may not be available for this chain.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Page Content — relative so it paints above the fixed snow canvas */}
      <Rise delay={0.14} className="relative">{children}</Rise>

      {/* the chain's story reads as a colophon, not a header blurb — only on
          the overview page, where someone might actually be meeting the chain */}
      {!loading && showSearch && description && (
        <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-16 pt-4 md:px-6">
          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              About {chainName}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
