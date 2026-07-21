"use client";

import { ReactNode, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { buildTxUrl } from "@/utils/eip3091";
import { lookupTransactionAcrossChains } from "@/lib/cross-chain-lookup";
import { hasRealChainLogo } from "@/lib/pchain-explorer";
import { ExplorerSubnav } from "@/components/explorer-v2/ExplorerSubnav";

interface AllChainsExplorerLayoutProps {
  children: ReactNode;
}

/* The all-chains directory chrome, in the explorer's drafting-sheet grammar:
   mono breadcrumb, display title with red period, hairline search. The
   cross-chain lookup races every chain's RPC for a tx hash and routes to
   whichever chain claims it. */
export function AllChainsExplorerLayout({ children }: AllChainsExplorerLayoutProps) {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // the ecosystem strip beside the title
  const chainsWithRpc = useMemo(() => {
    return (l1ChainsData as L1Chain[])
      .filter(chain => chain.isTestnet !== true)
      .filter(chain => chain.rpcUrl && hasRealChainLogo(chain.chainLogoURI))
      .slice(0, 12);
  }, []);
  const moreCount =
    (l1ChainsData as L1Chain[]).filter(c => c.rpcUrl && c.isTestnet !== true).length -
    chainsWithRpc.length;

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();

    if (!query) {
      setSearchError("Enter a transaction hash");
      return;
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(query)) {
      setSearchError("A transaction hash is 0x followed by 64 hex characters");
      return;
    }

    setSearchError(null);
    setIsSearching(true);
    try {
      const result = await lookupTransactionAcrossChains(query);
      if (result.found && result.chain) {
        router.push(buildTxUrl(`/explorer/mainnet/${result.chain.slug}`, query));
      } else {
        setSearchError("Not found on any supported chain");
      }
    } catch {
      setSearchError("Search failed, try again");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-4 pt-10 md:px-6">
        {/* the app's spine — chain-agnostic here, so just the switcher */}
        <ExplorerSubnav className="mb-8" />
        <header className="flex flex-col gap-6 pb-6">
          {/* title + the ecosystem riding beside it */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pl-0! pr-0!">
            <h1 className="v2-display -ml-[0.055em] text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[0.95] text-zinc-900 dark:text-zinc-50">
              All Chains<span className="text-[#E6212F]">.</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {chainsWithRpc.map((chain, idx) => (
                  <Link
                    key={chain.chainId}
                    href={`/explorer/mainnet/${chain.slug}`}
                    className="relative inline-block transition-transform hover:z-10 hover:scale-110"
                    style={{ zIndex: chainsWithRpc.length - idx }}
                    title={chain.chainName}
                  >
                    <Image
                      src={chain.chainLogoURI}
                      alt={chain.chainName}
                      width={26}
                      height={26}
                      className="rounded-full border border-zinc-200 bg-white object-contain dark:border-zinc-800 dark:bg-zinc-900"
                    />
                  </Link>
                ))}
              </div>
              {moreCount > 0 && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  +{moreCount} more
                </span>
              )}
            </div>
          </div>

          {/* cross-chain search — its own full-width row */}
          <div className="w-full">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(null);
                }}
                placeholder="Search a transaction hash (0x…) across every chain"
                spellCheck={false}
                className={cn(
                  "w-full border bg-white/80 py-3 pl-11 pr-12 font-mono text-[13px] text-zinc-900 outline-none backdrop-blur-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 md:py-3.5 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100",
                  searchError ? "border-[#E6212F]" : "border-zinc-200 dark:border-zinc-800",
                  isSearching && "opacity-60",
                )}
              />
              {isSearching && (
                <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-[#E6212F] dark:border-zinc-700" />
              )}
            </form>
            {searchError && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">{searchError}</p>
            )}
          </div>
        </header>
      </div>

      {/* Page Content */}
      {children}
    </main>
  );
}
