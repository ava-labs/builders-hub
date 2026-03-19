"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Fuel, Activity, Flame, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { SearchInputWithClear } from "@/components/stats/SearchInputWithClear";
import {
  CATEGORY_LABELS,
  formatNumber,
  formatAvax,
  formatUsd,
  getDeltaBgClass,
  type ProtocolBreakdown,
} from "./gas-treemap-utils";

interface ProtocolSpotlightProps {
  protocols: ProtocolBreakdown[];
}

export function ProtocolSpotlight({ protocols }: ProtocolSpotlightProps) {
  const sorted = useMemo(
    () => [...protocols].sort((a, b) => b.avaxBurned - a.avaxBurned),
    [protocols]
  );

  const top5 = useMemo(() => sorted.slice(0, 5), [sorted]);

  const [selectedProtocol, setSelectedProtocol] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-select #1 burner on data load / data change
  useEffect(() => {
    if (sorted.length > 0) {
      setSelectedProtocol(sorted[0].protocol);
    }
  }, [sorted]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = useMemo(
    () => sorted.find((p) => p.protocol === selectedProtocol) ?? sorted[0],
    [sorted, selectedProtocol]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return sorted.filter((p) => p.protocol.toLowerCase().includes(q)).slice(0, 8);
  }, [sorted, searchQuery]);

  if (!selected) return null;

  const catLabel = CATEGORY_LABELS[selected.category] || selected.category;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Protocol Spotlight</h3>
      </div>

      {/* Top-5 pills + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {top5.map((p) => (
            <button
              key={p.protocol}
              onClick={() => {
                setSelectedProtocol(p.protocol);
                setSearchQuery("");
                setDropdownOpen(false);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                selectedProtocol === p.protocol
                  ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
              }`}
            >
              {p.protocol}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:max-w-[220px]" ref={dropdownRef}>
          <SearchInputWithClear
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v);
              setDropdownOpen(v.trim().length > 0);
            }}
            placeholder="Search protocols..."
            className="h-8 text-xs"
          />
          {dropdownOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-30 max-h-60 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.protocol}
                  onClick={() => {
                    setSelectedProtocol(p.protocol);
                    setSearchQuery("");
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between"
                >
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">{p.protocol}</span>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats card */}
      <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-lg font-bold text-zinc-900 dark:text-white">{selected.protocol}</h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {catLabel}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-lg font-bold px-2.5 py-1 rounded-md ${getDeltaBgClass(selected.delta)}`}
          >
            {selected.delta >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {selected.delta >= 0 ? "+" : ""}
            {selected.delta.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">AVAX Burned</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                {selected.avaxBurned.toFixed(2)}
                {selected.avaxBurnedUsd > 0 && (
                  <span className="text-zinc-400 dark:text-zinc-500 text-xs ml-1">
                    ({formatUsd(selected.avaxBurnedUsd)})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Fuel className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Gas Share</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">{selected.gasShare.toFixed(2)}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Transactions</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">{formatNumber(selected.txCount)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Unique Senders</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">{formatNumber(selected.uniqueSenders)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
