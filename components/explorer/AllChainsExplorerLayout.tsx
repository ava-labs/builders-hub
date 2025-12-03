"use client";

import { ReactNode, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Globe, Search } from "lucide-react";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { buildTxUrl } from "@/utils/eip3091";

interface AllChainsExplorerLayoutProps {
  children: ReactNode;
}

// Lookup transaction hash across all chains with RPC URLs
async function lookupTransactionAcrossChains(txHash: string): Promise<{ found: boolean; chain?: L1Chain }> {
  const chainsWithRpc = (l1ChainsData as L1Chain[]).filter(chain => chain.rpcUrl);
  
  // Create lookup promises for all chains
  const lookupPromises = chainsWithRpc.map(async (chain) => {
    try {
      const response = await fetch(chain.rpcUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionByHash',
          params: [txHash],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout per chain
      });
      
      const data = await response.json();
      
      // If result is not null, transaction exists on this chain
      if (data.result && data.result.hash) {
        return { found: true, chain };
      }
      return { found: false };
    } catch {
      // Chain lookup failed, continue with others
      return { found: false };
    }
  });
  
  // Race all lookups - return first chain that finds the transaction
  // Using Promise.all and then checking results to find the first match
  const results = await Promise.all(lookupPromises);
  const foundResult = results.find(r => r.found);
  
  return foundResult || { found: false };
}

export function AllChainsExplorerLayout({ children }: AllChainsExplorerLayoutProps) {
  const router = useRouter();
  const themeColor = "#E84142"; // Avalanche red
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Get chains with RPC URLs (for overlapped logos display)
  const chainsWithRpc = useMemo(() => {
    return (l1ChainsData as L1Chain[])
      .filter(chain => chain.rpcUrl && chain.chainLogoURI)
      .slice(0, 12); // Show more chains for the all-chains view
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    
    if (!query) {
      setSearchError("Please enter a transaction hash");
      return;
    }

    // Validate transaction hash format (0x + 64 hex chars = 66 total)
    if (!/^0x[a-fA-F0-9]{64}$/.test(query)) {
      setSearchError("Invalid transaction hash format. Must be 0x followed by 64 hex characters.");
      return;
    }

    setSearchError(null);
    setIsSearching(true);

    try {
      const result = await lookupTransactionAcrossChains(query);
      
      if (result.found && result.chain) {
        // Redirect to the chain's transaction page
        router.push(buildTxUrl(`/explorer/${result.chain.slug}`, query));
      } else {
        setSearchError("Transaction not found on any supported chain.");
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient decoration */}
        <div 
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          {/* Breadcrumb - uses same component as L1 explorers */}
          <StatsBreadcrumb
            chainSlug="all-chains"
            chainName="All Chains"
            showExplorer={true}
            themeColor={themeColor}
          />

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                  <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142" />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                  {/* Chain logos - inline after ecosystem text */}
                  {chainsWithRpc.length > 0 && (
                    <div className="flex items-center gap-2 ml-2">
                      <div className="flex -space-x-2">
                        {chainsWithRpc.map((chain, idx) => (
                          <Link
                            key={chain.chainId}
                            href={`/explorer/${chain.slug}`}
                            className="relative inline-block cursor-pointer transition-transform hover:scale-110 hover:z-10"
                            style={{ zIndex: chainsWithRpc.length - idx }}
                            title={chain.chainName}
                          >
                            <Image
                              src={chain.chainLogoURI}
                              alt={chain.chainName}
                              width={24}
                              height={24}
                              className="rounded-full border-2 border-white dark:border-zinc-900 bg-white dark:bg-zinc-800 object-contain"
                            />
                          </Link>
                        ))}
                      </div>
                      {(l1ChainsData as L1Chain[]).filter(c => c.rpcUrl).length - chainsWithRpc.length > 0 && (
                        <span className="text-xs text-zinc-400">
                          +{(l1ChainsData as L1Chain[]).filter(c => c.rpcUrl).length - chainsWithRpc.length} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${themeColor}15` }}
                  >
                    <Globe className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" style={{ color: themeColor }} />
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    All Chains
                  </h1>
                </div>
                <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl mt-3">
                  Real-time activity across all Avalanche L1 chains - blocks, transactions, and cross-chain messages from the entire ecosystem.
                </p>
                
                {/* Search Bar */}
                <form onSubmit={handleSearch} className="max-w-2xl mt-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <Input
                      type="text"
                      placeholder="Search by Transaction Hash (0x...)"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchError(null);
                      }}
                      className={`pl-12 pr-24 h-12 text-sm rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-offset-0 ${
                        searchError ? 'border-red-500 dark:border-red-500' : ''
                      }`}
                    />
                    <Button
                      type="submit"
                      disabled={isSearching}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 sm:px-6 rounded-lg text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      style={{ backgroundColor: themeColor }}
                    >
                      {isSearching ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">Search</span>
                        </>
                      )}
                    </Button>
                  </div>
                  {searchError && (
                    <p className="text-red-500 text-sm mt-2">{searchError}</p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}

