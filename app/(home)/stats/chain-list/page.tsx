"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  X,
  ChevronDown,
  Globe,
  ChevronRight,
  Wallet,
  Network,
  Filter,
  BarChart3,
  Eye,
  Twitter,
  Linkedin,
} from "lucide-react";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { CategoryChip } from "@/components/stats/CategoryChip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain } from "@/components/explorer/utils/chainConverter";
import { toast } from "@/lib/toast";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";

interface ChainListItem extends L1Chain {
  isCustom?: boolean;
}

export default function ChainListPage() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<"mainnet" | "testnet" | "console">("mainnet");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [hideWithoutRpc, setHideWithoutRpc] = useState(true);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Load custom chains from localStorage
  const [customChains, setCustomChains] = useState<L1Chain[]>([]);
  
  // Track Glacier support for each chain
  const [glacierSupportMap, setGlacierSupportMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    setIsMounted(true);
    
    // Load custom chains from console (filter out chains that already exist in static data)
    try {
      const testnetStore = getL1ListStore(true);
      const mainnetStore = getL1ListStore(false);
      
      const testnetChains: L1ListItem[] = testnetStore.getState().l1List;
      const mainnetChains: L1ListItem[] = mainnetStore.getState().l1List;
      
      // Get all static blockchainIds (hex format, lowercase) for deduplication
      const staticBlockchainIds = new Set(
        (l1ChainsData as L1Chain[])
          .map(c => c.blockchainId?.toLowerCase())
          .filter(Boolean)
      );
      
      // Convert chains and set isTestnet based on which store they came from
      const testnetConverted = testnetChains
        .map(item => ({ ...convertL1ListItemToL1Chain(item), isTestnet: true }));
      const mainnetConverted = mainnetChains
        .map(item => ({ ...convertL1ListItemToL1Chain(item), isTestnet: false }));
      
      // Filter out chains that already exist in static data (by blockchainId)
      const allCustomChains = [...testnetConverted, ...mainnetConverted]
        .filter(chain => !staticBlockchainIds.has(chain.blockchainId?.toLowerCase()))
        .map(chain => ({ ...chain, isCustom: true }));
      
      setCustomChains(allCustomChains);
    } catch (e) {
      console.warn("Failed to load custom chains:", e);
    }
  }, []);

  // Combine static and custom chains
  const allChains: ChainListItem[] = useMemo(() => {
    const staticChains = (l1ChainsData as L1Chain[]).map(chain => ({
      ...chain,
      isCustom: false,
    }));
    return [...staticChains, ...customChains];
  }, [customChains]);

  // Calculate chain counts for metrics
  const chainCounts = useMemo(() => {
    let mainnet = 0;
    let testnet = 0;
    let console = 0;

    allChains.forEach((chain) => {
      if (chain.isCustom) {
        console++;
      } else {
        const isTestnet = chain.chainId === "43113" || chain.category === "Testnet" || chain.isTestnet;
        if (isTestnet) {
          testnet++;
        } else {
          mainnet++;
        }
      }
    });

    return { total: allChains.length, mainnet, testnet, console };
  }, [allChains]);

  // Fetch Glacier support for all chains
  useEffect(() => {
    const fetchGlacierSupport = async () => {
      const supportMap = new Map<string, boolean>();
      
      // Fetch support for all chains in parallel (with batching to avoid overwhelming the API)
      const chainsToCheck = allChains.filter(chain => chain.chainId);
      const batchSize = 10;
      
      for (let i = 0; i < chainsToCheck.length; i += batchSize) {
        const batch = chainsToCheck.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (chain) => {
            try {
              const response = await fetch(`/api/explorer/${chain.chainId}?priceOnly=true`);
              if (response.ok) {
                const data = await response.json();
                supportMap.set(chain.chainId, data.glacierSupported === true);
              } else {
                supportMap.set(chain.chainId, false);
              }
            } catch (error) {
              console.warn(`Failed to check Glacier support for chain ${chain.chainId}:`, error);
              supportMap.set(chain.chainId, false);
            }
          })
        );
      }
      
      setGlacierSupportMap(supportMap);
    };

    if (allChains.length > 0) {
      fetchGlacierSupport();
    }
  }, [allChains]);

  // Extract unique categories
  const { sortedCategories, visibleCategories, overflowCategories } = useMemo(() => {
    const catCounts = new Map<string, number>();
    allChains.forEach(chain => {
      const category = chain.category || "General";
      catCounts.set(category, (catCounts.get(category) || 0) + 1);
    });
    
    // Sort by count
    const sorted = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
    
    const MAX_VISIBLE = 4;
    const visible = ["All", ...sorted.slice(0, MAX_VISIBLE)];
    const overflow = sorted.slice(MAX_VISIBLE);
    
    return {
      sortedCategories: ["All", ...sorted],
      visibleCategories: visible,
      overflowCategories: overflow,
    };
  }, [allChains]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter chains
  const filteredChains = useMemo(() => {
    return allChains.filter((chain) => {
      // Network filter
      const isTestnet = chain.chainId === "43113" || chain.chainId === "43114" 
        ? chain.chainId === "43113"
        : chain.category === "Testnet" || (chain as any).isTestnet;
      const isConsoleChain = chain.isCustom === true;
      const matchesNetwork = 
        (selectedNetwork === "console" && isConsoleChain) ||
        (selectedNetwork === "testnet" && isTestnet && !isConsoleChain) ||
        (selectedNetwork === "mainnet" && !isTestnet && !isConsoleChain);

      // Category filter
      const chainCategory = chain.category || "General";
      const matchesCategory = selectedCategory === "All" || chainCategory === selectedCategory;

      // Search filter
      const matchesSearch = 
        chain.chainName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chain.chainId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chain.networkToken?.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chain.slug.toLowerCase().includes(searchTerm.toLowerCase());

      // RPC URL filter
      const matchesRpcFilter = !hideWithoutRpc || !!chain.rpcUrl;

      return matchesNetwork && matchesCategory && matchesSearch && matchesRpcFilter;
    });
  }, [allChains, selectedNetwork, selectedCategory, searchTerm, hideWithoutRpc]);

  const getThemedLogoUrl = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;
    if (resolvedTheme === "dark") {
      return logoUrl.replace(/Light/g, "Dark");
    } else {
      return logoUrl.replace(/Dark/g, "Light");
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied!", "Chain ID copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Failed to copy", "Could not copy to clipboard");
    }
  };

  const formatChainId = (chainId: string): string => {
    const num = parseInt(chainId);
    if (isNaN(num)) return chainId;
    return num.toLocaleString();
  };

  const formatChainIdHex = (chainId: string): string => {
    const num = parseInt(chainId);
    if (isNaN(num)) return chainId;
    return `0x${num.toString(16)}`;
  };


  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        {/* Avalanche gradient decoration */}
        <div 
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.12) 40%, rgba(239, 68, 68, 0.04) 70%, transparent 100%)`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 overflow-x-auto scrollbar-hide pb-1">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Ecosystem</span>
            </span>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
              <Network className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
              <span>Chain List</span>
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <AvalancheLogo className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Chain List
                </h1>
                <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mt-2 max-w-2xl">
                  Discover and connect to Avalanche L1 chains. Add networks to your wallet with one click.
                </p>
              </div>

              {/* Key metrics - inline */}
              <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-3 sm:gap-6 md:gap-12 pt-4">
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {chainCounts.total}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    chains
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {chainCounts.mainnet}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    mainnet
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {chainCounts.testnet}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    testnet
                  </span>
                </div>
                {chainCounts.console > 0 && (
                  <div>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {chainCounts.console}
                    </span>
                    <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                      console
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://github.com/ava-labs/builders-hub/blob/master/constants/l1-chains.json", "_blank")}
              className="w-full sm:w-auto mt-2 gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              Submit L1
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header with chain count */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 sm:gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">All Chains</h2>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{filteredChains.length} tracked</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          {/* Network Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Network:</span>
              <div className="flex items-center gap-2">
                {(["mainnet", "testnet", "console"] as const).map((network) => (
                  <button
                    key={network}
                    onClick={() => setSelectedNetwork(network)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all cursor-pointer ${
                      selectedNetwork === network
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {network.charAt(0).toUpperCase() + network.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* RPC Filter Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideWithoutRpc}
                onChange={(e) => setHideWithoutRpc(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 focus:ring-zinc-500 dark:focus:ring-zinc-400 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                Only show chains with RPC URL
              </span>
            </label>
          </div>

          {/* Category Filter and Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Category filter badges */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {visibleCategories.map(category => {
                const count = category === "All" 
                  ? filteredChains.length 
                  : filteredChains.filter(c => (c.category || "General") === category).length;
                
                return (
                  <CategoryChip
                    key={category}
                    category={category}
                    selected={selectedCategory === category}
                    count={count}
                    onClick={() => setSelectedCategory(category)}
                  />
                );
              })}
              
              {/* More dropdown for overflow categories */}
              {overflowCategories.length > 0 && (
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1 ${
                      overflowCategories.includes(selectedCategory)
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {overflowCategories.includes(selectedCategory) ? selectedCategory : "More"}
                    <ChevronDown className={`h-3 w-3 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {categoryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                      {overflowCategories.map(category => {
                        const isSelected = selectedCategory === category;
                        const count = filteredChains.filter(c => (c.category || "General") === category).length;
                        
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              setSelectedCategory(category);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                              isSelected
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>{category}</span>
                              <span className="text-zinc-400 dark:text-zinc-500">({count})</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Search bar */}
            <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
              <Input
                placeholder="Search chains..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-sm sm:text-base text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full z-20 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chain List - Card Grid */}
        {filteredChains.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            No chains found matching your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredChains.map((chain) => {
              const chainIdHex = formatChainIdHex(chain.chainId);
              
              return (
                <Card
                  key={`${chain.chainId}-${chain.slug}`}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-lg transition-shadow py-0 h-full flex flex-col"
                >
                  {/* Card Content */}
                  <div className="p-4 relative flex-1 flex flex-col">
                    {/* Gradient Background */}
                    <div 
                      className="absolute top-0 right-0 w-2/3 h-full pointer-events-none rounded-t-xl"
                      style={{
                        background: `linear-gradient(to left, ${chain.color || '#3B82F6'}15 0%, ${chain.color || '#3B82F6'}08 40%, transparent 70%)`,
                      }}
                    />
                    <div className="relative flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                          {chain.chainLogoURI ? (
                            <Image
                              src={getThemedLogoUrl(chain.chainLogoURI) || "/placeholder.svg"}
                              alt={chain.chainName}
                              width={48}
                              height={48}
                              className="h-full w-full rounded-full object-cover shadow-sm"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                              <span className="text-lg font-bold text-white">
                                {chain.chainName.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base sm:text-lg text-zinc-900 dark:text-white truncate">
                            {chain.chainName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {/* Testnet chip */}
                            {(chain.isTestnet || chain.chainId === "43113") && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                                Testnet
                              </span>
                            )}
                            {/* Social Links */}
                            {(chain.socials?.twitter || chain.socials?.linkedin || chain.website) && (
                              <div className="flex items-center gap-1.5">
                                {chain.website && (
                                  <a
                                    href={chain.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                    title="Website"
                                  >
                                    <Globe className="w-3 h-3" />
                                  </a>
                                )}
                                {chain.socials?.twitter && (
                                  <a
                                    href={`https://x.com/${chain.socials.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                    title="Twitter"
                                  >
                                    <Twitter className="w-3 h-3" />
                                  </a>
                                )}
                                {chain.socials?.linkedin && (
                                  <a
                                    href={`https://linkedin.com/company/${chain.socials.linkedin}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                    title="LinkedIn"
                                  >
                                    <Linkedin className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {chain.description && (
                      <div className="mb-3">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {expandedDescriptions.has(chain.chainId) || chain.description.length <= 60
                            ? chain.description
                            : `${chain.description.substring(0, 60)}...`}
                        </p>
                        {chain.description.length > 60 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDescriptions(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(chain.chainId)) {
                                  newSet.delete(chain.chainId);
                                } else {
                                  newSet.add(chain.chainId);
                                }
                                return newSet;
                              });
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-1 font-medium transition-colors"
                          >
                            {expandedDescriptions.has(chain.chainId) ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Chain ID and Currency */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">ChainID</span>
                        <button
                          onClick={() => copyToClipboard(chain.chainId, `chainId-${chain.chainId}`)}
                          className="flex items-center gap-1.5 group"
                        >
                          <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                            {formatChainId(chain.chainId)} ({chainIdHex})
                          </span>
                          {copiedId === `chainId-${chain.chainId}` ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Currency</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {chain.networkToken?.symbol || "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons - pushed to bottom */}
                    <div className="space-y-2.5 mt-auto">
                      {/* Connect Wallet Button */}
                      {chain.rpcUrl ? (
                        <AddToWalletButton
                          rpcUrl={chain.rpcUrl}
                          chainName={chain.chainName}
                          chainId={parseInt(chain.chainId)}
                          tokenSymbol={chain.networkToken?.symbol}
                          variant="default"
                          className="w-full h-10 text-sm font-semibold shadow-sm hover:shadow-md transition-all"
                        />
                      ) : (
                        <div className="w-full h-10 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                          No RPC URL available
                        </div>
                      )}

                      {/* Stats and Explorer Buttons */}
                      {chain.slug && (
                        <div className="grid grid-cols-2 gap-2.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => glacierSupportMap.get(chain.chainId) && (window.location.href = `/stats/l1/${chain.slug}`)}
                            disabled={glacierSupportMap.size > 0 && !glacierSupportMap.get(chain.chainId)}
                            className="h-10 gap-2 font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 disabled:hover:border-zinc-200 dark:disabled:hover:border-zinc-800"
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-sm">Stats</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => chain.rpcUrl && (window.location.href = `/explorer/${chain.slug}`)}
                            disabled={!chain.rpcUrl}
                            className="h-10 gap-2 font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 disabled:hover:border-zinc-200 dark:disabled:hover:border-zinc-800"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-sm">Explorer</span>
                          </Button>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {filteredChains.length > 0 && (
          <div className="mt-4 pb-14 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Showing {filteredChains.length} of {allChains.length} chains
          </div>
        )}
      </div>

      <StatsBubbleNav />
    </div>
  );
}

