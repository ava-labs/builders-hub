"use client";
import type { RefObject } from "react";
import { Search, X, ChevronDown, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DAPP_CATEGORIES, type DAppCategory } from "@/types/dapps";
import { getCategoryColor } from "./helpers";

interface DappsTableControlsProps {
  trackedCount: number;
  visibleCategories: string[];
  overflowCategories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  getCategoryCount: (category: string) => number;
  categoryDropdownOpen: boolean;
  onCategoryDropdownToggle: (open: boolean) => void;
  categoryDropdownRef: RefObject<HTMLDivElement | null>;
  showOnChainOnly: boolean;
  onShowOnChainOnlyChange: (value: boolean) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchClear: () => void;
}

function categoryLabel(category: string): string {
  if (category === "All") return "All";
  return DAPP_CATEGORIES[category as DAppCategory]?.name || category;
}

export function DappsTableControls({
  trackedCount,
  visibleCategories,
  overflowCategories,
  selectedCategory,
  onCategoryChange,
  getCategoryCount,
  categoryDropdownOpen,
  onCategoryDropdownToggle,
  categoryDropdownRef,
  showOnChainOnly,
  onShowOnChainOnlyChange,
  searchTerm,
  onSearchChange,
  onSearchClear,
}: DappsTableControlsProps) {
  const overflowSelected = overflowCategories.includes(selectedCategory);

  return (
    <div className="mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-2 sm:gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
            Protocol Leaderboard
          </h2>
          <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {trackedCount} protocols
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {visibleCategories.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all ${
                  isSelected
                    ? `${getCategoryColor(category)} border-transparent`
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {categoryLabel(category)} ({getCategoryCount(category)})
              </button>
            );
          })}

          {overflowCategories.length > 0 && (
            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => onCategoryDropdownToggle(!categoryDropdownOpen)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1 ${
                  overflowSelected
                    ? getCategoryColor(selectedCategory)
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {overflowSelected ? categoryLabel(selectedCategory) : "More"}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    categoryDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {categoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                  {overflowCategories.map((category) => {
                    const isSelected = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        onClick={() => {
                          onCategoryChange(category);
                          onCategoryDropdownToggle(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>{categoryLabel(category)}</span>
                          <span className="text-zinc-400 dark:text-zinc-500">
                            ({getCategoryCount(category)})
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => onShowOnChainOnlyChange(!showOnChainOnly)}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1.5 ${
              showOnChainOnly
                ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <Activity className="w-3 h-3" />
            On-chain Only
          </button>
        </div>

        <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
          <Input
            placeholder="Search protocols..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-sm sm:text-base text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={onSearchClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full z-20 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
