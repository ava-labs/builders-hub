"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DAppStats } from "@/types/dapps";
import type { SortDirection, SortField } from "../_components/types";

const PAGE_SIZE = 25;
const MAX_VISIBLE_CATEGORIES = 5;

interface UseDappsTableResult {
  // State
  sortField: SortField;
  sortDirection: SortDirection;
  visibleCount: number;
  searchTerm: string;
  selectedCategory: string;
  showOnChainOnly: boolean;
  categoryDropdownOpen: boolean;
  categoryDropdownRef: React.RefObject<HTMLDivElement | null>;

  // Setters
  setSearchTerm: (value: string) => void;
  setSelectedCategory: (value: string) => void;
  setShowOnChainOnly: (value: boolean) => void;
  setCategoryDropdownOpen: (value: boolean) => void;
  clearSearch: () => void;

  // Derived data
  visibleData: DAppStats[];
  sortedData: DAppStats[];
  hasMoreData: boolean;
  visibleCategories: string[];
  overflowCategories: string[];
  getCategoryCount: (category: string) => number;

  // Handlers
  onSort: (field: SortField) => void;
  onLoadMore: () => void;
}

// Bundles every piece of table-driven UI state for /stats/dapps: sort, filter,
// pagination, search, category dropdown, click-outside handling. Returns
// pre-derived `visibleData`/`sortedData` so the page-level component can stay
// declarative.
export function useDappsTable(dapps: DAppStats[]): UseDappsTableResult {
  const [sortField, setSortField] = useState<SortField>("tvl");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showOnChainOnly, setShowOnChainOnly] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close category dropdown when clicking anywhere outside it.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { visibleCategories, overflowCategories, categoryCounts } =
    useMemo(() => {
      const counts = new Map<string, number>();
      dapps.forEach((dapp) => {
        counts.set(dapp.category, (counts.get(dapp.category) || 0) + 1);
      });

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

      return {
        visibleCategories: ["All", ...sorted.slice(0, MAX_VISIBLE_CATEGORIES)],
        overflowCategories: sorted.slice(MAX_VISIBLE_CATEGORIES),
        categoryCounts: counts,
      };
    }, [dapps]);

  const filteredData = useMemo(() => {
    return dapps.filter((dapp) => {
      const matchesCategory =
        selectedCategory === "All" || dapp.category === selectedCategory;
      const matchesSearch =
        dapp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dapp.category.toLowerCase().includes(searchTerm.toLowerCase());
      // "On-chain only" surfaces local-registry protocols (TVL=0 with on-chain tracking).
      const matchesOnChainFilter = !showOnChainOnly || dapp.tvl === 0;
      return matchesCategory && matchesSearch && matchesOnChainFilter;
    });
  }, [dapps, selectedCategory, searchTerm, showOnChainOnly]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "tvl":
          aValue = a.tvl || 0;
          bValue = b.tvl || 0;
          break;
        case "change_1d":
          aValue = a.change_1d ?? -Infinity;
          bValue = b.change_1d ?? -Infinity;
          break;
        case "change_7d":
          aValue = a.change_7d ?? -Infinity;
          bValue = b.change_7d ?? -Infinity;
          break;
        case "volume24h":
          aValue = a.volume24h ?? 0;
          bValue = b.volume24h ?? 0;
          break;
        case "mcap":
          aValue = a.mcap ?? 0;
          bValue = b.mcap ?? 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      const aNum = typeof aValue === "number" ? aValue : 0;
      const bNum = typeof bValue === "number" ? bValue : 0;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [filteredData, sortField, sortDirection]);

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;

  const onSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setVisibleCount(PAGE_SIZE);
  };

  const onLoadMore = () =>
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedData.length));

  // Reset pagination whenever a filter changes — wrapping the setters so the
  // page doesn't have to remember to reset the slice on every interaction.
  const wrappedSetSearchTerm = (value: string) => {
    setSearchTerm(value);
    setVisibleCount(PAGE_SIZE);
  };
  const wrappedSetSelectedCategory = (value: string) => {
    setSelectedCategory(value);
    setVisibleCount(PAGE_SIZE);
  };
  const wrappedSetShowOnChainOnly = (value: boolean) => {
    setShowOnChainOnly(value);
    setVisibleCount(PAGE_SIZE);
  };
  const clearSearch = () => {
    setSearchTerm("");
    setVisibleCount(PAGE_SIZE);
  };

  const getCategoryCount = (category: string) => {
    if (category === "All") return dapps.length;
    return categoryCounts.get(category) || 0;
  };

  return {
    sortField,
    sortDirection,
    visibleCount,
    searchTerm,
    selectedCategory,
    showOnChainOnly,
    categoryDropdownOpen,
    categoryDropdownRef,
    setSearchTerm: wrappedSetSearchTerm,
    setSelectedCategory: wrappedSetSelectedCategory,
    setShowOnChainOnly: wrappedSetShowOnChainOnly,
    setCategoryDropdownOpen,
    clearSearch,
    visibleData,
    sortedData,
    hasMoreData,
    visibleCategories,
    overflowCategories,
    getCategoryCount,
    onSort,
    onLoadMore,
  };
}
