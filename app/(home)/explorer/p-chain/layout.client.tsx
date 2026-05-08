"use client";

import { ReactNode, useState, useCallback, useMemo } from "react";
import { ArrowUpRight, Twitter, Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";

interface PChainExplorerLayoutClientProps {
  children: ReactNode;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const THEME_COLOR = "#E84142"; // Avalanche red

export function PChainExplorerLayoutClient({ children }: PChainExplorerLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const network = (searchParams.get('network') as 'mainnet' | 'fuji') || 'mainnet';
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Generate breadcrumb items based on current path
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    
    // Match sub-pages
    const blockMatch = pathname.match(/\/explorer\/p-chain\/block\/([^\/]+)/);
    const txMatch = pathname.match(/\/explorer\/p-chain\/tx\/([^\/]+)/);
    const addressMatch = pathname.match(/\/explorer\/p-chain\/address\/([^\/]+)/);
    const validatorsMatch = pathname === '/explorer/p-chain/validators';
    
    if (blockMatch) {
      const blockId = blockMatch[1];
      // Use Block # format like EVM chains
      items.push({ label: `Block #${blockId}` });
    } else if (txMatch) {
      const txId = txMatch[1];
      // Just show shortened hash like EVM chains (no "Tx" prefix)
      const shortId = txId.length > 16 ? `${txId.slice(0, 8)}...${txId.slice(-6)}` : txId;
      items.push({ label: shortId });
    } else if (addressMatch) {
      const address = addressMatch[1];
      const shortAddr = address.length > 20 ? `${address.slice(0, 10)}...${address.slice(-6)}` : address;
      items.push({ label: shortAddr });
    } else if (validatorsMatch) {
      items.push({ label: 'Validators' });
    }
    
    return items;
  }, [pathname]);

  // Check if we're on the home page (no sub-pages)
  const isHomePage = breadcrumbItems.length === 0;

  // Handle network change from breadcrumb dropdown
  const handleNetworkChange = useCallback((newNetwork: 'mainnet' | 'fuji') => {
    // Preserve current path but update network param
    const params = new URLSearchParams(searchParams.toString());
    params.set('network', newNetwork);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const handleSearch = async (e: React.FormEvent) => {
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
        router.push(`/explorer/p-chain/block/${query}?network=${network}`);
        return;
      }

      // Check if it's a transaction ID (CB58 format - alphanumeric, typically 50+ chars)
      if (/^[a-zA-Z0-9]{40,}$/.test(query)) {
        router.push(`/explorer/p-chain/tx/${query}?network=${network}`);
        return;
      }

      // Check if it's a P-Chain address (P-avax1... or P-fuji1...)
      if (/^P-[a-zA-Z0-9]+$/.test(query)) {
        router.push(`/explorer/p-chain/address/${query}?network=${network}`);
        return;
      }

      // Check if it's a Node ID
      if (/^NodeID-[a-zA-Z0-9]+$/.test(query)) {
        // For now, redirect to validators page with search
        router.push(`/explorer/p-chain/validators?network=${network}&search=${query}`);
        return;
      }

      // Show error for unrecognized format
      setSearchError("Please enter a valid block number, transaction ID, P-Chain address, or Node ID");
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
            background: `linear-gradient(to left, ${THEME_COLOR}35 0%, ${THEME_COLOR}20 40%, ${THEME_COLOR}08 70%, transparent 100%)`,
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          {/* Breadcrumb */}
          <StatsBreadcrumb
            chainSlug="p-chain"
            chainName="P-Chain"
            chainLogoURI={undefined}
            showExplorer={true}
            breadcrumbItems={breadcrumbItems}
            themeColor={THEME_COLOR}
            pchainNetwork={network}
            onPChainNetworkChange={handleNetworkChange}
          />

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142" />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Primary Network
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${THEME_COLOR}15` }}
                  >
                    <AvalancheLogo className="w-6 h-6 sm:w-8 sm:h-8" fill={THEME_COLOR} />
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    P-Chain Explorer
                  </h1>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                    Platform Chain - Coordinates validators, manages subnet creation, and handles staking on the Avalanche network.
                  </p>
                </div>
                
                {/* Search Bar - Only show on home page */}
                {isHomePage && (
                  <form onSubmit={handleSearch} className="max-w-2xl mt-6">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <Input
                        type="text"
                        placeholder="Search by Block, Transaction ID, Address, or Node ID"
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
                        style={{ backgroundColor: THEME_COLOR }}
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

            {/* Links */}
            <div className="hidden sm:flex flex-row items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
                >
                  <a href="https://www.avax.network/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                    Avalanche
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2 cursor-pointer"
                >
                  <a href="https://x.com/avaborschern" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="cursor-pointer">
                    <Twitter className="h-4 w-4" />
                  </a>
                </Button>
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

