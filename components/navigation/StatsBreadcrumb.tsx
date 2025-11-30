"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronRight, Compass, Globe, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
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
  // Optional: Custom breadcrumb items to append after Explorer
  breadcrumbItems?: BreadcrumbItem[];
  // Optional: Theme color for active item icon
  themeColor?: string;
  // Optional: Additional CSS classes
  className?: string;
}

export function StatsBreadcrumb({
  chainSlug,
  chainName,
  chainLogoURI,
  showExplorer = false,
  showStats = false,
  breadcrumbItems = [],
  themeColor,
  className = "",
}: StatsBreadcrumbProps) {
  const router = useRouter();
  
  // Filter chains based on context
  const availableChains = useMemo(() => {
    if (showExplorer) {
      // On explorer page, only show chains with rpcUrl
      return (l1ChainsData as L1Chain[]).filter((chain) => chain.rpcUrl);
    } else if (showStats) {
      // On stats page, show all chains
      return l1ChainsData as L1Chain[];
    }
    return [];
  }, [showExplorer, showStats]);

  const handleChainSelect = (selectedSlug: string) => {
    if (showExplorer) {
      router.push(`/stats/l1/${selectedSlug}/explorer`);
    } else if (showStats) {
      router.push(`/stats/l1/${selectedSlug}/stats`);
    }
  };

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
      <nav className={`stats-breadcrumb flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 overflow-x-auto scrollbar-hide pb-1 ${className}`}>
        {/* Ecosystem - always shown as first item */}
        <Link 
          href="/stats/overview" 
          className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
        >
          <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Ecosystem</span>
        </Link>
        
        {chainSlug && chainName ? (
          <>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            {availableChains.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0">
                    {chainLogoURI && (
                      <img 
                        src={chainLogoURI} 
                        alt="" 
                        className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
                    <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[400px] overflow-y-auto">
                  {availableChains.map((chain) => (
                    <DropdownMenuItem
                      key={chain.chainId}
                      onClick={() => handleChainSelect(chain.slug)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {chain.chainLogoURI && (
                          <img 
                            src={chain.chainLogoURI} 
                            alt="" 
                            className="w-4 h-4 rounded-sm object-contain flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <span className={chainSlug === chain.slug ? "font-medium" : ""}>
                          {chain.chainName}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link 
                href={showExplorer ? `/stats/l1/${chainSlug}/explorer` : `/stats/l1/${chainSlug}/stats`} 
                className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                {chainLogoURI && (
                  <img 
                    src={chainLogoURI} 
                    alt="" 
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <span className="max-w-[80px] sm:max-w-none truncate">{chainName}</span>
              </Link>
            )}
            
            {showStats && (
              <>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
                  <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: themeColor }} />
                  <span>Stats</span>
                </span>
              </>
            )}
            
            {showExplorer && (
              <>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                {breadcrumbItems.length === 0 ? (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
                    <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: themeColor }} />
                    <span>Explorer</span>
                  </span>
                ) : (
                  <>
                    <Link 
                      href={`/stats/l1/${chainSlug}/explorer`} 
                      className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                    >
                      <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>Explorer</span>
                    </Link>
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
              </>
            )}
          </>
        ) : null}
      </nav>
    </>
  );
}

