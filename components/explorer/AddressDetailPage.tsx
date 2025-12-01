"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, ChevronDown, ChevronLeft, ChevronRight, FileCode, Copy, Check, Search, ArrowUpRight, ShieldCheck, Code2, ExternalLink, Clock, ChevronUp, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { buildTxUrl, buildBlockUrl, buildAddressUrl } from "@/utils/eip3091";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";
import { formatTokenValue } from "@/utils/formatTokenValue";
import l1ChainsData from "@/constants/l1-chains.json";
import ContractReadSection from "@/components/explorer/ContractReadSection";
import SourceCodeViewer from "@/components/explorer/SourceCodeViewer";

interface NativeBalance {
  balance: string;
  balanceFormatted: string;
  symbol: string;
  price?: number;
  valueUsd?: number;
}

interface Erc20Balance {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  price?: number;
  valueUsd?: number;
  logoUri?: string;
}

interface Transaction {
  hash: string;
  blockNumber: string;
  blockIndex: number;
  timestamp: number;
  from: string;
  to: string | null;
  value: string;
  gasLimit: string;
  gasUsed: string;
  gasPrice: string;
  nonce: string;
  txStatus: string;
  txType: number;
  method?: string;
  methodId?: string;
}

interface Erc20Transfer {
  txHash: string;
  blockNumber: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenLogo?: string;
  logIndex: number;
}

interface NftTransfer {
  txHash: string;
  blockNumber: string;
  timestamp: number;
  from: string;
  to: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenId: string;
  tokenType: 'ERC-721' | 'ERC-1155';
  value?: string;
  logIndex: number;
}

interface InternalTransaction {
  txHash: string;
  blockNumber: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasLimit: string;
  txType: string;
  isReverted: boolean;
}

interface ContractMetadata {
  name?: string;
  description?: string;
  officialSite?: string;
  email?: string;
  logoUri?: string;
  bannerUri?: string;
  color?: string;
  resourceLinks?: Array<{ type: string; url: string }>;
  tags?: string[];
  deploymentDetails?: {
    txHash?: string;
    deployerAddress?: string;
    deployerContractAddress?: string;
  };
  ercType?: string;
  symbol?: string;
}

interface AddressChain {
  chainId: string;
  chainName: string;
  chainLogoUri?: string;
}

interface SourcifyData {
  match: string;
  matchId?: string;
  creationMatch?: string;
  runtimeMatch?: string;
  verifiedAt?: string;
  chainId?: string;
  address?: string;
  proxyResolution?: {
    isProxy?: boolean;
    proxyType?: string;
    implementations?: Array<{
      address: string;
      name?: string;
    }>;
  };
  abi?: any[];
  sources?: Record<string, { content: string }>;
  compilation?: {
    language?: string;
    compiler?: string;
    compilerVersion?: string;
    compilerSettings?: {
      optimizer?: {
        enabled?: boolean;
        runs?: number;
      };
    };
    name?: string;
    fullyQualifiedName?: string;
  };
  deployment?: {
    transactionHash?: string;
    blockNumber?: string | number;
    deployer?: string;
  };
}

interface DuneLabel {
  blockchain: string;
  name: string;
  category: string;
  source: string;
  chainId?: string;
  chainName?: string;
  chainLogoURI?: string;
  chainSlug?: string;
  chainColor?: string;
}

interface AddressData {
  address: string;
  isContract: boolean;
  contractMetadata?: ContractMetadata;
  nativeBalance: NativeBalance;
  // ERC20 balances fetched separately
  transactions: Transaction[];
  erc20Transfers: Erc20Transfer[];
  nftTransfers: NftTransfer[];
  internalTransactions: InternalTransaction[];
  nextPageToken?: string;
  addressChains?: AddressChain[];
  // Dune labels fetched separately via /api/dune/[address]
}

interface Erc20BalancesPageResponse {
  balances: Erc20Balance[];
  nextPageToken?: string;
  pageValueUsd: number;
}

interface AddressDetailPageProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  address: string;
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
  sourcifySupport?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
      )}
    </button>
  );
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} secs ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hrs ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatAddressShort(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatValue(value: string): string {
  if (!value || value === '0') return '0';
  const wei = BigInt(value);
  const eth = Number(wei) / 1e18;
  return formatTokenValue(eth);
}

function formatUsd(value: number | undefined): string {
  if (value === undefined || value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Token symbol display helper - shows N/A when symbol is not available
function displaySymbol(symbol?: string): string {
  return symbol || 'N/A';
}

function formatBalance(balance: string, decimals: number = 18): string {
  if (!balance || balance === '0') return '0';
  const value = Number(balance) / Math.pow(10, decimals);
  if (value === 0) return '0';
  if (value < 0.000001) return '<0.000001';
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(6);
}

function formatTxFee(gasPrice: string, gasUsed?: string): string {
  if (!gasPrice || gasPrice === '0') return '0';
  try {
    const gasPriceNum = BigInt(gasPrice);
    const gasUsedNum = gasUsed ? BigInt(gasUsed) : BigInt(21000);
    const feeWei = gasPriceNum * gasUsedNum;
    const fee = Number(feeWei) / 1e18;
    return fee.toFixed(8);
  } catch {
    return '0';
  }
}

export default function AddressDetailPage({
  chainId,
  chainName,
  chainSlug,
  address,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
  rpcUrl,
  sourcifySupport = false,
}: AddressDetailPageProps) {
  // Get Glacier support status and API helper from context
  const { glacierSupported, buildApiUrl } = useExplorer();
  
  const [data, setData] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [pageTokens, setPageTokens] = useState<string[]>([]); // Stack of page tokens for back navigation
  const [currentPageToken, setCurrentPageToken] = useState<string | undefined>(undefined);
  
  // Private Name Tags state
  const [privateTags, setPrivateTags] = useState<string[]>([]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  
  // Sourcify contract verification state
  const [sourcifyData, setSourcifyData] = useState<SourcifyData | null>(null);
  const [sourcifyLoading, setSourcifyLoading] = useState(false);
  const [contractSubTab, setContractSubTab] = useState<string>('code');
  
  // Implementation ABI for proxy contracts
  const [implementationAbi, setImplementationAbi] = useState<any[] | null>(null);
  const [implementationAbiLoading, setImplementationAbiLoading] = useState(false);
  
  // Copy state for showing tick
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  
  // Hover state for highlighting matching addresses
  const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);
  
  // Dune labels state (fetched via polling)
  const [duneLabels, setDuneLabels] = useState<DuneLabel[]>([]);
  const [duneLabelsLoading, setDuneLabelsLoading] = useState(false);
  
  // ERC20 balances state (fetched incrementally page by page)
  const [erc20Balances, setErc20Balances] = useState<Erc20Balance[]>([]);
  const [erc20TotalValueUsd, setErc20TotalValueUsd] = useState(0);
  const [erc20Loading, setErc20Loading] = useState(true); // True while fetching any page
  const [erc20HasMore, setErc20HasMore] = useState(false); // True if there are more pages to fetch
  
  const handleCopy = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(itemId);
    setTimeout(() => setCopiedItem(null), 2000);
  };
  
  // Load private tags from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = `private_tags_${address.toLowerCase()}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setPrivateTags(JSON.parse(stored));
        } catch {
          setPrivateTags([]);
        }
      }
    }
  }, [address]);
  
  // Save private tags to localStorage
  const savePrivateTags = (tags: string[]) => {
    if (typeof window !== 'undefined') {
      const storageKey = `private_tags_${address.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(tags));
      setPrivateTags(tags);
    }
  };
  
  const addPrivateTag = () => {
    const tag = newTagInput.trim();
    if (tag && !privateTags.includes(tag)) {
      savePrivateTags([...privateTags, tag]);
      setNewTagInput('');
      setShowAddTag(false);
    }
  };
  
  const removePrivateTag = (tagToRemove: string) => {
    savePrivateTags(privateTags.filter(tag => tag !== tagToRemove));
  };

  // Read initial tab from URL hash
  const getInitialTab = (): string => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (['transactions', 'internal', 'erc20', 'nft', 'contract'].includes(hash)) {
        return hash;
      }
    }
    return 'transactions';
  };
  
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  
  // Update URL hash when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const hash = tab === 'transactions' ? '' : `#${tab}`;
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    }
  };
  
  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (['transactions', 'internal', 'erc20', 'nft', 'contract'].includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab('transactions');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // Fetch Sourcify verification data for contracts
  useEffect(() => {
    const fetchSourcifyData = async () => {
      if (!data?.isContract || !sourcifySupport) return;
      
      setSourcifyLoading(true);
      try {
        // First check if contract is verified
        const checkResponse = await fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${address}`);
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.match === 'match') {
            // Contract is verified, fetch full details
            const fullResponse = await fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=all`);
            if (fullResponse.ok) {
              const fullData = await fullResponse.json();
              setSourcifyData(fullData);
            } else {
              setSourcifyData(checkData);
            }
          } else {
            setSourcifyData(null);
          }
        } else {
          setSourcifyData(null);
        }
      } catch (err) {
        console.error('Failed to fetch Sourcify data:', err);
        setSourcifyData(null);
      } finally {
        setSourcifyLoading(false);
      }
    };
    
    fetchSourcifyData();
  }, [data?.isContract, sourcifySupport, chainId, address]);

  // Fetch implementation ABI for proxy contracts when on read-proxy tab
  useEffect(() => {
    const fetchImplementationAbi = async () => {
      // Only fetch if we're on read-proxy tab and it's a proxy contract
      if (contractSubTab !== 'read-proxy') return;
      if (!sourcifyData?.proxyResolution?.isProxy) return;
      if (!sourcifyData.proxyResolution.implementations?.length) return;
      
      const implAddress = sourcifyData.proxyResolution.implementations[0].address;
      if (!implAddress) return;
      
      // Don't refetch if we already have it
      if (implementationAbi) return;
      
      setImplementationAbiLoading(true);
      try {
        const response = await fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${implAddress}?fields=all`);
        if (response.ok) {
          const implData = await response.json();
          if (implData.abi && implData.abi.length > 0) {
            setImplementationAbi(implData.abi);
          }
        }
      } catch (err) {
        console.error('Failed to fetch implementation ABI:', err);
      } finally {
        setImplementationAbiLoading(false);
      }
    };
    
    fetchImplementationAbi();
  }, [contractSubTab, sourcifyData, chainId, implementationAbi]);

  const fetchAddressData = useCallback(async (pageToken?: string) => {
    try {
      if (pageToken) {
        setTxLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const additionalParams: Record<string, string> = {};
      if (pageToken) {
        additionalParams.pageToken = pageToken;
      }
      const url = buildApiUrl(`/api/explorer/${chainId}/address/${address}`, additionalParams);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch address data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setTxLoading(false);
    }
  }, [chainId, address, buildApiUrl]);

  useEffect(() => {
    fetchAddressData();
  }, [fetchAddressData]);

  // Fetch ERC20 balances incrementally (page by page)
  useEffect(() => {
    let cancelled = false;
    
    const fetchAllPages = async () => {
      // Reset state for new address
      setErc20Balances([]);
      setErc20TotalValueUsd(0);
      setErc20Loading(true);
      setErc20HasMore(false);
      
      let pageToken: string | undefined = undefined;
      let allBalances: Erc20Balance[] = [];
      let totalValue = 0;
      
      try {
        do {
          const additionalParams: Record<string, string> = {};
          if (pageToken) {
            additionalParams.pageToken = pageToken;
          }
          const url = buildApiUrl(`/api/explorer/${chainId}/address/${address}/erc20-balances`, additionalParams);
          
          const response = await fetch(url);
          if (!response.ok || cancelled) break;
          
          const result: Erc20BalancesPageResponse = await response.json();
          
          // Accumulate balances
          allBalances = [...allBalances, ...result.balances];
          totalValue += result.pageValueUsd;
          pageToken = result.nextPageToken;
          
          // Update state after each page (show data progressively)
          if (!cancelled) {
            // Sort all accumulated balances by value
            const sorted = [...allBalances].sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));
            setErc20Balances(sorted);
            setErc20TotalValueUsd(totalValue);
            setErc20HasMore(!!pageToken);
          }
        } while (pageToken && !cancelled);
      } catch (err) {
        console.error('Failed to fetch ERC20 balances:', err);
      } finally {
        if (!cancelled) {
          setErc20Loading(false);
          setErc20HasMore(false);
        }
      }
    };

    fetchAllPages();
    
    return () => {
      cancelled = true;
    };
  }, [chainId, address, buildApiUrl]);

  // Fetch Dune labels - poll endpoint until results are ready
  useEffect(() => {
    let cancelled = false;
    const pollInterval = 1500; // 1.5 seconds
    const maxPollTime = 30000; // 30 seconds max
    const startTime = Date.now();
    
    const poll = async () => {
      if (cancelled) return;
      
      try {
        const response = await fetch(`/api/dune/${address}`);
        if (!response.ok || cancelled) {
          setDuneLabelsLoading(false);
          return;
        }
        
        const result = await response.json();
        
        if (cancelled) return;
        
        if (result.status === 'cached' || result.status === 'completed') {
          // Got results
          setDuneLabels(result.labels || []);
          setDuneLabelsLoading(false);
        } else if (result.status === 'failed') {
          // Execution failed, stop polling
          setDuneLabelsLoading(false);
        } else {
          // Still waiting/executing, poll again if not timed out
          // This handles 'waiting', 'executing', and any other pending status
          if (Date.now() - startTime < maxPollTime) {
            setTimeout(poll, pollInterval);
          } else {
            setDuneLabelsLoading(false);
          }
        }
      } catch (err) {
        console.error('[Dune] Fetch error:', err);
        if (!cancelled) {
          setDuneLabelsLoading(false);
        }
      }
    };
    
    setDuneLabelsLoading(true);
    poll();
    
    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleNextPage = () => {
    if (data?.nextPageToken) {
      // Save current token before moving to next page
      if (currentPageToken) {
        setPageTokens(prev => [...prev, currentPageToken]);
      } else {
        setPageTokens(prev => [...prev, '']); // Empty string represents first page
      }
      setCurrentPageToken(data.nextPageToken);
      fetchAddressData(data.nextPageToken);
    }
  };

  const handlePrevPage = () => {
    if (pageTokens.length > 0) {
      const prevTokens = [...pageTokens];
      const prevToken = prevTokens.pop();
      setPageTokens(prevTokens);
      setCurrentPageToken(prevToken || undefined);
      fetchAddressData(prevToken || undefined);
    }
  };

  // Token holdings from incrementally fetched ERC20 balances
  const tokenHoldingsValue = erc20TotalValueUsd;
  const tokenCount = erc20Balances.length;

  if (loading) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 h-48 animate-pulse" />
            ))}
          </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => fetchAddressData()}>Retry</Button>
          </div>
      </div>
    );
  }

  const isContractVerified = sourcifyData?.match === 'match';

  const tabs = [
    { id: 'transactions', label: 'Transactions' },
    { id: 'internal', label: 'Internal Txns' },
    { id: 'erc20', label: 'ERC-20 Transfers' },
    { id: 'nft', label: 'NFT Transfers' },
    // Only show Contract tab for contract addresses when sourcify is supported
    ...(data?.isContract && sourcifySupport ? [{ id: 'contract', label: 'Contract', verified: isContractVerified }] : []),
  ];

  return (
    <>
      {/* Address Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
              {data?.isContract ? 'Contract' : 'Address'}
            </h2>
            {/* Verified Badge */}
            {data?.isContract && sourcifyData?.match === 'match' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" title="Verified on Sourcify">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-medium">Verified</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs sm:text-sm truncate">
              {address}
            </span>
            <CopyButton text={address} />
          </div>
        </div>
        
        {/* Dune Labels */}
        {duneLabelsLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="w-3 h-3 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-500 dark:border-t-zinc-400 rounded-full animate-spin" />
            <span>Loading labels...</span>
          </div>
        )}
        {!duneLabelsLoading && duneLabels.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              {duneLabels.map((label, idx) => (
                <div 
                  key={`${label.blockchain}-${label.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ 
                    backgroundColor: label.chainColor ? `${label.chainColor}15` : 'rgb(244 244 245)',
                    color: label.chainColor || 'rgb(113 113 122)'
                  }}
                  title={`${label.name} on ${label.chainName || label.blockchain} (${label.category})`}
                >
                  {label.chainLogoURI ? (
                    <img 
                      src={label.chainLogoURI} 
                      alt={label.chainName || label.blockchain}
                      className="w-4 h-4 rounded-full"
                    />
                  ) : (
                    <span 
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: label.chainColor || '#9CA3AF', color: 'white' }}
                    >
                      {(label.chainName || label.blockchain).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>{label.name}</span>
                  <span className="opacity-60">({label.chainName || label.blockchain})</span>
                </div>
              ))}
            </div>
            {/* Disclosure */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Labels sourced from Dune Analytics.</span>
              </div>
              {duneLabels.some(label => label.chainId !== chainId) && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Labels from other chains don&apos;t guarantee the same contract code is deployed here.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Three Panel Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overview Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Overview</h3>
            
            {/* Native Balance */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                {displaySymbol(data?.nativeBalance.symbol)} BALANCE
              </div>
              <div className="flex items-center gap-2">
                {chainLogoURI && (
                  <img src={chainLogoURI} alt="" className="w-4 h-4 rounded-full" />
                )}
                <span className="text-zinc-900 dark:text-white font-medium">
                  {data?.nativeBalance.balanceFormatted} {displaySymbol(data?.nativeBalance.symbol)}
                </span>
              </div>
            </div>

            {/* Native Value */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                {displaySymbol(data?.nativeBalance.symbol)} VALUE
              </div>
              <div className="text-zinc-900 dark:text-white">
                {formatUsd(data?.nativeBalance.valueUsd)}
                {data?.nativeBalance.price && (
                  <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
                    (@ ${data.nativeBalance.price.toFixed(2)}/{displaySymbol(data?.nativeBalance.symbol)})
                  </span>
                )}
              </div>
            </div>

            {/* Token Holdings */}
            <div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                TOKEN HOLDINGS
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                  className="flex items-center justify-between w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-left hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-zinc-900 dark:text-white">
                    {tokenCount === 0 && erc20Loading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-500 dark:border-t-zinc-400 rounded-full animate-spin" />
                        <span className="text-zinc-500 dark:text-zinc-400">Loading tokens...</span>
                      </>
                    ) : (
                      <>
                        {formatUsd(tokenHoldingsValue)} <span className="text-zinc-500 dark:text-zinc-400">({tokenCount} Tokens)</span>
                        {/* Show small loading indicator when fetching more pages */}
                        {erc20HasMore && (
                          <div className="w-3 h-3 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-500 dark:border-t-zinc-400 rounded-full animate-spin" />
                        )}
                      </>
                    )}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Token Dropdown */}
                {showTokenDropdown && tokenCount > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-10 max-h-80 overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search tokens..."
                          value={tokenSearch}
                          onChange={(e) => setTokenSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 border-0 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 text-zinc-900 dark:text-white placeholder-zinc-400"
                        />
                      </div>
                    </div>
                    {/* Token List */}
                    <div className="max-h-56 overflow-y-auto">
                      {erc20Balances
                        .filter(token => 
                          !tokenSearch || 
                          token.symbol?.toLowerCase().includes(tokenSearch.toLowerCase()) ||
                          token.name?.toLowerCase().includes(tokenSearch.toLowerCase())
                        )
                        .map((token) => (
                          <div key={token.contractAddress} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                            <div className="flex items-center gap-2">
                              {token.logoUri ? (
                                <img src={token.logoUri} alt="" className="w-5 h-5 rounded-full" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center text-xs">
                                  {token.symbol?.charAt(0)}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm text-zinc-900 dark:text-white">{token.symbol}</span>
                                <span className="text-xs text-zinc-400">{token.name}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm text-zinc-900 dark:text-white">
                                {formatBalance(token.balance, token.decimals)}
                              </span>
                              {token.valueUsd !== undefined && token.valueUsd > 0 && (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatUsd(token.valueUsd)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* More Info Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">More Info</h3>
            
            {/* Contract Name & Symbol */}
            {data?.contractMetadata?.name && (
              <div className="mb-4">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                  CONTRACT NAME
                </div>
                <div className="flex items-center gap-2">
                  {data.contractMetadata.logoUri && (
                    <img src={data.contractMetadata.logoUri} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-zinc-900 dark:text-white font-medium">
                    {data.contractMetadata.name}
                    {data.contractMetadata.symbol && (
                      <span className="text-zinc-500 dark:text-zinc-400 ml-1">({data.contractMetadata.symbol})</span>
                    )}
                  </span>
                  {data.contractMetadata.ercType && (
                    <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400">
                      {data.contractMetadata.ercType}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            {data?.contractMetadata?.tags && data.contractMetadata.tags.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                  TAGS
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.contractMetadata.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Official Site */}
            {data?.contractMetadata?.officialSite && (
              <div className="mb-4">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                  OFFICIAL SITE
                </div>
                <a 
                  href={data.contractMetadata.officialSite} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm hover:underline flex items-center gap-1 cursor-pointer"
                  style={{ color: themeColor }}
                >
                  {data.contractMetadata.officialSite}
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Contract Creator - only show if data is available */}
            {data?.isContract && (data.contractMetadata?.deploymentDetails?.deployerAddress) && (
              <div className="mb-4">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                  CONTRACT CREATOR
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Link 
                    href={buildAddressUrl(`/explorer/${chainSlug}`, data.contractMetadata.deploymentDetails.deployerAddress)}
                    className="hover:underline cursor-pointer"
                    style={{ color: themeColor }}
                  >
                    {formatAddressShort(data.contractMetadata.deploymentDetails.deployerAddress)}
                  </Link>
                  <CopyButton text={data.contractMetadata.deploymentDetails.deployerAddress} />
                  {data.contractMetadata.deploymentDetails.txHash && (
                    <>
                      <span className="text-zinc-400">at txn</span>
                      <Link 
                        href={buildTxUrl(`/explorer/${chainSlug}`, data.contractMetadata.deploymentDetails.txHash)}
                        className="hover:underline font-mono cursor-pointer"
                        style={{ color: themeColor }}
                      >
                        {formatAddressShort(data.contractMetadata.deploymentDetails.txHash)}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Private Name Tags */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                PRIVATE NAME TAGS
              </div>
              
              {/* Display existing tags */}
              {privateTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {privateTags.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                    >
                      {tag}
                      <button 
                        onClick={() => removePrivateTag(tag)}
                        className="hover:text-blue-900 dark:hover:text-blue-200 text-base leading-none cursor-pointer"
                        title="Remove tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Add tag input */}
              {showAddTag ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addPrivateTag();
                      if (e.key === 'Escape') {
                        setShowAddTag(false);
                        setNewTagInput('');
                      }
                    }}
                    placeholder="Enter tag name..."
                    className="flex-1 h-8 px-3 text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-white"
                    autoFocus
                  />
                  <button 
                    onClick={addPrivateTag}
                    className="h-8 px-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                  <button 
                    onClick={() => {
                      setShowAddTag(false);
                      setNewTagInput('');
                    }}
                    className="h-8 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowAddTag(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* Multichain Info Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Multichain Info</h3>
            
            {/* Multichain Portfolio value - hidden for now */}
            {/* <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 mb-4">
              <Wallet className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-900 dark:text-white font-medium">
                {formatUsd(data?.totalValueUsd)} <span className="text-zinc-500 dark:text-zinc-400 text-sm">(Multichain Portfolio)</span>
              </span>
            </div> */}

            {/* Address Chains */}
            {data?.addressChains && data.addressChains.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                  ACTIVE ON {data.addressChains.length} CHAIN{data.addressChains.length > 1 ? 'S' : ''}
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.addressChains.map((chain) => {
                    // Look up chain info from l1-chains.json
                    const chainInfo = (l1ChainsData as any[]).find(c => c.chainId === chain.chainId);
                    const chainSlug = chainInfo?.slug;
                    const chainLogoUri = chain.chainLogoUri || chainInfo?.chainLogoURI;
                    
                    // Use chain color if rpcUrl is available (explorer supported), otherwise use muted gray
                    const chainColor = chainInfo?.rpcUrl 
                      ? (chainInfo.color || '#6B7280')
                      : '#9CA3AF'; // Muted gray (#9CA3AF = zinc-400) for chains without explorer support
                    
                    // Construct explorer URL if rpcUrl is provided (indicates explorer support)
                    const explorerUrl = chainInfo?.rpcUrl && chainSlug
                      ? `/explorer/${chainSlug}/address/${address}`
                      : undefined;
                    
                    return explorerUrl ? (
                      <Link
                        key={chain.chainId}
                        href={explorerUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md font-medium hover:underline cursor-pointer"
                        style={{ backgroundColor: `${chainColor}20`, color: chainColor }}
                      >
                        {chainLogoUri ? (
                          <img src={chainLogoUri} alt="" className="w-4 h-4 rounded-full" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        )}
                        <span>{chain.chainName}</span>
                      </Link>
                    ) : (
                    <div 
                      key={chain.chainId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md font-medium"
                        style={{ backgroundColor: `${chainColor}20`, color: chainColor }}
                    >
                        {chainLogoUri ? (
                          <img src={chainLogoUri} alt="" className="w-4 h-4 rounded-full" />
                      ) : (
                          <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                      )}
                        <span>{chain.chainName}</span>
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 dark:text-zinc-400 text-sm">
                No multichain activity found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Outside Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-stretch gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === 'transactions' ? '#' : `#${tab.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleTabChange(tab.id);
              }}
              className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 h-10 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
              {(tab as any).verified && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Transaction Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto relative">
            {txLoading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: themeColor }}></div>
              </div>
            )}
            
            {/* Native Transactions Tab */}
            {activeTab === 'transactions' && (
              <>
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Txn Hash</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Method</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Block</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">From</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">To</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Amount</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Txn Fee</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Age</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data?.transactions.map((tx, index) => {
                      // Try to get method name: 1) from API, 2) from our generated signatures, 3) show selector or 'Transfer'
                      let methodName = tx.method;
                      let methodSignature: string | undefined;
                      
                      if (!methodName && tx.methodId) {
                        // Try to decode using function selector
                        const decoded = getFunctionBySelector(tx.methodId.toLowerCase());
                        if (decoded) {
                          methodName = decoded.name;
                          methodSignature = decoded.signature;
                        } else {
                          // If not found, show the selector (first 4 bytes)
                          methodName = tx.methodId.slice(0, 10); // 0x + 8 hex chars
                        }
                      }
                      
                      // If still no method name and no input data, it's likely a simple ETH transfer
                      if (!methodName && (!tx.methodId || tx.methodId === '0x' || tx.methodId === '')) {
                        methodName = 'Transfer';
                      }
                      
                      // Ensure methodName always has a value
                      methodName = methodName || 'Unknown';
                      const truncatedMethod = methodName.length > 12 ? methodName.slice(0, 12) + '...' : methodName;
                      const tooltipText = methodSignature || methodName;
                      return (
                        <tr key={tx.hash || index} className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50">
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <Link href={buildTxUrl(`/explorer/${chainSlug}`, tx.hash)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(tx.hash)}</Link>
                              <CopyButton text={tx.hash} />
                            </div>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <span className="px-2 py-1 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700" title={tooltipText}>{truncatedMethod}</span>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <Link href={buildBlockUrl(`/explorer/${chainSlug}`, tx.blockNumber)} className="text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{tx.blockNumber}</Link>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <Link 
                                href={buildAddressUrl(`/explorer/${chainSlug}`, tx.from)} 
                                className={`font-mono text-sm hover:underline cursor-pointer px-1 py-0.5 rounded transition-all ${
                                  hoveredAddress && hoveredAddress.toLowerCase() === tx.from.toLowerCase() 
                                    ? 'border border-dashed' 
                                    : 'border border-transparent'
                                }`}
                                style={{ 
                                  color: themeColor,
                                  borderColor: hoveredAddress && hoveredAddress.toLowerCase() === tx.from.toLowerCase() ? themeColor : 'transparent'
                                }}
                                onMouseEnter={() => setHoveredAddress(tx.from)}
                                onMouseLeave={() => setHoveredAddress(null)}
                              >
                                {formatAddressShort(tx.from)}
                              </Link>
                              <CopyButton text={tx.from} />
                            </div>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              {tx.to ? (
                                <>
                                  <Link 
                                    href={buildAddressUrl(`/explorer/${chainSlug}`, tx.to)} 
                                    className={`font-mono text-sm hover:underline cursor-pointer px-1 py-0.5 rounded transition-all ${
                                      hoveredAddress && hoveredAddress.toLowerCase() === tx.to.toLowerCase() 
                                        ? 'border border-dashed' 
                                        : 'border border-transparent'
                                    }`}
                                    style={{ 
                                      color: themeColor,
                                      borderColor: hoveredAddress && hoveredAddress.toLowerCase() === tx.to.toLowerCase() ? themeColor : 'transparent'
                                    }}
                                    onMouseEnter={() => setHoveredAddress(tx.to)}
                                    onMouseLeave={() => setHoveredAddress(null)}
                                  >
                                    {formatAddressShort(tx.to)}
                                  </Link>
                                  <CopyButton text={tx.to} />
                                </>
                              ) : (
                                <span className="text-neutral-400 text-sm">Contract Creation</span>
                              )}
                            </div>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right"><span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatValue(tx.value)} {displaySymbol(data?.nativeBalance.symbol)}</span></td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right"><span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{formatTxFee(tx.gasPrice, tx.gasUsed)}</span></td>
                          <td className="px-4 py-2 text-right text-sm text-neutral-500 dark:text-neutral-400">{formatTimestamp(tx.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!data?.transactions || data.transactions.length === 0) && (
                  <div className="p-8 text-center"><p className="text-zinc-500 dark:text-zinc-400">No transactions found.</p></div>
                )}
              </>
            )}

            {/* ERC20 Transfers Tab */}
            {activeTab === 'erc20' && (
              <>
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Txn Hash</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Block</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">From</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">To</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Value</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Token</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Age</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data?.erc20Transfers?.map((transfer, index) => (
                      <tr key={`${transfer.txHash}-${transfer.logIndex}`} className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50">
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildTxUrl(`/explorer/${chainSlug}`, transfer.txHash)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(transfer.txHash)}</Link>
                            <CopyButton text={transfer.txHash} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <Link href={buildBlockUrl(`/explorer/${chainSlug}`, transfer.blockNumber)} className="text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{transfer.blockNumber}</Link>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.from)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(transfer.from)}</Link>
                            <CopyButton text={transfer.from} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.to)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(transfer.to)}</Link>
                            <CopyButton text={transfer.to} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatBalance(transfer.value, transfer.tokenDecimals)}</span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-2">
                            {transfer.tokenLogo && <img src={transfer.tokenLogo} alt="" className="w-4 h-4 rounded-full" />}
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.tokenAddress)} className="text-sm hover:underline cursor-pointer text-neutral-900 dark:text-neutral-100">{transfer.tokenSymbol}</Link>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-neutral-500 dark:text-neutral-400">{formatTimestamp(transfer.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!data?.erc20Transfers || data.erc20Transfers.length === 0) && (
                  <div className="p-8 text-center"><p className="text-zinc-500 dark:text-zinc-400">No ERC-20 transfers found.</p></div>
                )}
              </>
            )}

            {/* NFT Transfers Tab */}
            {activeTab === 'nft' && (
              <>
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Txn Hash</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Block</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">From</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">To</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Token</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Token ID</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Type</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Age</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data?.nftTransfers?.map((transfer, index) => (
                      <tr key={`${transfer.txHash}-${transfer.logIndex}`} className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50">
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildTxUrl(`/explorer/${chainSlug}`, transfer.txHash)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(transfer.txHash)}</Link>
                            <CopyButton text={transfer.txHash} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <Link href={buildBlockUrl(`/explorer/${chainSlug}`, transfer.blockNumber)} className="text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{transfer.blockNumber}</Link>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.from)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(transfer.from)}</Link>
                            <CopyButton text={transfer.from} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.to)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(transfer.to)}</Link>
                            <CopyButton text={transfer.to} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <Link href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.tokenAddress)} className="text-sm hover:underline cursor-pointer text-neutral-900 dark:text-neutral-100">{transfer.tokenName || transfer.tokenSymbol || 'Unknown'}</Link>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <span className="text-sm font-mono text-neutral-600 dark:text-neutral-400">#{transfer.tokenId.length > 10 ? transfer.tokenId.slice(0, 10) + '...' : transfer.tokenId}</span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${transfer.tokenType === 'ERC-721' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'}`}>{transfer.tokenType}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-neutral-500 dark:text-neutral-400">{formatTimestamp(transfer.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!data?.nftTransfers || data.nftTransfers.length === 0) && (
                  <div className="p-8 text-center"><p className="text-zinc-500 dark:text-zinc-400">No NFT transfers found.</p></div>
                )}
              </>
            )}

            {/* Internal Transactions Tab */}
            {activeTab === 'internal' && (
              <>
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Parent Txn Hash</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Block</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">From</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">To</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Value</span></th>
                      <th className="px-4 py-2 text-left"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Type</span></th>
                      <th className="px-4 py-2 text-center"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Status</span></th>
                      <th className="px-4 py-2 text-right"><span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Age</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data?.internalTransactions?.map((itx, index) => (
                      <tr key={`${itx.txHash}-${index}`} className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50">
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildTxUrl(`/explorer/${chainSlug}`, itx.txHash)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(itx.txHash)}</Link>
                            <CopyButton text={itx.txHash} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <Link href={buildBlockUrl(`/explorer/${chainSlug}`, itx.blockNumber)} className="text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{itx.blockNumber}</Link>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, itx.from)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(itx.from)}</Link>
                            <CopyButton text={itx.from} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link href={buildAddressUrl(`/explorer/${chainSlug}`, itx.to)} className="font-mono text-sm hover:underline cursor-pointer" style={{ color: themeColor }}>{formatAddressShort(itx.to)}</Link>
                            <CopyButton text={itx.to} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatValue(itx.value)} {displaySymbol(data?.nativeBalance.symbol)}</span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <span className="px-2 py-0.5 text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{itx.txType}</span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-center">
                          {itx.isReverted ? (
                            <span className="px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400">Reverted</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">Success</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-neutral-500 dark:text-neutral-400">{formatTimestamp(itx.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!data?.internalTransactions || data.internalTransactions.length === 0) && (
                  <div className="p-8 text-center"><p className="text-zinc-500 dark:text-zinc-400">No internal transactions found.</p></div>
                )}
              </>
            )}

            {/* Contract Tab */}
            {activeTab === 'contract' && (
              <div>
                {sourcifyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: themeColor }}></div>
                  </div>
                ) : sourcifyData ? (
                  <>
                    {/* Contract Sub-tabs */}
                    <div className="flex items-center gap-1 px-4 py-2 bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                      {[
                        { id: 'code', label: 'Code' },
                        ...(sourcifyData.proxyResolution?.isProxy ? [
                          { id: 'admin-proxy', label: 'Admin Proxy' },
                          { id: 'proxy-impl', label: 'Proxy Implementations' },
                        ] : []),
                        { id: 'read', label: 'Read Contract' },
                        { id: 'write', label: 'Write Contract' },
                        ...(sourcifyData.proxyResolution?.isProxy ? [
                          { id: 'read-proxy', label: 'Read as Proxy' },
                          { id: 'write-proxy', label: 'Write as Proxy' },
                        ] : []),
                      ].map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setContractSubTab(subTab.id)}
                          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                            contractSubTab === subTab.id 
                              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' 
                              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {subTab.label}
                        </button>
                      ))}
                    </div>

                    {/* Code Sub-tab */}
                    {contractSubTab === 'code' && (
                      <>
                        {/* Verification Status Header */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">Contract Source Code Verified</span>
                          <span className="px-2 py-0.5 text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {sourcifyData.creationMatch === 'match' && sourcifyData.runtimeMatch === 'match' ? 'Full Match' : 'Partial Match'}
                          </span>
                          {sourcifyData.verifiedAt && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-auto">
                              Verified {new Date(sourcifyData.verifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {/* Contract Info Table */}
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800 border-b border-zinc-100 dark:border-zinc-800">
                          {/* Left Column */}
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {sourcifyData.compilation?.name && (
                              <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">Contract Name:</span>
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">{sourcifyData.compilation.name}</span>
                              </div>
                            )}
                            {sourcifyData.compilation?.compilerVersion && (
                              <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">Compiler Version:</span>
                                <span className="text-sm font-mono text-zinc-900 dark:text-white">{sourcifyData.compilation.compilerVersion}</span>
                              </div>
                            )}
                          </div>
                          {/* Right Column */}
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {sourcifyData.compilation?.compilerSettings?.optimizer && (
                              <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">Optimization Enabled:</span>
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {sourcifyData.compilation.compilerSettings.optimizer.enabled 
                                    ? `Yes with ${sourcifyData.compilation.compilerSettings.optimizer.runs} runs`
                                    : 'No'}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between px-4 py-3">
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">Other Settings:</span>
                              <span className="text-sm text-zinc-900 dark:text-white">default evmVersion</span>
                            </div>
                          </div>
                        </div>

                        {/* Source Code Section */}
                        {sourcifyData.sources && Object.keys(sourcifyData.sources).length > 0 && (
                          <SourceCodeViewer
                            sources={sourcifyData.sources}
                            themeColor={themeColor}
                          />
                        )}

                        {/* Contract ABI Section */}
                        {sourcifyData.abi && sourcifyData.abi.length > 0 && (
                          <div className="border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                              <div className="flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Contract ABI</span>
                              </div>
                              <button
                                onClick={() => handleCopy(JSON.stringify(sourcifyData.abi, null, 2), 'abi')}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                              >
                                {copiedItem === 'abi' ? (
                                  <>
                                    <Check className="w-3 h-3 text-green-500" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="max-h-48 overflow-auto bg-white dark:bg-zinc-900 p-4 border-b border-zinc-200 dark:border-zinc-700">
                              <pre className="text-xs text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap">
                                {JSON.stringify(sourcifyData.abi, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Footer Link */}
                        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#fcfcfd] dark:bg-neutral-900 border-t border-zinc-100 dark:border-zinc-800">
                          <a
                            href={`https://sourcify.dev/#/lookup/${address}?chainId=${chainId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                          >
                            View on Sourcify
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </>
                    )}

                    {/* Admin Proxy Sub-tab */}
                    {contractSubTab === 'admin-proxy' && sourcifyData.proxyResolution?.isProxy && (
                      <div className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">Proxy Type:</span>
                            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400">{sourcifyData.proxyResolution.proxyType}</span>
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            This is a proxy contract. The admin functions allow upgrading the implementation.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Proxy Implementations Sub-tab */}
                    {contractSubTab === 'proxy-impl' && sourcifyData.proxyResolution?.isProxy && (
                      <div className="p-6">
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-white">Implementation Contracts</h4>
                          {sourcifyData.proxyResolution.implementations?.map((impl, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                              <FileCode className="w-4 h-4 text-zinc-400" />
                              <div className="flex-1">
                                {impl.name && <div className="text-sm font-medium text-zinc-900 dark:text-white">{impl.name}</div>}
                                <Link 
                                  href={buildAddressUrl(`/explorer/${chainSlug}`, impl.address)} 
                                  className="text-sm font-mono hover:underline cursor-pointer" 
                                  style={{ color: themeColor }}
                                >
                                  {impl.address}
                                </Link>
                              </div>
                              <CopyButton text={impl.address} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Read Contract Sub-tab */}
                    {contractSubTab === 'read' && (
                      <div>
                        {!sourcifyData?.abi || sourcifyData.abi.length === 0 ? (
                          <div className="p-6">
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">ABI Not Available</span>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                  Contract ABI is required to read contract functions.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <ContractReadSection
                            abi={sourcifyData.abi}
                            address={address}
                            rpcUrl={rpcUrl}
                            themeColor={themeColor}
                          />
                        )}
                      </div>
                    )}

                    {/* Write Contract Sub-tab */}
                    {contractSubTab === 'write' && (
                      <div className="p-6">
                        <div className="text-center py-8">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                            <FileCode className="w-6 h-6 text-zinc-400" />
                          </div>
                          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Write Contract</h3>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Contract write functionality coming soon. Use the ABI to interact with the contract directly.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Read as Proxy Sub-tab */}
                    {contractSubTab === 'read-proxy' && sourcifyData.proxyResolution?.isProxy && (
                      <div>
                        <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 border-b border-zinc-100 dark:border-zinc-800">
                          <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Reading Through Proxy</span>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Calling implementation contract functions through the proxy address.
                              {sourcifyData.proxyResolution.implementations?.[0] && (
                                <span className="block mt-1">
                                  Implementation: 
                                  <Link
                                    href={buildAddressUrl(`/explorer/${chainSlug}`, sourcifyData.proxyResolution.implementations[0].address)}
                                    className="font-mono ml-1 hover:underline cursor-pointer"
                                    style={{ color: themeColor }}
                                  >
                                    {sourcifyData.proxyResolution.implementations[0].name || formatAddressShort(sourcifyData.proxyResolution.implementations[0].address)}
                                  </Link>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {implementationAbiLoading ? (
                          <div className="p-6 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm">Loading implementation ABI...</span>
                            </div>
                          </div>
                        ) : implementationAbi && implementationAbi.length > 0 ? (
                          <ContractReadSection
                            abi={implementationAbi}
                            address={address}
                            rpcUrl={rpcUrl}
                            themeColor={themeColor}
                          />
                        ) : (
                          <div className="p-6">
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Implementation ABI Not Available</span>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                  The implementation contract is not verified on Sourcify. Visit the implementation to verify it:
                                </p>
                                {sourcifyData.proxyResolution.implementations?.map((impl, idx) => (
                                  <Link
                                    key={idx}
                                    href={buildAddressUrl(`/explorer/${chainSlug}`, impl.address)}
                                    className="inline-flex items-center gap-1 text-sm font-mono mt-2 hover:underline cursor-pointer"
                                    style={{ color: themeColor }}
                                  >
                                    {impl.name || formatAddressShort(impl.address)}
                                    <ArrowUpRight className="w-3 h-3" />
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Write as Proxy Sub-tab */}
                    {contractSubTab === 'write-proxy' && sourcifyData.proxyResolution?.isProxy && (
                      <div className="p-6">
                        <div className="text-center py-8">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                            <FileCode className="w-6 h-6 text-zinc-400" />
                          </div>
                          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Write as Proxy</h3>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Write through proxy functionality coming soon.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                      <FileCode className="w-6 h-6 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Contract Not Verified</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                      This contract has not been verified on Sourcify.
                    </p>
                    <a
                      href={`https://verify.sourcify.dev/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Verify on Sourcify
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pagination - Only show for transactions tab */}
          {activeTab === 'transactions' && (pageTokens.length > 0 || data?.nextPageToken) && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-[#fcfcfd] dark:bg-neutral-900">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Page {pageTokens.length + 1}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pageTokens.length === 0 || txLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!data?.nextPageToken || txLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
