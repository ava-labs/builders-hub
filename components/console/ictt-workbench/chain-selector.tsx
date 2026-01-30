"use client";

import React, { useState } from "react";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, Globe, Check, Link } from "lucide-react";

interface ChainSelectorProps {
  availableChains: L1ListItem[];
  connectedChains: L1ListItem[];
  onConnectChain: (chainId: string) => void;
  canConnectToChain: (chainId: string) => boolean;
}

export function ChainSelector({
  availableChains,
  connectedChains,
  onConnectChain,
  canConnectToChain,
}: ChainSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const connectedIds = new Set(connectedChains.map((c) => c.id));

  const handleChainSelect = (chainId: string) => {
    if (canConnectToChain(chainId)) {
      onConnectChain(chainId);
    }
    setIsDropdownOpen(false);
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Available Chains
        </h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Click to connect
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Connected chains shown as pills */}
        {connectedChains.map((chain) => (
          <div
            key={chain.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full",
              "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700",
              "text-green-700 dark:text-green-400"
            )}
          >
            {chain.logoUrl ? (
              <img
                src={chain.logoUrl}
                alt={chain.name}
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            <span className="text-xs font-medium">{chain.name}</span>
            <Check className="w-3 h-3" />
          </div>
        ))}

        {/* Available chains to connect */}
        {availableChains
          .filter((chain) => !connectedIds.has(chain.id))
          .slice(0, 4)
          .map((chain) => (
            <button
              key={chain.id}
              onClick={() => handleChainSelect(chain.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200",
                "bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700",
                "text-zinc-700 dark:text-zinc-300",
                "hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                "hover:text-blue-600 dark:hover:text-blue-400"
              )}
            >
              {chain.logoUrl ? (
                <img
                  src={chain.logoUrl}
                  alt={chain.name}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">{chain.name}</span>
              <Link className="w-3 h-3 opacity-50" />
            </button>
          ))}

        {/* Add more dropdown */}
        {availableChains.filter((chain) => !connectedIds.has(chain.id)).length > 4 && (
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-200",
                "bg-zinc-100 dark:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-700",
                "text-zinc-600 dark:text-zinc-400",
                "hover:border-zinc-400 dark:hover:border-zinc-600"
              )}
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-medium">More</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", isDropdownOpen && "rotate-180")} />
            </button>

            {isDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />

                {/* Dropdown */}
                <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg py-1 max-h-64 overflow-auto">
                  {availableChains
                    .filter((chain) => !connectedIds.has(chain.id))
                    .slice(4)
                    .map((chain) => (
                      <button
                        key={chain.id}
                        onClick={() => handleChainSelect(chain.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left",
                          "text-zinc-700 dark:text-zinc-300",
                          "hover:bg-zinc-100 dark:hover:bg-zinc-700",
                          "transition-colors duration-150"
                        )}
                      >
                        {chain.logoUrl ? (
                          <img
                            src={chain.logoUrl}
                            alt={chain.name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-zinc-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{chain.name}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {chain.coinName}
                          </div>
                        </div>
                        <Link className="w-4 h-4 text-zinc-400" />
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {availableChains.filter((chain) => !connectedIds.has(chain.id)).length === 0 &&
          connectedChains.length === 0 && (
            <div className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
              No additional chains available to connect.
            </div>
          )}
      </div>
    </div>
  );
}

export default ChainSelector;
