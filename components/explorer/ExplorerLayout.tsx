"use client";

import { ReactNode, useState, FormEvent, useMemo, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainHeader } from "@/components/explorer-v2/ChainHeader";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";
import { StatFigure } from "@/components/explorer-v2/ui";
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
  // Latest block for validation (optional)
  latestBlock?: number;
}

export function ExplorerLayout({
  chainName,
  chainSlug,
  chainLogoURI,
  description,
  website,
  socials,
  rpcUrl,
  children,
  loading = false,
  showSearch = false,
  latestBlock,
}: ExplorerLayoutProps) {
  const router = useRouter();
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
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setIsSearching(true);

    try {
      // Check if it's a block number (numeric string)
      if (/^\d+$/.test(query)) {
        const blockNum = parseInt(query);
        if (blockNum >= 0 && blockNum <= (latestBlock || Infinity)) {
          router.push(buildBlockUrl(`/explorer/mainnet/${chainSlug}`, query));
          return;
        } else {
          setSearchError("Block number not found");
          return;
        }
      }

      // Check if it's a transaction hash (0x + 64 hex chars = 66 total)
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        router.push(buildTxUrl(`/explorer/mainnet/${chainSlug}`, query));
        return;
      }

      // Check if it's an address (0x + 40 hex chars = 42 total)
      if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        router.push(buildAddressUrl(`/explorer/mainnet/${chainSlug}`, query));
        return;
      }

      // Check if it's a hex block number (0x...)
      if (/^0x[a-fA-F0-9]+$/.test(query) && query.length < 42) {
        const blockNum = parseInt(query, 16);
        if (!isNaN(blockNum) && blockNum >= 0) {
          router.push(buildBlockUrl(`/explorer/mainnet/${chainSlug}`, blockNum.toString()));
          return;
        }
      }

      // Show error for unrecognized format
      setSearchError("Not a block number, tx hash, or 0x address");
    } catch {
      setSearchError("Search failed, try again");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      {/* the drafting-sheet triangle lattice, snowfall only — visible in the
          margins; the content column is an opaque sheet laid on top of it,
          bounded by the vertical rules */}
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
      <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-4 pt-10 md:px-6">
        {/* the app's spine: chain switcher, section tabs, network. Rendered
            during loading too — the chain identity comes in via props. */}
        <ExplorerSubnav
          network="mainnet"
          chainSlug={chainSlug}
          chainName={chainName}
          chainLogoURI={chainLogoURI}
          className="mb-8"
        />
        {loading ? (
          // skeleton header, square pulses in the sheet's rhythm
          <header className="flex flex-col gap-6 pb-6">
            {/* pl-0!/pr-0! fight the global `header > div` padding hack */}
            <div className="flex items-center gap-4 pl-0! pr-0!">
              <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-10 w-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            </div>
            {showSearch && <div className="h-14 w-full animate-pulse bg-zinc-100 pl-0! pr-0! dark:bg-zinc-900" />}
          </header>
        ) : (
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
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
                      </span>
                      Tip Height
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
                hairline field, icon left, "/" affordance, Enter to submit */}
            {showSearch && (
              <div className="w-full pl-0! pr-0!">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    placeholder="Search by address, tx hash, or block number"
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
                {searchError && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">{searchError}</p>
                )}
              </div>
            )}
          </header>
        )}
      </div>

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
      <div className="relative">{children}</div>

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
