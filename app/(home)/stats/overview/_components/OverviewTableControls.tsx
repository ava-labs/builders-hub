"use client";
import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Shield, Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CategoryChip } from "@/components/stats/CategoryChip";
import type { TableView } from "./types";

interface OverviewTableControlsProps {
  tableView: TableView;
  onTableViewChange: (view: TableView) => void;
  trackedCount: number;
  visibleCategories: string[];
  overflowCategories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categoryCounts: Map<string, number>;
  totalChains: number;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchClear: () => void;
  availableVersions: string[];
  minVersion: string;
  onMinVersionChange: (version: string) => void;
}

export function OverviewTableControls({
  tableView,
  onTableViewChange,
  trackedCount,
  visibleCategories,
  overflowCategories,
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  totalChains,
  searchTerm,
  onSearchChange,
  onSearchClear,
  availableVersions,
  minVersion,
  onMinVersionChange,
}: OverviewTableControlsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const overflowSelected = overflowCategories.includes(selectedCategory);

  return (
    <div className="mb-4">
      {/* View selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-2 sm:gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
            All Chains
          </h2>
          <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {trackedCount} tracked
          </span>
        </div>

        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onTableViewChange("summary")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tableView === "summary"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Summary</span>
          </button>
          <button
            onClick={() => onTableViewChange("validators")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-l border-zinc-200 dark:border-zinc-700 transition-colors ${
              tableView === "validators"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Validators</span>
          </button>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {visibleCategories.map((category) => {
            const count =
              category === "All"
                ? totalChains
                : categoryCounts.get(category) || 0;
            return (
              <CategoryChip
                key={category}
                category={category}
                selected={selectedCategory === category}
                count={count}
                onClick={() => onCategoryChange(category)}
              />
            );
          })}

          {overflowCategories.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1 ${
                  overflowSelected
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {overflowSelected ? selectedCategory : "More"}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                  {overflowCategories.map((category) => {
                    const isSelected = selectedCategory === category;
                    const count = categoryCounts.get(category) || 0;
                    return (
                      <button
                        key={category}
                        onClick={() => {
                          onCategoryChange(category);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>{category}</span>
                          <span className="text-zinc-400 dark:text-zinc-500">
                            ({count})
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {tableView === "validators" && availableVersions.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="version-select"
                className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap hidden sm:inline"
              >
                Target:
              </label>
              <select
                id="version-select"
                value={minVersion}
                onChange={(e) => onMinVersionChange(e.target.value)}
                className="px-2 sm:px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors"
              >
                {availableVersions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
            <Input
              placeholder="Search chains..."
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
    </div>
  );
}
