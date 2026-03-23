"use client";

import { useState, useMemo } from "react";
import { SearchInputWithClear } from "@/components/stats/SearchInputWithClear";
import { SortIcon } from "@/components/stats/SortIcon";
import {
  CATEGORY_LABELS,
  formatNumber,
  formatUsd,
  getDeltaBgClass,
  type ProtocolBreakdown,
} from "./gas-treemap-utils";

type SortColumn = "avaxBurned" | "gasShare" | "txCount" | "uniqueSenders" | "delta";

interface GasTreemapTableProps {
  protocols: ProtocolBreakdown[];
}

export function GasTreemapTable({ protocols }: GasTreemapTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("avaxBurned");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(protocols.map((p) => p.category));
    return Array.from(set).sort((a, b) => {
      const la = CATEGORY_LABELS[a] || a;
      const lb = CATEGORY_LABELS[b] || b;
      return la.localeCompare(lb);
    });
  }, [protocols]);

  const filtered = useMemo(() => {
    let result = protocols;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.protocol.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      result = result.filter((p) => p.category === categoryFilter);
    }
    return result;
  }, [protocols, searchQuery, categoryFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [filtered, sortColumn, sortDirection]);

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  }

  const columns: { key: SortColumn; label: string; align: "left" | "right"; hideOnMobile?: boolean }[] = [
    { key: "avaxBurned", label: "AVAX Burned", align: "right" },
    { key: "gasShare", label: "Gas Share", align: "right", hideOnMobile: true },
    { key: "txCount", label: "Txns", align: "right" },
    { key: "uniqueSenders", label: "Senders", align: "right", hideOnMobile: true },
    { key: "delta", label: "Change", align: "right" },
  ];

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">All Protocols</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
            {filtered.length}
          </span>
        </div>
        <SearchInputWithClear
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter protocols..."
          className="h-8 text-xs"
          containerClassName="sm:max-w-[220px]"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5 mb-4 overflow-x-auto">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
            categoryFilter === null
              ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
              categoryFilter === cat
                ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase">
              <th className="text-left px-3 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-3 py-2.5 font-medium">Protocol</th>
              <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Category</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`${col.align === "right" ? "text-right" : "text-left"} px-3 py-2.5 font-medium cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 select-none whitespace-nowrap ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortIcon column={col.key} sortColumn={sortColumn} sortDirection={sortDirection} iconVariant="chevron" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => (
              <tr
                key={p.protocol}
                className={`border-t border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${
                  idx % 2 === 0 ? "bg-white dark:bg-zinc-900/30" : "bg-zinc-50/50 dark:bg-zinc-900/60"
                }`}
              >
                <td className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500 font-mono">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 max-w-[120px] sm:max-w-[200px] truncate">
                  {p.protocol}
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {p.avaxBurned.toFixed(2)}
                  {p.avaxBurnedUsd > 0 && (
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs ml-1">
                      ({formatUsd(p.avaxBurnedUsd)})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-900 dark:text-zinc-100 hidden sm:table-cell">
                  {p.gasShare.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(p.txCount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-900 dark:text-zinc-100 hidden sm:table-cell">
                  {formatNumber(p.uniqueSenders)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${getDeltaBgClass(p.delta)}`}>
                    {p.delta >= 0 ? "+" : ""}{p.delta.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                  No protocols match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
