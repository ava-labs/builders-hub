"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BlockBurn {
  blockNumber: string;
  burnedAvax: number;
  timestamp: number;
  isNew?: boolean;
}

interface Block {
  number: string;
  gasUsed: string;
  baseFeePerGas?: string;
  burnedFee?: string; // Pre-calculated burned fee from API (sum of tx.gasUsed * baseFeePerGas)
  timestampMilliseconds?: number;
  timestamp: string;
}

interface ExplorerResponse {
  stats: {
    latestBlock: number;
  };
  blocks: Block[];
}

const CHAIN_ID = "43114"; // C-Chain
const POLL_INTERVAL = 2500; // 2.5 seconds
const MAX_BLOCKS = 15;

export function LiveBlockBurns() {
  const [blockBurns, setBlockBurns] = useState<BlockBurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedBlockRef = useRef<number | undefined>(undefined);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getBurnedAvax = (block: Block): number => {
    // Use pre-calculated burnedFee from API if available (accurate calculation from receipts)
    if (block.burnedFee) {
      return parseFloat(block.burnedFee);
    }

    // Fallback: estimate using block-level gasUsed * baseFeePerGas (less accurate)
    if (!block.baseFeePerGas) return 0;

    const gasUsed = parseInt(block.gasUsed.replace(/,/g, ""), 10);
    const baseFeeGwei = parseFloat(block.baseFeePerGas);
    const burnedAvax = (gasUsed * baseFeeGwei) / 1e9;

    return burnedAvax;
  };

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current || !isMountedRef.current) return;
    isFetchingRef.current = true;

    try {
      const params = new URLSearchParams();
      if (lastFetchedBlockRef.current !== undefined) {
        params.set("lastFetchedBlock", lastFetchedBlockRef.current.toString());
      } else {
        params.set("initialLoad", "true");
      }

      const response = await fetch(`/api/explorer/${CHAIN_ID}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data: ExplorerResponse = await response.json();

      if (!isMountedRef.current) return;

      // Update last fetched block
      if (data.stats?.latestBlock) {
        lastFetchedBlockRef.current = data.stats.latestBlock;
      }

      // Process new blocks
      if (data.blocks && data.blocks.length > 0) {
        const newBurns: BlockBurn[] = data.blocks.map((block) => ({
          blockNumber: block.number,
          burnedAvax: getBurnedAvax(block),
          timestamp: block.timestampMilliseconds || new Date(block.timestamp).getTime(),
          isNew: true,
        }));

        setBlockBurns((prev) => {
          // Merge new blocks with existing, deduplicate by block number
          const existingMap = new Map<string, BlockBurn>(
            prev.map((b) => [b.blockNumber, { ...b, isNew: false }])
          );

          for (const burn of newBurns) {
            if (!existingMap.has(burn.blockNumber)) {
              existingMap.set(burn.blockNumber, burn);
            }
          }

          // Sort by block number descending and limit
          return Array.from(existingMap.values())
            .sort((a, b) => parseInt(b.blockNumber) - parseInt(a.blockNumber))
            .slice(0, MAX_BLOCKS);
        });

        // Clear "isNew" flag after animation
        setTimeout(() => {
          if (isMountedRef.current) {
            setBlockBurns((prev) =>
              prev.map((b) => ({ ...b, isNew: false }))
            );
          }
        }, 1000);
      }

      setError(null);
      setIsLoading(false);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
        setIsLoading(false);
      }
    } finally {
      isFetchingRef.current = false;

      // Schedule next fetch
      if (isMountedRef.current) {
        refreshTimeoutRef.current = setTimeout(fetchData, POLL_INTERVAL);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchData]);

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  };

  const formatBurnedAvax = (amount: number): string => {
    if (amount < 0.00001) {
      return amount.toExponential(2);
    }
    return amount.toFixed(8).replace(/\.?0+$/, "");
  };

  if (error) {
    return (
      <Card className="border-gray-200 dark:border-gray-700 rounded-md">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-medium text-black dark:text-white">Live C-Chain Block Burns</h2>
          </div>
        </div>
        <CardContent className="p-3">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 dark:border-gray-700 rounded-md flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-medium text-black dark:text-white">Live C-Chain Block Burns</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </div>

      <CardContent className="p-2 pb-3">
        <div className="space-y-2 max-h-[472px] overflow-y-auto">
          {isLoading && blockBurns.length === 0 ? (
            // Loading skeleton
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-100 dark:bg-neutral-800/50 animate-pulse"
              >
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-gray-200 dark:bg-neutral-700 rounded" />
                  <div className="h-3 w-20 bg-gray-200/50 dark:bg-neutral-700/50 rounded" />
                </div>
                <div className="h-8 w-24 bg-gray-200 dark:bg-neutral-700 rounded-full" />
              </div>
            ))
          ) : (
            blockBurns.map((burn) => (
              <div
                key={burn.blockNumber}
                className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-300 ${
                  burn.isNew
                    ? "bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/30"
                    : "bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:hover:bg-neutral-800"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-black dark:text-white font-medium truncate">
                    Block {parseInt(burn.blockNumber).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(burn.timestamp)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                  <Flame className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                  <span className="text-sm font-mono text-orange-600 dark:text-orange-300">
                    {formatBurnedAvax(burn.burnedAvax)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
