"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Filter, Check, ChevronDown } from "lucide-react";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { categoryColors } from "@/components/stats/CategoryChip";

// Get all chains that have data (chainId defined)
const allChains = (l1ChainsData as L1Chain[]).filter(c => c.chainId);

// Get unique categories
const allCategories = Array.from(new Set(allChains.map(c => c.category).filter(Boolean))) as string[];

// Get first initial of chain name
function getChainInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

// Chain chip component for filter UI
function FilterChainChip({ 
  chain, 
  selected, 
  onClick 
}: { 
  chain: L1Chain; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
        selected 
          ? 'border-transparent shadow-sm' 
          : 'border-zinc-200 dark:border-zinc-700 opacity-50 hover:opacity-75'
      }`}
      style={{ 
        backgroundColor: selected ? `${chain.color || '#6B7280'}20` : 'transparent',
        color: selected ? chain.color || '#6B7280' : undefined,
      }}
    >
      {chain.chainLogoURI ? (
        <Image
          src={chain.chainLogoURI}
          alt={chain.chainName}
          width={16}
          height={16}
          className="rounded-full"
        />
      ) : (
        <span 
          className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" 
          style={{ backgroundColor: chain.color || '#6B7280' }} 
        >
          {getChainInitial(chain.chainName)}
        </span>
      )}
      <span className={selected ? '' : 'text-zinc-500 dark:text-zinc-400'}>{chain.chainName}</span>
      {selected && <Check className="w-3 h-3 ml-0.5" />}
    </button>
  );
}

// Category toggle button
function CategoryToggle({ 
  category, 
  selected, 
  chainCount,
  selectedCount,
  onClick 
}: { 
  category: string; 
  selected: boolean;
  chainCount: number;
  selectedCount: number;
  onClick: () => void;
}) {
  const color = categoryColors[category] || '#6B7280';
  const isPartial = selectedCount > 0 && selectedCount < chainCount;
  
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer border ${
        selected 
          ? 'border-transparent shadow-sm' 
          : 'border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-80'
      }`}
      style={{ 
        backgroundColor: selected ? `${color}15` : 'transparent',
        color: selected ? color : undefined,
      }}
    >
      <span 
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPartial ? 'ring-2 ring-offset-1' : ''}`}
        style={{ 
          backgroundColor: selected || isPartial ? color : '#9CA3AF',
          // @ts-ignore - ringColor is a Tailwind CSS variable
          '--tw-ring-color': isPartial ? color : undefined,
        } as React.CSSProperties} 
      />
      <span className={selected ? '' : 'text-zinc-500 dark:text-zinc-400'}>{category}</span>
      <span className={`text-xs ${selected ? 'opacity-70' : 'text-zinc-400'}`}>
        ({selectedCount}/{chainCount})
      </span>
    </button>
  );
}

export interface ChainCategoryFilterProps {
  selectedChainIds: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
  showChainChips?: boolean;
}

export function ChainCategoryFilter({
  selectedChainIds,
  onSelectionChange,
  showChainChips = true,
}: ChainCategoryFilterProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Get chains grouped by category
  const chainsByCategory = useMemo(() => {
    const grouped: Record<string, L1Chain[]> = {};
    allChains.forEach(chain => {
      const cat = chain.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(chain);
    });
    return grouped;
  }, []);

  // Check if all chains in a category are selected
  const getCategorySelectionState = useCallback((category: string) => {
    const chainsInCategory = chainsByCategory[category] || [];
    const selectedInCategory = chainsInCategory.filter(c => selectedChainIds.has(c.chainId));
    return {
      allSelected: selectedInCategory.length === chainsInCategory.length,
      selectedCount: selectedInCategory.length,
      totalCount: chainsInCategory.length,
    };
  }, [chainsByCategory, selectedChainIds]);

  // Toggle a single chain
  const toggleChain = useCallback((chainIdToToggle: string) => {
    const next = new Set(selectedChainIds);
    if (next.has(chainIdToToggle)) {
      next.delete(chainIdToToggle);
    } else {
      next.add(chainIdToToggle);
    }
    onSelectionChange(next);
  }, [selectedChainIds, onSelectionChange]);

  // Toggle all chains in a category
  const toggleCategory = useCallback((category: string) => {
    const chainsInCategory = chainsByCategory[category] || [];
    const { allSelected } = getCategorySelectionState(category);
    
    const next = new Set(selectedChainIds);
    if (allSelected) {
      // Deselect all chains in this category
      chainsInCategory.forEach(c => next.delete(c.chainId));
    } else {
      // Select all chains in this category
      chainsInCategory.forEach(c => next.add(c.chainId));
    }
    onSelectionChange(next);
  }, [chainsByCategory, getCategorySelectionState, selectedChainIds, onSelectionChange]);

  // Select all / deselect all
  const selectAll = useCallback(() => {
    onSelectionChange(new Set(allChains.map(c => c.chainId)));
  }, [onSelectionChange]);

  const deselectAll = useCallback(() => {
    onSelectionChange(new Set<string>());
  }, [onSelectionChange]);

  return (
    <div className="space-y-4">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <Filter className="w-4 h-4" />
          <span>Filter Chains</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
            ({selectedChainIds.size} of {allChains.length} selected)
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            disabled={selectedChainIds.size === allChains.length}
            className={`text-xs cursor-pointer ${
              selectedChainIds.size === allChains.length
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-blue-600 dark:text-blue-400 hover:underline'
            }`}
          >
            Select All
          </button>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <button
            onClick={deselectAll}
            disabled={selectedChainIds.size === 0}
            className={`text-xs cursor-pointer ${
              selectedChainIds.size === 0
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-zinc-500 dark:text-zinc-400 hover:underline'
            }`}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => {
          const { allSelected, selectedCount, totalCount } = getCategorySelectionState(cat);
          return (
            <CategoryToggle
              key={cat}
              category={cat}
              selected={allSelected}
              chainCount={totalCount}
              selectedCount={selectedCount}
              onClick={() => toggleCategory(cat)}
            />
          );
        })}
      </div>

      {/* Chain Chips - collapsible */}
      {showChainChips && showFilters && (
        <div className="pt-4 border-t border-zinc-200/50 dark:border-zinc-700/50">
          <div className="flex flex-wrap gap-2">
            {allChains.map((chain) => (
              <FilterChainChip
                key={chain.chainId}
                chain={chain}
                selected={selectedChainIds.has(chain.chainId)}
                onClick={() => toggleChain(chain.chainId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export constants for use in other components
export { allChains, allCategories };

