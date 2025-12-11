"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronRight, Compass, Globe, ChevronDown, Plus, Users, Home, Search, X } from "lucide-react";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { useModalTrigger } from "@/components/toolbox/hooks/useModal";
import type { AddChainResult } from "@/types/wallet";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

// Extended chain type for custom chains with testnet info
interface CustomChainForDropdown {
  chainId: string;
  chainName: string;
  chainLogoURI?: string;
  slug: string;
  isTestnet: boolean;
  isCustom: true;
}

interface StatsBreadcrumbProps {
  // Optional: If provided, shows chain breadcrumb
  chainSlug?: string;
  chainName?: string;
  chainLogoURI?: string;
  // Optional: Show explorer link as current page or as a link
  showExplorer?: boolean;
  // Optional: Show stats link as current page (for stats page)
  showStats?: boolean;
  // Optional: Show validators link (for validators page)
  showValidators?: boolean;
  // Optional: Custom breadcrumb items to append after Explorer
  breadcrumbItems?: BreadcrumbItem[];
  // Optional: Theme color for active item icon
  themeColor?: string;
  // Optional: Additional CSS classes
  className?: string;
}

// Generate initial from chain name (e.g., "My Custom Chain" -> "M")
function getChainInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  // Always use first letter of first word
  return words[0]?.[0]?.toUpperCase() || '?';
}

// Chain logo component with fallback to initial
function ChainLogo({ 
  src, 
  name, 
  size = "sm" 
}: { 
  src?: string; 
  name: string; 
  size?: "sm" | "md";
}) {
  const imgSizeClasses = size === "sm" 
    ? "w-4 h-4" 
    : "w-3 h-3 sm:w-3.5 sm:h-3.5";
  const textSizeClasses = size === "sm" 
    ? "text-xs" 
    : "text-[10px]";
  const containerClasses = `${imgSizeClasses} ${textSizeClasses} rounded-sm bg-zinc-200 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center font-medium text-zinc-600 dark:text-zinc-300`;
  
  if (src) {
    return (
      <img 
        src={src} 
        alt="" 
        className={`${imgSizeClasses} rounded-sm object-contain flex-shrink-0`}
        onError={(e) => { 
          // On error, replace with initial
          const target = e.target as HTMLImageElement;
          const parent = target.parentElement;
          if (parent) {
            const initialDiv = document.createElement('div');
            initialDiv.className = containerClasses;
            initialDiv.textContent = getChainInitials(name);
            parent.replaceChild(initialDiv, target);
          }
        }}
      />
    );
  }
  
  return (
    <div className={containerClasses}>
      {getChainInitials(name)}
    </div>
  );
}

export function StatsBreadcrumb({
  chainSlug,
  chainName,
  chainLogoURI,
  showExplorer = false,
  showStats = false,
  showValidators = false,
  breadcrumbItems = [],
  themeColor,
  className = "",
}: StatsBreadcrumbProps) {
  const router = useRouter();
  const { openModal } = useModalTrigger<AddChainResult>();
  const [customChains, setCustomChains] = useState<CustomChainForDropdown[]>([]);
  const [chainSearchTerm, setChainSearchTerm] = useState("");
  const navRef = useRef<HTMLElement>(null);
  
  const handleAddCustomChain = async () => {
    try {
      const result = await openModal();
      if (result?.success && result?.chainData) {
        // Chain was added successfully, the dropdown will update automatically via the store subscription
        // Optionally navigate to the new chain's explorer
        router.push(`/explorer/${result.chainData.id}`);
      }
    } catch (error) {
      // Modal was closed or cancelled, do nothing
    }
  };
  
  // Load custom chains from localStorage on mount
  useEffect(() => {
    const testnetStore = getL1ListStore(true);
    const mainnetStore = getL1ListStore(false);
    
    const testnetChains: L1ListItem[] = testnetStore.getState().l1List;
    const mainnetChains: L1ListItem[] = mainnetStore.getState().l1List;
    
    // Get all static chain identifiers for conflict checking
    const staticChainIds = new Set((l1ChainsData as L1Chain[]).map(c => c.chainId));
    const staticSlugs = new Set((l1ChainsData as L1Chain[]).map(c => c.slug));
    
    // Convert and filter custom chains (exclude those that conflict with static chains)
    const allCustomChains = [...testnetChains, ...mainnetChains];
    const filteredCustomChains: CustomChainForDropdown[] = allCustomChains
      .filter(item => {
        // Check for conflicts with static chains by chainId or slug
        const hasChainIdConflict = staticChainIds.has(String(item.evmChainId));
        const hasSlugConflict = staticSlugs.has(item.id);
        
        // Exclude if there's any conflict (chain exists in static data)
        return !hasChainIdConflict && !hasSlugConflict;
      })
      .map(item => ({
        chainId: String(item.evmChainId),
        chainName: item.name,
        chainLogoURI: item.logoUrl,
        slug: item.id, // Use blockchain ID as slug
        isTestnet: item.isTestnet,
        isCustom: true as const,
      }));
    
    setCustomChains(filteredCustomChains);
    
    // Subscribe to store changes
    const unsubTestnet = testnetStore.subscribe(() => {
      const chains = testnetStore.getState().l1List;
      const filtered = chains
        .filter((item: L1ListItem) => {
          const hasChainIdConflict = staticChainIds.has(String(item.evmChainId));
          const hasSlugConflict = staticSlugs.has(item.id);
          return !hasChainIdConflict && !hasSlugConflict;
        })
        .map((item: L1ListItem) => ({
          chainId: String(item.evmChainId),
          chainName: item.name,
          chainLogoURI: item.logoUrl,
          slug: item.id,
          isTestnet: item.isTestnet,
          isCustom: true as const,
        }));
      
      setCustomChains(prev => {
        const mainnetOnly = prev.filter(c => !c.isTestnet);
        return [...filtered, ...mainnetOnly];
      });
    });
    
    const unsubMainnet = mainnetStore.subscribe(() => {
      const chains = mainnetStore.getState().l1List;
      const filtered = chains
        .filter((item: L1ListItem) => {
          const hasChainIdConflict = staticChainIds.has(String(item.evmChainId));
          const hasSlugConflict = staticSlugs.has(item.id);
          return !hasChainIdConflict && !hasSlugConflict;
        })
        .map((item: L1ListItem) => ({
          chainId: String(item.evmChainId),
          chainName: item.name,
          chainLogoURI: item.logoUrl,
          slug: item.id,
          isTestnet: item.isTestnet,
          isCustom: true as const,
        }));
      
      setCustomChains(prev => {
        const testnetOnly = prev.filter(c => c.isTestnet);
        return [...testnetOnly, ...filtered];
      });
    });
    
    return () => {
      unsubTestnet();
      unsubMainnet();
    };
  }, []);
  
  // Filter chains based on context
  const availableChains = useMemo(() => {
    if (showExplorer) {
      // On explorer page, only show chains with rpcUrl
      return (l1ChainsData as L1Chain[]).filter((chain) => chain.rpcUrl);
    } else if (showStats || showValidators) {
      // On stats/validators page, show all chains
      return l1ChainsData as L1Chain[];
    }
    return [];
  }, [showExplorer, showStats, showValidators]);

  const handleChainSelect = (selectedSlug: string) => {
    if (showExplorer) {
      router.push(`/explorer/${selectedSlug}`);
    } else if (showStats) {
      router.push(`/stats/l1/${selectedSlug}`);
    } else if (showValidators) {
      router.push(`/stats/validators/${selectedSlug}`);
    }
  };

  // Scroll to last breadcrumb item on mobile
  useEffect(() => {
    if (!navRef.current) return;

    // Only scroll on mobile (screen width < 640px)
    const isMobile = window.innerWidth < 640;
    if (!isMobile) return;

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      if (navRef.current) {
        // Scroll to the end (right side) of the breadcrumb
        navRef.current.scrollTo({
          left: navRef.current.scrollWidth,
          behavior: 'smooth',
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [chainSlug, chainName, breadcrumbItems, showExplorer, showStats, showValidators]);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        nav.stats-breadcrumb a,
        nav.stats-breadcrumb a:hover,
        nav.stats-breadcrumb a:focus,
        nav.stats-breadcrumb a:active,
        nav.stats-breadcrumb a[data-active="true"],
        nav.stats-breadcrumb a[aria-current="page"] {
          padding: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          border-radius: 0 !important;
          background-color: transparent !important;
          background: transparent !important;
          box-shadow: none !important;
          transform: none !important;
          cursor: pointer !important;
        }
        nav.stats-breadcrumb button[data-state] {
          background-color: rgb(244 244 245) !important;
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
          padding-top: 0.375rem !important;
          padding-bottom: 0.375rem !important;
        }
        nav.stats-breadcrumb button[data-state]:hover {
          background-color: rgb(228 228 231) !important;
        }
        .dark nav.stats-breadcrumb button[data-state] {
          background-color: rgb(39 39 42) !important;
        }
        .dark nav.stats-breadcrumb button[data-state]:hover {
          background-color: rgb(63 63 70) !important;
        }
      `}} />
      <nav ref={navRef} className={`stats-breadcrumb flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 pb-1 ${className}`}>
        {/* Ecosystem - always shown as first item */}
        <Link 
          href="/stats/overview" 
          className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
        >
          <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Ecosystem</span>
        </Link>
        
        {/* Stats page: Ecosystem → Stats → Chain (with dropdown) */}
        {showStats && chainSlug && chainName && (
          <>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {/* Stats - not clickable */}
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
              <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Stats</span>
            </span>
            
            {/* Chain dropdown - current page */}
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {availableChains.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0">
                    {chainSlug === 'all' || chainSlug === 'all-chains' || chainSlug === 'network-metrics' ? (
                      <AvalancheLogo className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="#E84142" />
                    ) : (
                      <ChainLogo src={chainLogoURI} name={chainName} size="md" />
                    )}
                    <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
                    <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[500px] w-64 flex flex-col p-0" onCloseAutoFocus={() => setChainSearchTerm("")}>
                  {/* Sticky search header */}
                  <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 z-10">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search chains..."
                        value={chainSearchTerm}
                        onChange={(e) => setChainSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-8 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                        onClick={(e) => e.stopPropagation()}
                        autoComplete="off"
                      />
                      {chainSearchTerm && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChainSearchTerm("");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Scrollable content */}
                  <div className="overflow-y-auto flex-1 py-1">
                    {/* All Chains option */}
                    {(!chainSearchTerm || "all chains".includes(chainSearchTerm.toLowerCase())) && (
                      <DropdownMenuItem
                        onClick={() => router.push('/stats/network-metrics')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <AvalancheLogo className="w-4 h-4" fill="#E84142" />
                          <span className={chainSlug === 'all' || chainSlug === 'all-chains' || chainSlug === 'network-metrics' ? "font-medium" : ""}>
                            All Chains
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )}
                    
                    {/* Mainnet chains section */}
                    {(() => {
                      const mainnetChains = availableChains
                        .filter((chain) => !chain.isTestnet && chain.chainId !== "43113")
                        .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                      
                      if (mainnetChains.length === 0) return null;
                      
                      return (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Mainnet
                          </div>
                          {mainnetChains.map((chain) => (
                            <DropdownMenuItem
                              key={chain.chainId}
                              onClick={() => handleChainSelect(chain.slug)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                  {chain.chainName}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      );
                    })()}
                    
                    {/* Testnet chains section */}
                    {(() => {
                      const testnetChains = availableChains
                        .filter((chain) => chain.isTestnet || chain.chainId === "43113")
                        .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                      
                      if (testnetChains.length === 0) return null;
                      
                      return (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Testnet
                          </div>
                          {testnetChains.map((chain) => (
                            <DropdownMenuItem
                              key={chain.chainId}
                              onClick={() => handleChainSelect(chain.slug)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                  {chain.chainName}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
                {chainSlug === 'all' || chainSlug === 'all-chains' || chainSlug === 'network-metrics' ? (
                  <AvalancheLogo className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="#E84142" />
                ) : (
                  <ChainLogo src={chainLogoURI} name={chainName} size="md" />
                )}
                <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
              </span>
            )}
          </>
        )}
        
        {/* Validators page: Ecosystem → Validators → Chain (with dropdown) */}
        {showValidators && chainSlug && chainName && (
          <>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {/* Validators - clickable link back to validators list */}
            <Link 
              href="/stats/validators" 
              className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Validators</span>
            </Link>
            
            {/* Chain dropdown - current page */}
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {availableChains.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0">
                    <ChainLogo src={chainLogoURI} name={chainName} size="md" />
                    <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
                    <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[500px] w-64 flex flex-col p-0" onCloseAutoFocus={() => setChainSearchTerm("")}>
                  {/* Sticky search header */}
                  <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 z-10">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search chains..."
                        value={chainSearchTerm}
                        onChange={(e) => setChainSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-8 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                        onClick={(e) => e.stopPropagation()}
                        autoComplete="off"
                      />
                      {chainSearchTerm && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChainSearchTerm("");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Scrollable content */}
                  <div className="overflow-y-auto flex-1 py-1">
                    {/* Mainnet chains section */}
                    {(() => {
                      const mainnetChains = availableChains
                        .filter((chain) => !chain.isTestnet && chain.chainId !== "43113")
                        .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                      
                      if (mainnetChains.length === 0) return null;
                      
                      return (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Mainnet
                          </div>
                          {mainnetChains.map((chain) => (
                            <DropdownMenuItem
                              key={chain.chainId}
                              onClick={() => handleChainSelect(chain.slug)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                  {chain.chainName}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      );
                    })()}
                    
                    {/* Testnet chains section */}
                    {(() => {
                      const testnetChains = availableChains
                        .filter((chain) => chain.isTestnet || chain.chainId === "43113")
                        .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                      
                      if (testnetChains.length === 0) return null;
                      
                      return (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Testnet
                          </div>
                          {testnetChains.map((chain) => (
                            <DropdownMenuItem
                              key={chain.chainId}
                              onClick={() => handleChainSelect(chain.slug)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                  {chain.chainName}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
                <ChainLogo src={chainLogoURI} name={chainName} size="md" />
                <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
              </span>
            )}
          </>
        )}
        
        {/* Explorer page: Ecosystem → Explorer → Chain (with dropdown) */}
        {showExplorer && chainSlug && chainName && (
          <>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {/* Explorer - clickable link to All Chains Explorer */}
            <Link 
              href="/explorer" 
              className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Explorer</span>
            </Link>
            
            {/* Chain dropdown - always shown after Explorer */}
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {availableChains.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-md ${breadcrumbItems.length > 0 ? 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'} hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0`}>
                        {chainSlug === 'all-chains' ? (
                          <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500 flex-shrink-0" />
                        ) : (
                          <ChainLogo src={chainLogoURI} name={chainName} size="md" />
                        )}
                        <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
                        <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[500px] w-64 flex flex-col p-0" onCloseAutoFocus={() => setChainSearchTerm("")}>
                      {/* Sticky search header */}
                      <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 z-10">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search chains..."
                            value={chainSearchTerm}
                            onChange={(e) => setChainSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-8 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                            onClick={(e) => e.stopPropagation()}
                            autoComplete="off"
                          />
                          {chainSearchTerm && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChainSearchTerm("");
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Scrollable content */}
                      <div className="overflow-y-auto flex-1 py-1">
                        {/* All Chains option */}
                        {(!chainSearchTerm || "all chains".includes(chainSearchTerm.toLowerCase())) && (
                          <DropdownMenuItem
                            onClick={() => router.push('/explorer')}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Globe className="w-4 h-4 text-red-500" />
                              <span className={chainSlug === 'all-chains' ? "font-medium" : ""}>
                                All Chains
                              </span>
                            </div>
                          </DropdownMenuItem>
                        )}
                        
                        {/* Mainnet chains section */}
                        {(() => {
                          const mainnetChains = availableChains
                            .filter((chain) => !chain.isTestnet && chain.chainId !== "43113")
                            .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                          
                          if (mainnetChains.length === 0) return null;
                          
                          return (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Mainnet
                              </div>
                              {mainnetChains.map((chain) => (
                                <DropdownMenuItem
                                  key={chain.chainId}
                                  onClick={() => handleChainSelect(chain.slug)}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                    <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                      {chain.chainName}
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </>
                          );
                        })()}
                        
                        {/* Testnet chains section */}
                        {(() => {
                          const testnetChains = availableChains
                            .filter((chain) => chain.isTestnet || chain.chainId === "43113")
                            .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                          
                          if (testnetChains.length === 0) return null;
                          
                          return (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Testnet
                              </div>
                              {testnetChains.map((chain) => (
                                <DropdownMenuItem
                                  key={chain.chainId}
                                  onClick={() => handleChainSelect(chain.slug)}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                    <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                      {chain.chainName}
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </>
                          );
                        })()}
                        
                        {/* Custom chains section */}
                        {(() => {
                          const filteredCustomChains = customChains
                            .filter((chain) => !chainSearchTerm || chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()));
                          
                          return (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Console
                              </div>
                              {filteredCustomChains.length > 0 ? (
                                filteredCustomChains.map((chain) => (
                                  <DropdownMenuItem
                                    key={`custom-${chain.slug}`}
                                    onClick={() => handleChainSelect(chain.slug)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <ChainLogo src={chain.chainLogoURI} name={chain.chainName} />
                                      <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                                        {chain.chainName}
                                      </span>
                                      {chain.isTestnet && (
                                        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                          Testnet
                                        </span>
                                      )}
                                    </div>
                                  </DropdownMenuItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                                  {chainSearchTerm ? "No matching chains" : "No custom chains yet"}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Sticky footer */}
                      <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-1">
                        <DropdownMenuItem
                          onClick={handleAddCustomChain}
                          className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4" />
                            <span className="font-medium">Add Custom Chain</span>
                          </div>
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
                    <ChainLogo src={chainLogoURI} name={chainName} size="md" />
                    <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
                  </span>
                )}
            
            {/* Home link - shown when on inner pages (block, tx, address) */}
            {breadcrumbItems.length > 0 && chainSlug !== 'all-chains' && (
              <>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                <Link 
                  href={`/explorer/${chainSlug}`}
                  className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Home</span>
                </Link>
              </>
                )}
            
            {/* Additional breadcrumb items (block, tx, address pages) */}
            {breadcrumbItems.map((item, idx) => (
              <span key={idx} className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600" />
                {item.href ? (
                  <Link 
                    href={item.href}
                    className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap max-w-[100px] sm:max-w-none truncate"
                  >
                    {item.icon && <span className="inline-flex items-center">{item.icon}</span>}
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap max-w-[100px] sm:max-w-none truncate cursor-default">
                    {item.icon && <span className="inline-flex items-center">{item.icon}</span>}
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </>
        )}
      </nav>
    </>
  );
}

