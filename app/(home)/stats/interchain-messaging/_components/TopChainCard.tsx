"use client";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNumber, getCategoryStyle } from "./helpers";
import type { TopChainSummary, TopPeer } from "./types";

interface TopChainCardProps {
  chain: TopChainSummary;
  rank: number;
  slug: string | null;
  category: string;
  percentage: string;
  topPeers: TopPeer[];
}

export function TopChainCard({
  chain,
  rank,
  slug,
  category,
  percentage,
  topPeers,
}: TopChainCardProps) {
  return (
    <a
      href={slug ? `/stats/l1/${slug}` : undefined}
      onClick={(e) => {
        if (!slug) e.preventDefault();
      }}
      className={cn(
        "group relative rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 transition-all flex-shrink-0",
        slug
          ? "hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm cursor-pointer"
          : "cursor-default"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Rank badge — top rank gets gold styling */}
          <div
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
              rank === 0
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            )}
          >
            {rank + 1}
          </div>

          <div className="flex items-center gap-3 min-w-0 flex-1">
            {chain.logo ? (
              <Image
                src={chain.logo}
                alt={chain.chainName}
                width={36}
                height={36}
                className="rounded-full object-cover flex-shrink-0 shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full shadow-sm flex-shrink-0"
                style={{ backgroundColor: chain.color }}
              >
                <span className="text-white text-sm font-semibold">
                  {chain.chainName.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-base text-zinc-900 dark:text-white truncate group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                  {chain.chainName}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0",
                    getCategoryStyle(category)
                  )}
                >
                  {category}
                </span>
              </div>
              {topPeers.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {topPeers.map((peer) => (
                    <Badge
                      key={peer.name}
                      variant="secondary"
                      className="px-1.5 py-0.5 h-5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-0 gap-1 pointer-events-none"
                      title={`${formatNumber(peer.count)} messages`}
                    >
                      {peer.logo ? (
                        <Image
                          src={peer.logo}
                          alt={peer.name}
                          width={12}
                          height={12}
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] text-white font-bold"
                          style={{ backgroundColor: peer.color }}
                        >
                          {peer.name.charAt(0)}
                        </div>
                      )}
                      {peer.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="font-mono font-bold text-lg text-zinc-900 dark:text-white tabular-nums">
                {formatNumber(chain.count)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {percentage}%
              </div>
            </div>
            {slug && (
              <ArrowUpRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
