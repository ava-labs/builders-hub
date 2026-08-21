"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from "recharts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { cn } from "@/lib/utils";
import { BlockTape, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";
import { formatTokenValue } from "@/utils/formatTokenValue";
import { formatPrice, formatAvaxPrice } from "@/utils/formatPrice";
import l1ChainsData from "@/constants/l1-chains.json";
import { ChainChip, ChainInfo } from "@/components/stats/ChainChip";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain } from "@/components/explorer/utils/chainConverter";
import { formatMarketCap } from "@/lib/utils/format-market-cap";
import { useContractNames, prewarmContractNames } from "@/lib/sourcify-client";

// Get chain info from hex blockchain ID (checks both static and custom chains)
export function getChainFromBlockchainId(hexBlockchainId: string): ChainInfo | null {
  const normalizedHex = hexBlockchainId.toLowerCase();
  
  // First, check static chains from l1ChainsData
  const staticChain = (l1ChainsData as any[]).find(c => 
    c.blockchainId?.toLowerCase() === normalizedHex
  );
  
  if (staticChain) {
    return {
      chainId: staticChain.chainId,
      chainName: staticChain.chainName,
      chainSlug: staticChain.slug,
      chainLogoURI: staticChain.chainLogoURI || '',
      color: staticChain.color || '#6B7280',
      tokenSymbol: staticChain.networkToken?.symbol || '',
    };
  }
  
  // If not found in static chains, check custom chains from localStorage
  try {
    const testnetStore = getL1ListStore(true);
    const mainnetStore = getL1ListStore(false);
    
    const testnetChains: L1ListItem[] = testnetStore.getState().l1List;
    const mainnetChains: L1ListItem[] = mainnetStore.getState().l1List;
    
    const allCustomChains = [...testnetChains, ...mainnetChains];
    
    // Convert each custom chain and check if blockchainId matches
    for (const customChain of allCustomChains) {
      const converted = convertL1ListItemToL1Chain(customChain);
      if (converted.blockchainId?.toLowerCase() === normalizedHex) {
  return {
          chainId: converted.chainId,
          chainName: converted.chainName,
          chainSlug: converted.slug,
          chainLogoURI: converted.chainLogoURI || '',
          color: converted.color || '#6B7280',
          tokenSymbol: converted.networkToken?.symbol || '',
  };
      }
    }
  } catch (e) {
    // localStorage might not be available (SSR), silently fail
  }
  
  return null;
}

interface Block {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  gasFee?: string; // Gas fee in native token
  timestampMilliseconds?: number; // Avalanche-specific: block timestamp in milliseconds
}

interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: string;
  timestamp: string;
  gasPrice: string;
  gas: string;
  isCrossChain?: boolean;
  // Cross-chain info - blockchain IDs in hex format
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

interface ExplorerStats {
  latestBlock: number;
  totalTransactions: number;
  avgBlockTime?: number; // Average block time in seconds
  avgBlockTimeMs?: number; // Average block time in milliseconds (Avalanche-specific)
  avgBlockTimeBlockSpan?: number; // Number of blocks used to calculate avgBlockTime
  gasPrice: string;
  lastFinalizedBlock?: number;
  totalGasFeesInBlocks?: string;
}

interface TransactionHistoryPoint {
  date: string;
  transactions: number;
}

interface PriceData {
  price: number;
  priceInAvax?: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  totalSupply?: number;
  symbol?: string;
}

interface ExplorerData {
  stats: ExplorerStats;
  blocks: Block[];
  transactions: Transaction[];
  icmMessages: Transaction[]; // Cross-chain transactions from API
  transactionHistory?: TransactionHistoryPoint[];
  price?: PriceData;
  tokenSymbol?: string;
}

interface L1ExplorerPageProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor?: string;
  chainLogoURI?: string;
  nativeToken?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  rpcUrl?: string;
}

/* Ledger-strip cell + live tag — the P-Chain overview's stat grammar. */
function LedgerCell({
  label,
  live = false,
  sub,
  href,
  children,
}: {
  label: React.ReactNode;
  live?: boolean;
  sub?: React.ReactNode;
  /** makes the whole cell a link — the figure reddens on hover */
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 lg:whitespace-nowrap">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--chain-accent,#E6212F)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--chain-accent,#E6212F)]" />
          </span>
        )}
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 truncate font-mono text-lg tabular-nums tracking-tight text-zinc-900 sm:text-xl md:text-2xl dark:text-zinc-50",
          href && "transition-colors group-hover/cell:text-[var(--chain-accent,#E6212F)]",
        )}
      >
        {children}
      </span>
      {sub && <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{sub}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="group/cell flex flex-col gap-1.5 px-5 py-5 md:px-6">
        {body}
      </Link>
    );
  }
  return <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">{body}</div>;
}

export function LiveTag() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--chain-accent,#E6212F)] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--chain-accent,#E6212F)]" />
      </span>
      Live
    </span>
  );
}

/** 6676356 → "6.7M" — gas figures at tape-cell size */
function compactGas(gas: number): string {
  if (gas >= 1_000_000) return `${(gas / 1_000_000).toFixed(1)}M`;
  if (gas >= 1_000) return `${(gas / 1_000).toFixed(0)}K`;
  return String(gas);
}

/* Re-render on a 1s heartbeat so relative ages ("5s ago") flow between
   data polls instead of freezing for the whole poll interval. */
export function useNowTick(ms = 1_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);
}

export function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

/* One day of C-Chain work, classified by what its logs say happened
   (the /api/cchain-activity contract). Stack order: biggest band lowest. */
interface CchainActivityDay {
  date: string;
  defi: number;
  nft: number;
  tokens: number;
  other: number;
}

const ACTIVITY_SERIES: { key: keyof Omit<CchainActivityDay, "date">; label: string; tone: string }[] = [
  { key: "tokens", label: "Tokens", tone: "#A2AFB2" },
  { key: "other", label: "Other", tone: "#d4d4d8" },
  { key: "defi", label: "DeFi", tone: "#E6212F" },
  { key: "nft", label: "NFT", tone: "#52525b" },
];

function shortenAddress(address: string | null): string {
  if (!address) return '';
  if (address.length < 18) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}



// Token symbol display component
function TokenDisplay({ symbol }: { symbol?: string }) {
  if (!symbol) {
    return <span className="text-zinc-500 dark:text-zinc-400">N/A</span>;
  }
  return <span>{symbol}</span>;
}


const newItemStyles = `
  @keyframes slideInHighlight {
    0% {
      background-color: rgba(34, 197, 94, 0.3);
      transform: translateX(-10px);
      opacity: 0;
    }
    50% {
      background-color: rgba(34, 197, 94, 0.15);
    }
    100% {
      background-color: transparent;
      transform: translateX(0);
      opacity: 1;
    }
  }
  .new-item {
    animation: slideInHighlight 0.8s ease-out;
  }
  
  @keyframes jumpingDots {
    0%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-6px);
    }
  }
  .jumping-dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    margin: 0 2px;
    border-radius: 50%;
    background-color: currentColor;
    animation: jumpingDots 1.4s infinite ease-in-out both;
  }
  .jumping-dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  .jumping-dot:nth-child(2) {
    animation-delay: -0.16s;
  }
  .jumping-dot:nth-child(3) {
    animation-delay: 0s;
  }
`;

export default function L1ExplorerPage({
  chainId,
  chainName,
  chainSlug,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
  rpcUrl,
}: L1ExplorerPageProps) {
  const router = useRouter();
  const network = useExplorerNetwork();
  // Get token data from shared context (avoids duplicate fetches across explorer pages)
  const { tokenSymbol: contextTokenSymbol, priceData: contextPriceData, glacierSupported, buildApiUrl } = useExplorer();
  
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false); // Track if we hit rate limit
  const [newBlockNumbers, setNewBlockNumbers] = useState<Set<string>>(new Set());
  const [newTxHashes, setNewTxHashes] = useState<Set<string>>(new Set());
  const [accumulatedBlocks, setAccumulatedBlocks] = useState<Block[]>([]); // Accumulated blocks
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<Transaction[]>([]); // Accumulated transactions
  // keep relative ages flowing between polls
  useNowTick();
  // Sourcify names for the visible stream's `to` contracts — "→ WAVAX"
  // reads; "→ 0xB31f…66c7" doesn't
  const toContractNames = useContractNames(
    chainId,
    accumulatedTransactions.slice(0, 10).map((t) => t.to),
  );
  const [icmMessages, setIcmMessages] = useState<Transaction[]>([]);
  const previousDataRef = useRef<ExplorerData | null>(null);
  const isFirstLoadRef = useRef(true); // Track if this is the first load
  const isFetchingRef = useRef(false); // Prevent overlapping fetches
  const lastFetchedBlockRef = useRef<string | null>(null); // Track last fetched block
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track refresh timeout
  const isMountedRef = useRef(true); // Track if component is mounted
  const BLOCK_LIMIT = 100; // Maximum number of blocks to keep
  const TRANSACTION_LIMIT = 100; // Maximum number of transactions to keep
  const ICM_MESSAGE_LIMIT = 100; // Maximum number of ICM messages to keep
  const NORMAL_INTERVAL = 2500; // Normal refresh interval (ms)
  const RATE_LIMITED_INTERVAL = NORMAL_INTERVAL * 2; // Rate limited interval (2x normal)
  const FETCH_TIMEOUT = NORMAL_INTERVAL * 2; // Timeout for fetch requests (5s)

  // Get actual token symbol - prefer context (shared), fallback to API data
  // Don't use nativeToken as placeholder - show N/A instead
  const tokenSymbol = contextTokenSymbol || data?.tokenSymbol || data?.price?.symbol || undefined;

  // Fetch data and schedule next fetch after completion
  const fetchData = useCallback(async () => {
    // Prevent overlapping fetches or fetches after unmount
    if (isFetchingRef.current || !isMountedRef.current) {
      return;
    }
    
    // Clear any pending timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    isFetchingRef.current = true;
    let shouldScheduleNext = false;
    let nextIsRateLimited = false;
    
    try {
      setIsRefreshing(true);
      
      // Build URL with query parameters using context helper (includes rpcUrl for custom chains)
      const additionalParams: Record<string, string> = {};
      if (isFirstLoadRef.current) {
        additionalParams.initialLoad = 'true';
      } else if (lastFetchedBlockRef.current) {
        // Send last fetched block for incremental updates
        additionalParams.lastFetchedBlock = lastFetchedBlockRef.current;
      }
      const url = buildApiUrl(`/api/explorer/${chainId}`, additionalParams);
      
      // Create timeout promise that resolves to null (silent timeout)
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), FETCH_TIMEOUT * 2);
      });
      
      // Race fetch against timeout
      const response = await Promise.race([
        fetch(url),
        timeoutPromise
      ]);
      
      // If timeout occurred, silently schedule next fetch
      if (response === null) {
        shouldScheduleNext = true;
        nextIsRateLimited = true; // Use longer interval after timeout
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch data");
      }
      const result = await response.json();

      // Resolve verified-contract names BEFORE the rows land, so labelled
      // rows paint labelled on their first frame instead of swapping
      // hex → name a beat later. Steady-state polls hit the session cache
      // and pass through instantly; a cold cache delays the batch ≤400ms.
      await prewarmContractNames(
        chainId,
        (result.transactions || []).map((t: Transaction) => t.to),
      );

      // Update last fetched block from the response
      if (result.blocks && result.blocks.length > 0) {
        // Get the highest block number from the response
        const highestBlock = result.blocks.reduce((max: string, b: Block) => 
          parseInt(b.number) > parseInt(max) ? b.number : max, 
          result.blocks[0].number
        );
        lastFetchedBlockRef.current = highestBlock;
      }
      
      // Accumulate blocks from API response
      setAccumulatedBlocks((prevBlocks) => {
        const existingNumbers = new Set(prevBlocks.map(b => b.number));
        const newBlocks = (result.blocks || []).filter((b: Block) => 
          !existingNumbers.has(b.number)
        );
        
        // Detect new blocks for animation
        if (newBlocks.length > 0) {
          setNewBlockNumbers(new Set(newBlocks.map((b: Block) => b.number)));
          setTimeout(() => setNewBlockNumbers(new Set()), 1000);
        }
        
        // Add new blocks to the beginning (most recent first) and sort by block number
        const updatedBlocks = [...newBlocks, ...prevBlocks]
          .sort((a, b) => parseInt(b.number) - parseInt(a.number));
        
        // Apply limit - keep only the most recent blocks
        return updatedBlocks.slice(0, BLOCK_LIMIT);
      });
      
      // Accumulate transactions from API response
      setAccumulatedTransactions((prevTxs) => {
        const existingHashes = new Set(prevTxs.map(tx => tx.hash));
        const newTxs = (result.transactions || []).filter((tx: Transaction) => 
          !existingHashes.has(tx.hash)
        );
        
        // Detect new transactions for animation
        if (newTxs.length > 0) {
          setNewTxHashes(new Set(newTxs.map((tx: Transaction) => tx.hash)));
          setTimeout(() => setNewTxHashes(new Set()), 1000);
        }
        
        // Add new transactions to the beginning (most recent first)
        const updatedTxs = [...newTxs, ...prevTxs];
        
        // Apply limit - keep only the most recent transactions
        return updatedTxs.slice(0, TRANSACTION_LIMIT);
      });
      
      // Accumulate ICM messages from API response
      setIcmMessages((prevIcmMessages) => {
        const existingHashes = new Set(prevIcmMessages.map(tx => tx.hash));
        const newIcmTransactions = (result.icmMessages || []).filter((tx: Transaction) => 
          !existingHashes.has(tx.hash)
        );
        
        // Detect new ICM messages for animation
        if (newIcmTransactions.length > 0) {
          const newIcmHashes = new Set<string>(newIcmTransactions.map((tx: Transaction) => tx.hash));
          setNewTxHashes((prev) => {
            const combined = new Set<string>(prev);
            newIcmHashes.forEach((hash: string) => combined.add(hash));
            return combined;
          });
          setTimeout(() => {
            setNewTxHashes((prev) => {
              const updated = new Set<string>(prev);
              newIcmHashes.forEach((hash: string) => updated.delete(hash));
              return updated;
            });
          }, 1000);
        }
        
        // Add new ICM messages to the beginning (most recent first)
        const updatedIcmMessages = [...newIcmTransactions, ...prevIcmMessages];
        
        // Apply limit - keep only the most recent messages
        return updatedIcmMessages.slice(0, ICM_MESSAGE_LIMIT);
      });
      
      previousDataRef.current = result;
      // Only update data if there's new content, preserve existing data otherwise
      setData(prevData => {
        // If no new blocks/transactions, preserve existing data but update stats if needed
        if (result.blocks?.length === 0 && result.transactions?.length === 0) {
          // Nothing new - keep previous data as is
          return prevData;
        }
        // Merge new data, keeping transactionHistory from previous if not provided
        return {
          ...result,
          transactionHistory: result.transactionHistory ?? prevData?.transactionHistory ?? [],
        };
      });
      setError(null);
      setIsRateLimited(false);
      nextIsRateLimited = false;
      
      // Mark first load as complete and schedule next fetch
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
      }
      shouldScheduleNext = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      const rateLimited = errorMessage.includes('429');
      
      // Set rate limit flag for longer retry interval
      if (rateLimited) {
        setIsRateLimited(true);
        nextIsRateLimited = true;
      }
      
      // Only show error if we don't have existing data to display
      if (!data) {
        setError(errorMessage);
      }
      // Schedule next fetch even on error
      shouldScheduleNext = !isFirstLoadRef.current;
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setIsRefreshing(false);
      
      // Schedule next fetch AFTER this one completes (wait full interval after response)
      if (shouldScheduleNext && isMountedRef.current) {
        const intervalTime = nextIsRateLimited ? RATE_LIMITED_INTERVAL : NORMAL_INTERVAL;
        refreshTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchData();
          }
        }, intervalTime);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state and fetch data when chain changes
  useEffect(() => {
    // Clear any pending timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // Reset refs for new chain
    isFirstLoadRef.current = true;
    lastFetchedBlockRef.current = null;
    isFetchingRef.current = false;
    
    // Clear accumulated data
    setAccumulatedBlocks([]);
    setAccumulatedTransactions([]);
    setIcmMessages([]);
    setData(null);
    setLoading(true);
    
    // Start fetching for this chain
    fetchData();
    
    // Cleanup: clear timeout when chain changes
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      isFetchingRef.current = false;
    };
  }, [chainId, fetchData]);

  // Check if we have real indexed transaction history data
  const hasIndexedTransactionHistory = useMemo(() => {
    return data?.transactionHistory && data.transactionHistory.length > 0 &&
           data.transactionHistory.some(point => point.transactions > 0);
  }, [data?.transactionHistory]);

  // fees burned across the live block window — the strip's economics cell
  // (chain height moved to the header, freeing this slot)
  const recentBurn = useMemo(() => {
    if (accumulatedBlocks.length === 0) return null;
    const sum = accumulatedBlocks.reduce((acc, b) => acc + (b.gasFee ? parseFloat(b.gasFee) : 0), 0);
    return Number.isFinite(sum) && sum > 0 ? sum : null;
  }, [accumulatedBlocks]);

  // C-Chain only: 14-day activity split by on-chain behavior (DeFi swaps /
  // NFT transfers / token transfers / other), classified from the log
  // archive — no contract labels needed. Other chains keep the tx line.
  const isCchain = chainId === "43114";
  const [activity, setActivity] = useState<CchainActivityDay[] | null>(null);
  useEffect(() => {
    if (!isCchain) return;
    let cancelled = false;
    fetch("/api/cchain-activity")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: CchainActivityDay[] } | null) => {
        if (!cancelled && data?.days?.length) setActivity(data.days);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCchain]);

  // Calculate TPS from accumulated blocks
  const calculatedTps = useMemo(() => {
    if (accumulatedBlocks.length < 2) {
      return 0;
    }

    // Get timestamps (blocks are sorted by block number descending - newest first)
    const timestamps = accumulatedBlocks.map(b => new Date(b.timestamp).getTime() / 1000);
    const firstBlockTime = timestamps[0]; // Newest block
    const lastBlockTime = timestamps[timestamps.length - 1]; // Oldest block
    
    // Calculate total time as difference between first and last block
    const totalTime = firstBlockTime - lastBlockTime;
    
    if (totalTime <= 0) {
      return 0;
    }

    // Sum total transactions from accumulated blocks
    const totalTxs = accumulatedBlocks.reduce((sum, b) => sum + b.transactionCount, 0);
    const tps = totalTxs / totalTime;

    return Math.round(tps * 100) / 100;
  }, [accumulatedBlocks]);

  // Calculate blocks per second using timestampMilliseconds
  // Wait for 2x initial blocks before showing the calculation
  if (loading) {
    return (
      <>
        <style>{newItemStyles}</style>

        {/* Stats skeleton */}
        <div className="max-w-[90rem] mx-auto px-5 md:px-6 pt-4">
          <div className="border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-6 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tables skeleton */}
        <div className="max-w-[90rem] mx-auto px-5 md:px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="p-3">
                      <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-2" />
                      <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{newItemStyles}</style>
        <div className="max-w-[90rem] mx-auto px-5 md:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData}>Retry</Button>
          </div>
        </div>
      </>
    );
  }

  const tapeBlocks: TapeBlock[] = accumulatedBlocks.slice(0, 20).map((b) => {
    const gas = Number(String(b.gasUsed).replace(/,/g, ""));
    const gasLimit = Number(String(b.gasLimit).replace(/,/g, ""));
    return {
      key: b.number,
      number: Number(b.number).toLocaleString("en-US"),
      txCount: b.transactionCount,
      label: Number.isFinite(gas) && gas > 0 ? `${compactGas(gas)} gas` : undefined,
      ago: formatTimeAgo(b.timestamp),
      // each block fills like a vessel: level = gas consumed / gas limit
      fill: Number.isFinite(gas) && gasLimit > 0 ? gas / gasLimit : undefined,
      href: buildBlockUrl(`/explorer/${network}/${chainSlug}`, b.number),
    };
  });

  return (
    <>
      <style>{newItemStyles}</style>

      {/* the live block tape — same instrument as the P-Chain overview */}
      {tapeBlocks.length > 0 && (
        <div className="max-w-[90rem] mx-auto px-5 md:px-6 pt-2">
          <BlockTape blocks={tapeBlocks} />
        </div>
      )}

      {/* ledger strip — the P-Chain overview's grammar: mono labels, big
          mono figures, hairline dividers. C-Chain simply carries more
          instruments (price, gas, ICM) on the same sheet. */}
      <div className="max-w-[90rem] mx-auto px-5 md:px-6 pt-4 pb-2">
        <Board divide={false}>
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0 dark:divide-zinc-800">
            <LedgerCell
              label={<><TokenDisplay symbol={tokenSymbol} /> price</>}
              sub={
                data?.price ? (
                  <>
                    {data.price.priceInAvax ? `@ ${formatAvaxPrice(data.price.priceInAvax)} AVAX ` : ""}
                    <span className={data.price.change24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]"}>
                      {data.price.change24h >= 0 ? "+" : ""}
                      {data.price.change24h.toFixed(2)}%
                    </span>
                  </>
                ) : undefined
              }
            >
              {data?.price ? formatPrice(data.price.price) : "—"}
            </LedgerCell>

            <LedgerCell label="Market cap">
              {data?.price?.marketCap ? formatMarketCap(data.price.marketCap) : "—"}
            </LedgerCell>

            <LedgerCell
              label="Transactions"
              live
              sub={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-zinc-300 dark:border-zinc-600">
                      {calculatedTps} TPS
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calculated from last {accumulatedBlocks.length} block{accumulatedBlocks.length !== 1 ? "s" : ""}</p>
                  </TooltipContent>
                </Tooltip>
              }
            >
              {formatNumber(data?.stats.totalTransactions || 0)}
            </LedgerCell>

            <LedgerCell
              label="Med gas price"
              href={`/explorer/${network}/${chainSlug}/gas`}
              sub="gas market →"
            >
              {data?.stats.gasPrice ?? "—"}
            </LedgerCell>

            {/* chain height already lives top-right in the header — this
                slot carries the burn instead of repeating it */}
            <LedgerCell
              label="Fees burned"
              live
              sub={
                recentBurn !== null ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dashed border-zinc-300 dark:border-zinc-600">
                        last {accumulatedBlocks.length} blocks
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sum of fees burned across the {accumulatedBlocks.length} most recent blocks</p>
                    </TooltipContent>
                  </Tooltip>
                ) : undefined
              }
            >
              {recentBurn !== null ? `${formatTokenValue(recentBurn.toString())} ${tokenSymbol ?? ""}` : "—"}
            </LedgerCell>

            <LedgerCell
              label="Avg block time"
              sub={
                data?.stats.avgBlockTime !== undefined ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dashed border-zinc-300 dark:border-zinc-600">
                        last {data.stats.avgBlockTimeBlockSpan?.toLocaleString() || "5,000"} blocks
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Calculated from the last {data.stats.avgBlockTimeBlockSpan?.toLocaleString() || "5,000"} blocks</p>
                    </TooltipContent>
                  </Tooltip>
                ) : undefined
              }
            >
              {data?.stats.avgBlockTime !== undefined
                ? data.stats.avgBlockTimeMs !== undefined
                  ? `${data.stats.avgBlockTimeMs.toFixed(2)} ms`
                  : `${data.stats.avgBlockTime.toFixed(3)} s`
                : "—"}
            </LedgerCell>
          </div>
        </Board>
      </div>

      {/* what the chain is FOR — C-Chain: 14 days of activity classified by
          on-chain behavior, stacked areas. Other chains: the plain tx line
          (only when indexed data actually exists). */}
      {isCchain && activity && (
        <div className="max-w-[90rem] mx-auto px-5 md:px-6 py-4">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Network Activity · 14 days"
              action={
                <span className="flex shrink-0 items-center gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {ACTIVITY_SERIES.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                      <span className="h-2 w-2" style={{ background: s.tone }} />
                      {s.label}
                    </span>
                  ))}
                </span>
              }
            />
            <Board divide={false} className="px-5 py-5 md:px-6">
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activity}>
                    <YAxis hide domain={[0, "dataMax"]} />
                    <RechartsTooltip
                      cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                      content={({ active: a, payload }) => {
                        if (!a || !payload?.length) return null;
                        const d = payload[0].payload as CchainActivityDay;
                        const total = d.defi + d.nft + d.tokens + d.other;
                        return (
                          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 shadow-sm">
                            <p className="text-[10px] text-zinc-500">
                              {d.date} · {total.toLocaleString()} txns
                            </p>
                            {ACTIVITY_SERIES.map((s) => (
                              <p key={s.key} className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-900 dark:text-zinc-100">
                                <span className="h-1.5 w-1.5" style={{ background: s.tone }} />
                                {d[s.key].toLocaleString()} {s.label.toLowerCase()}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {ACTIVITY_SERIES.map((s) => (
                      <Area
                        key={s.key}
                        dataKey={s.key}
                        stackId="day"
                        stroke={s.tone}
                        strokeWidth={1}
                        fill={s.tone}
                        fillOpacity={0.85}
                        type="monotone"
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Board>
          </section>
        </div>
      )}
      {!isCchain && hasIndexedTransactionHistory && data?.transactionHistory && (
        <div className="max-w-[90rem] mx-auto px-5 md:px-6 py-4">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Transactions · 14 days"
              action={
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {data.transactionHistory[0]?.date} → {data.transactionHistory[data.transactionHistory.length - 1]?.date}
                </span>
              }
            />
            <Board divide={false} className="px-5 py-5 md:px-6">
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.transactionHistory}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        return (
                          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 shadow-sm">
                            <p className="text-[10px] text-zinc-500">{payload[0].payload.date}</p>
                            <p className="text-xs font-semibold text-[var(--chain-accent,#E6212F)]">
                              {payload[0].value?.toLocaleString()} txns
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="transactions"
                      stroke="var(--chain-accent, #E6212F)"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: "var(--chain-accent, #E6212F)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Board>
          </section>
        </div>
      )}

      {/* live boards: blocks | transactions | ICM — same two-up grammar as
          the P-Chain overview, third column when the chain speaks ICM */}
      <div className="max-w-[90rem] mx-auto px-5 md:px-6 py-4 pb-16">
        <div className={`grid grid-cols-1 gap-8 ${icmMessages.length > 0 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {/* Latest blocks */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Latest Blocks" action={<LiveTag />} />
            <Board className="max-h-[420px] overflow-y-auto">
              {accumulatedBlocks.slice(0, 10).map((block) => (
                <Link
                  key={block.number}
                  href={buildBlockUrl(`/explorer/${network}/${chainSlug}`, block.number)}
                  className={`flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900 ${
                    newBlockNumbers.has(block.number) ? "new-item" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      #{Number(block.number).toLocaleString("en-US")}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      {block.transactionCount} tx · {block.gasUsed} gas
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTimeAgo(block.timestamp)}
                    </span>
                    {block.gasFee && parseFloat(block.gasFee) > 0 && (
                      <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                        {formatTokenValue(block.gasFee)} <TokenDisplay symbol={tokenSymbol} /> burned
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </Board>
          </section>

          {/* Latest transactions */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Latest Transactions" action={<LiveTag />} />
            <Board className="max-h-[420px] overflow-y-auto">
              {accumulatedTransactions.slice(0, 10).map((tx, index) => (
                <div
                  key={`${tx.hash}-${index}`}
                  onClick={() => router.push(buildTxUrl(`/explorer/${network}/${chainSlug}`, tx.hash))}
                  className={`cursor-pointer px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900 ${
                    newTxHashes.has(tx.hash) ? "new-item" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                      {tx.hash.slice(0, 18)}…{tx.hash.slice(-4)}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTokenValue(tx.value)} <TokenDisplay symbol={tokenSymbol} />
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                    <span className="min-w-0 truncate">
                      {shortenAddress(tx.from)} →{" "}
                      {tx.to ? (
                        toContractNames.has(tx.to.toLowerCase()) ? (
                          // fade covers the late-resolve path (prewarm cap
                          // exceeded); prewarmed labels mount with the row
                          <span className="font-medium text-zinc-600 animate-in fade-in duration-500 dark:text-zinc-300">
                            {toContractNames.get(tx.to.toLowerCase())}
                          </span>
                        ) : (
                          shortenAddress(tx.to)
                        )
                      ) : (
                        "contract creation"
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatTimeAgo(tx.timestamp)}</span>
                  </div>
                </div>
              ))}
            </Board>
          </section>

          {/* ICM messages — only when the chain is actually talking cross-chain */}
          {icmMessages.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="ICM Messages" action={<LiveTag />} />
              <Board className="max-h-[420px] overflow-y-auto">
                {icmMessages.map((tx, index) => {
                  const sourceChain = tx.sourceBlockchainId ? getChainFromBlockchainId(tx.sourceBlockchainId) : null;
                  const destChain = tx.destinationBlockchainId ? getChainFromBlockchainId(tx.destinationBlockchainId) : null;
                  return (
                    <div
                      key={`icm-${tx.hash}-${index}`}
                      onClick={() => router.push(buildTxUrl(`/explorer/${network}/${chainSlug}`, tx.hash))}
                      className={`cursor-pointer px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900 ${
                        newTxHashes.has(tx.hash) ? "new-item" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                          {tx.hash.slice(0, 16)}…
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatTokenValue(tx.value)} <TokenDisplay symbol={tokenSymbol} />
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {sourceChain ? (
                            <ChainChip chain={sourceChain} size="xs" onClick={() => router.push(`/explorer/${network}/${sourceChain.chainSlug}`)} />
                          ) : (
                            <span className="font-mono text-[10px] text-zinc-400">unknown</span>
                          )}
                          <span className="text-zinc-400">→</span>
                          {destChain ? (
                            <ChainChip chain={destChain} size="xs" onClick={() => router.push(`/explorer/${network}/${destChain.chainSlug}`)} />
                          ) : (
                            <span className="font-mono text-[10px] text-zinc-400">unknown</span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                          {formatTimeAgo(tx.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Board>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
