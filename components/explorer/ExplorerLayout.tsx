"use client";

import { ReactNode, useState, FormEvent, useMemo, useEffect } from "react";
import { ArrowUpRight, Twitter, Linkedin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import l1ChainsData from "@/constants/l1-chains.json";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { L1Chain } from "@/types/stats";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain, findCustomChainBySlug } from "@/components/explorer/utils/chainConverter";

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
  // Optional breadcrumb items to append after "Explorer"
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
  themeColor = "#E57373",
  chainLogoURI,
  description,
  website,
  socials,
  rpcUrl,
  children,
  breadcrumbItems = [],
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

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    
    if (!query) {
      setSearchError("Please enter a search term");
      return;
    }

    setSearchError(null);
    setIsSearching(true);

    try {
      // Check if it's a block number (numeric string)
      if (/^\d+$/.test(query)) {
        const blockNum = parseInt(query);
        if (blockNum >= 0 && blockNum <= (latestBlock || Infinity)) {
          router.push(buildBlockUrl(`/explorer/${chainSlug}`, query));
          return;
        } else {
          setSearchError("Block number not found");
          return;
        }
      }

      // Check if it's a transaction hash (0x + 64 hex chars = 66 total)
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        router.push(buildTxUrl(`/explorer/${chainSlug}`, query));
        return;
      }

      // Check if it's an address (0x + 40 hex chars = 42 total)
      if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        router.push(buildAddressUrl(`/explorer/${chainSlug}`, query));
        return;
      }

      // Check if it's a hex block number (0x...)
      if (/^0x[a-fA-F0-9]+$/.test(query) && query.length < 42) {
        const blockNum = parseInt(query, 16);
        if (!isNaN(blockNum) && blockNum >= 0) {
          router.push(buildBlockUrl(`/explorer/${chainSlug}`, blockNum.toString()));
          return;
        }
      }

      // Show error for unrecognized format
      setSearchError("Please enter a valid block number, transaction hash, or address (0x...)");
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
          {loading ? (
            // Loading skeleton for header
            <>
              <div className="flex items-center gap-1.5 mb-4">
                <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                  <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="h-5 w-96 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                {showSearch && (
                  <div className="h-12 w-full max-w-2xl bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                )}
              </div>
            </>
          ) : (
            <>
              {/* Breadcrumb */}
              <StatsBreadcrumb
                chainSlug={chainSlug}
                chainName={chainName}
                chainLogoURI={chainLogoURI}
                showExplorer={true}
                breadcrumbItems={breadcrumbItems}
                themeColor={themeColor}
              />

              <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
                <div className="space-y-4 sm:space-y-6 flex-1">
                  <div>
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                      <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142" />
                      <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                        Avalanche Ecosystem
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      {chainLogoURI && (
                        <img
                          src={chainLogoURI}
                          alt={`${chainName} logo`}
                          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain rounded-xl"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        {chainName} Explorer
                      </h1>
                    </div>
                    {/* Blockchain ID and Subnet ID chips + Add to Wallet */}
                    {(currentChain?.subnetId || (currentChain as any)?.blockchainId || rpcUrl) && (
                      <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ChainIdChips 
                              subnetId={currentChain?.subnetId} 
                            blockchainId={currentChain?.blockchainId} 
                            />
                          </div>
                          {rpcUrl && (
                            <div className="flex-shrink-0">
                              <AddToWalletButton 
                                rpcUrl={rpcUrl}
                                chainName={chainName}
                                chainId={currentChain?.chainId ? parseInt(currentChain.chainId) : undefined}
                                tokenSymbol={currentChain?.networkToken?.symbol}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {description && (
                      <div className="flex items-center gap-3 mt-3">
                        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                          {description}
                        </p>
                      </div>
                    )}
                    {/* Mobile Social Links - shown below description */}
                    {(website || socials) && (
                      <div className="flex sm:hidden items-center gap-2 mt-4">
                        {website && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
                          >
                            <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                              Website
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {socials && (socials.twitter || socials.linkedin) && (
                          <>
                            {socials.twitter && (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2 cursor-pointer"
                              >
                                <a href={`https://x.com/${socials.twitter}`} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="cursor-pointer">
                                  <Twitter className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {socials.linkedin && (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2 cursor-pointer"
                              >
                                <a href={`https://linkedin.com/company/${socials.linkedin}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="cursor-pointer">
                                  <Linkedin className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {currentChain?.category && (
                      <div className="mt-3">
                        <span 
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${themeColor}15`,
                            color: themeColor,
                          }}
                        >
                          {currentChain.category}
                        </span>
                      </div>
                    )}
                    
                    {/* Search Bar */}
                    {showSearch && (
                      <form onSubmit={handleSearch} className="max-w-2xl mt-6">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                          <Input
                            type="text"
                            placeholder="Search by Address, Txn Hash, or Block Number"
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
                    )}
                  </div>
                </div>

                {/* Desktop Social Links - hidden on mobile */}
                {(website || socials) && (
                  <div className="hidden sm:flex flex-row items-end gap-2">
                    <div className="flex items-center gap-2">
                      {website && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
                        >
                          <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                            Website
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {socials && (socials.twitter || socials.linkedin) && (
                        <>
                          {socials.twitter && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2 cursor-pointer"
                            >
                              <a href={`https://x.com/${socials.twitter}`} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="cursor-pointer">
                                <Twitter className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {socials.linkedin && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2 cursor-pointer"
                            >
                              <a href={`https://linkedin.com/company/${socials.linkedin}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="cursor-pointer">
                                <Linkedin className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Glacier Support Warning Banner - only show after token data is loaded */}
      {!loading && !isTokenDataLoading && glacierSupported === false && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">Indexing support is not available for this chain.</span>{' '}
                Some functionalities like address portfolios, token transfers, and detailed transaction history may not be available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      {children}

      {/* Bottom Navigation */}
      <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} isCustomChain={!currentChain} />
    </div>
  );
}

