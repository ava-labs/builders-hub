"use client";

import { useState, useEffect, useCallback } from "react";
import { Hash, Clock, Box, Fuel, DollarSign, FileText, ChevronUp, ChevronDown, CheckCircle, XCircle, AlertCircle, ArrowRightLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailRow, CopyButton } from "@/components/explorer/DetailRow";
import Link from "next/link";
import Image from "next/image";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { decodeEventLog, getEventByTopic, decodeFunctionInput } from "@/abi/event-signatures.generated";
import { formatTokenValue, formatUsdValue } from "@/utils/formatTokenValue";
import { formatPrice } from "@/utils/formatPrice";
import l1ChainsData from "@/constants/l1-chains.json";

interface TransactionDetail {
  hash: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber: string | null;
  blockHash: string | null;
  timestamp: string | null;
  confirmations: number;
  from: string;
  to: string | null;
  contractAddress: string | null;
  value: string;
  valueWei: string;
  gasPrice: string;
  gasPriceWei: string;
  gasLimit: string;
  gasUsed: string;
  txFee: string;
  txFeeWei: string;
  nonce: string;
  transactionIndex: string | null;
  input: string;
  type: number;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    logIndex: string;
    transactionIndex: string;
    transactionHash: string;
    blockHash: string;
    blockNumber: string;
  }>;
}

interface TransactionDetailPageProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  txHash: string;
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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let timeAgo = "";
  if (diffInSeconds < 60) timeAgo = `${diffInSeconds} secs ago`;
  else if (diffInSeconds < 3600) timeAgo = `${Math.floor(diffInSeconds / 60)} mins ago`;
  else if (diffInSeconds < 86400) timeAgo = `${Math.floor(diffInSeconds / 3600)} hrs ago`;
  else timeAgo = `${Math.floor(diffInSeconds / 86400)} days ago`;

  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  return `${timeAgo} (${formatted})`;
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

// Format wei amount with decimals (default 18)
function formatTokenAmountFromWei(amount: string, decimals: number = 18): string {
  if (!amount || amount === '0') return '0';
  try {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const intPart = value / divisor;
    const fracPart = value % divisor;
    
    // Format fractional part with leading zeros
    let fracStr = fracPart.toString().padStart(decimals, '0');
    // Create the numeric value
    const numValue = parseFloat(`${intPart}.${fracStr}`);
    
    return formatTokenValue(numValue);
  } catch {
    return amount;
  }
}

// Get chain info from hex blockchain ID
interface ChainLookupResult {
  chainName: string;
  chainLogoURI: string;
  slug: string;
  color: string;
  chainId: string;
  tokenSymbol: string;
}

function getChainFromBlockchainId(hexBlockchainId: string): ChainLookupResult | null {
  const normalizedHex = hexBlockchainId.toLowerCase();
  
  // Find by blockchainId field (hex format)
  const chain = (l1ChainsData as any[]).find(c => 
    c.blockchainId?.toLowerCase() === normalizedHex
  );
  
  if (!chain) return null;
    
    return {
    chainName: chain.chainName,
    chainLogoURI: chain.chainLogoURI || '',
    slug: chain.slug,
    color: chain.color || '#6B7280',
    chainId: chain.chainId,
    tokenSymbol: chain.networkToken?.symbol || '',
  };
}

// Cross-chain transfer event topic hashes (from ERC20TokenHome, NativeTokenHome, etc.)
const CROSS_CHAIN_TOPICS = {
  TokensSent: '0x93f19bf1ec58a15dc643b37e7e18a1c13e85e06cd11929e283154691ace9fb52',
  TokensAndCallSent: '0x5d76dff81bf773b908b050fa113d39f7d8135bb4175398f313ea19cd3a1a0b16',
  TokensRouted: '0x825080857c76cef4a1629c0705a7f8b4ef0282ddcafde0b6715c4fb34b68aaf0',
  TokensAndCallRouted: '0x42eff9005856e3c586b096d67211a566dc926052119fd7cc08023c70937ecb30',
};

interface CrossChainTransfer {
  type: 'TokensSent' | 'TokensAndCallSent' | 'TokensRouted' | 'TokensAndCallRouted';
  teleporterMessageID: string;
  sender: string;
  destinationBlockchainID: string;
  destinationTokenTransferrerAddress: string;
  recipient: string;
  amount: string;
  contractAddress: string;
}

// ERC20 Transfer event topic hash
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  
interface ERC20Transfer {
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
}

// Extract ERC20 transfers from logs
function extractERC20Transfers(logs: Array<{ topics: string[]; data: string; address: string }>): ERC20Transfer[] {
  const transfers: ERC20Transfer[] = [];
  
  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue;
    
    const topic0 = log.topics[0]?.toLowerCase();
    if (topic0 !== TRANSFER_TOPIC.toLowerCase()) continue;
    
    try {
      const decoded = decodeEventLog(log);
      if (!decoded || decoded.name !== 'Transfer') continue;
      
      const fromParam = decoded.params.find(p => p.name === 'from');
      const toParam = decoded.params.find(p => p.name === 'to');
      const valueParam = decoded.params.find(p => p.name === 'value' || p.name === 'tokenId');
      
      if (fromParam && toParam && valueParam) {
        transfers.push({
          from: fromParam.value,
          to: toParam.value,
          value: valueParam.value,
          tokenAddress: log.address,
        });
      }
  } catch {
      // Skip logs that can't be decoded
      continue;
    }
  }
  
  return transfers;
}

interface TokenInfo {
  symbol: string;
  decimals: number;
  logoUri?: string;
}

// Fetch token metadata from Glacier API
async function fetchTokenMetadata(chainId: string, tokenAddress: string): Promise<{ logoUri?: string; symbol?: string }> {
  try {
    const response = await fetch(`/api/explorer/${chainId}/token/${tokenAddress}/metadata`);
    if (response.ok) {
      const data = await response.json();
    return {
        logoUri: data.logoUri,
        symbol: data.symbol,
    };
    }
  } catch {
    // Ignore errors
  }
  return {};
}

// Fetch token info from RPC
async function fetchTokenInfo(rpcUrl: string, tokenAddress: string, chainId: string): Promise<TokenInfo> {
  let symbol = 'UNKNOWN';
  let decimals = 18;
  let logoUri: string | undefined;

  // First try to get metadata from Glacier (for logo)
  const metadata = await fetchTokenMetadata(chainId, tokenAddress);
  console.log('metadata', metadata);
  logoUri = metadata.logoUri;
  if (metadata.symbol) {
    symbol = metadata.symbol;
  }

  // If no symbol from Glacier, fetch from RPC
  if (symbol === 'UNKNOWN') {
    try {
      // Fetch symbol using eth_call with ERC20 symbol() signature (0x95d89b41)
      const symbolResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: tokenAddress, data: '0x95d89b41' }, 'latest'],
        }),
      });

      if (symbolResponse.ok) {
        const symbolData = await symbolResponse.json();
        const symbolResult = symbolData.result as string;
        
        if (symbolResult && symbolResult !== '0x' && symbolResult.length > 2) {
          // Decode string return value
          if (symbolResult.length > 130) {
            const lengthHex = symbolResult.slice(66, 130);
            const length = parseInt(lengthHex, 16);
            const dataHex = symbolResult.slice(130, 130 + length * 2);
            // Convert hex to string
            symbol = dataHex.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('').replace(/\0/g, '') || 'UNKNOWN';
          } else if (symbolResult.length === 66) {
            // Might be bytes32 encoded (like some old tokens)
            const hex = symbolResult.slice(2);
            symbol = hex.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('').replace(/\0/g, '') || 'UNKNOWN';
          }
        }
      }
    } catch (e) {
      console.log(`Could not fetch symbol for ${tokenAddress}`);
    }
  }

  try {
    // Fetch decimals using eth_call with ERC20 decimals() signature (0x313ce567)
    const decimalsResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: tokenAddress, data: '0x313ce567' }, 'latest'],
      }),
    });

    if (decimalsResponse.ok) {
      const decimalsData = await decimalsResponse.json();
      const decimalsResult = decimalsData.result as string;
      
      if (decimalsResult && decimalsResult !== '0x' && decimalsResult.length > 2) {
        decimals = parseInt(decimalsResult, 16);
        if (isNaN(decimals) || decimals > 77) decimals = 18; // Sanity check
      }
    }
  } catch (e) {
    console.log(`Could not fetch decimals for ${tokenAddress}, defaulting to 18`);
  }

  return { symbol, decimals, logoUri };
}

// Extract cross-chain transfers from logs
function extractCrossChainTransfers(logs: Array<{ topics: string[]; data: string; address: string }>): CrossChainTransfer[] {
  const transfers: CrossChainTransfer[] = [];
  
  for (const log of logs) {
    if (!log.topics || log.topics.length === 0) continue;
    
    const topic0 = log.topics[0]?.toLowerCase();
    
    // Check if this is a cross-chain transfer event
    let eventType: CrossChainTransfer['type'] | null = null;
    for (const [name, hash] of Object.entries(CROSS_CHAIN_TOPICS)) {
      if (topic0 === hash.toLowerCase()) {
        eventType = name as CrossChainTransfer['type'];
        break;
      }
    }
    
    if (!eventType) continue;
    
    try {
      // Decode the event
      const decoded = decodeEventLog(log);
      if (!decoded) continue;
      
      // Extract teleporterMessageID from topics[1]
      const teleporterMessageID = log.topics[1] || '';
      
      // Extract sender from topics[2]
      const sender = log.topics[2] ? '0x' + log.topics[2].slice(-40) : '';
      
      // Parse the input tuple from decoded params
      const inputParam = decoded.params.find(p => p.name === 'input');
      const amountParam = decoded.params.find(p => p.name === 'amount');
      
      // Extract tuple components
      let destinationBlockchainID = '';
      let destinationTokenTransferrerAddress = '';
      let recipient = '';
      
      if (inputParam?.components) {
        const destChainComp = inputParam.components.find(c => c.name === 'destinationBlockchainID');
        const destAddrComp = inputParam.components.find(c => c.name === 'destinationTokenTransferrerAddress');
        const recipientComp = inputParam.components.find(c => c.name === 'recipient') || 
                             inputParam.components.find(c => c.name === 'recipientContract');
        
        destinationBlockchainID = destChainComp?.value || '';
        destinationTokenTransferrerAddress = destAddrComp?.value || '';
        recipient = recipientComp?.value || '';
      }
      
      transfers.push({
        type: eventType,
        teleporterMessageID,
        sender,
        destinationBlockchainID,
        destinationTokenTransferrerAddress,
        recipient,
        amount: amountParam?.value || '0',
        contractAddress: log.address,
      });
    } catch {
      // Skip logs that can't be decoded
      continue;
    }
  }
  
  return transfers;
}

// Format hex to number
function hexToNumber(hex: string): string {
  try {
    return BigInt(hex).toString();
  } catch {
    return hex;
  }
}

// Token symbol display component
function TokenDisplay({ symbol }: { symbol?: string }) {
  if (!symbol) {
    return <span className="text-zinc-500 dark:text-zinc-400">N/A</span>;
  }
  return <span>{symbol}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        Success
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
        <XCircle className="w-4 h-4" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm font-medium">
      <AlertCircle className="w-4 h-4" />
      Pending
    </span>
  );
}

export default function TransactionDetailPage({
  chainId,
  chainName,
  chainSlug,
  txHash,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
  rpcUrl,
}: TransactionDetailPageProps) {
  // Get token data from shared context
  const { tokenSymbol, tokenPrice, glacierSupported, buildApiUrl } = useExplorer();
  
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showRawInput, setShowRawInput] = useState(false);
  const [erc20Transfers, setErc20Transfers] = useState<Array<ERC20Transfer & { symbol: string; decimals: number; logoUri?: string }>>([]);
  const [verifiedAddresses, setVerifiedAddresses] = useState<Set<string>>(new Set());
  
  // Check Sourcify verification for to/contract addresses
  useEffect(() => {
    const addressesToCheck = [tx?.to, tx?.contractAddress].filter(Boolean) as string[];
    if (addressesToCheck.length === 0) return;
    
    const checkVerification = async (address: string) => {
      try {
        const response = await fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.match === 'match') {
            setVerifiedAddresses(prev => new Set(prev).add(address.toLowerCase()));
          }
        }
      } catch {
        // Ignore errors
      }
    };
    
    addressesToCheck.forEach(addr => checkVerification(addr));
  }, [tx?.to, tx?.contractAddress, chainId]);
  
  // Extract ERC20 transfers and fetch token info
  useEffect(() => {
    if (!tx?.logs || !rpcUrl) {
      setErc20Transfers([]);
      return;
    }

    const extractAndFetch = async () => {
      const transfers = extractERC20Transfers(tx.logs);
      console.log('transfers', transfers);
      
      if (transfers.length === 0) {
        setErc20Transfers([]);
        return;
      }

      // Get unique token addresses
      const uniqueTokenAddresses = Array.from(new Set(transfers.map(t => t.tokenAddress.toLowerCase())));
      
      // Fetch token info for all unique addresses in parallel
      const tokenInfoMap = new Map<string, TokenInfo>();
      await Promise.all(
        uniqueTokenAddresses.map(async (addr) => {
          const info = await fetchTokenInfo(rpcUrl, addr, chainId);
          tokenInfoMap.set(addr, info);
        })
      );

      // Combine transfers with token info
      const transfersWithInfo = transfers.map(transfer => {
        const tokenInfo = tokenInfoMap.get(transfer.tokenAddress.toLowerCase()) || { symbol: 'UNKNOWN', decimals: 18 };
        return {
          ...transfer,
          symbol: tokenInfo.symbol,
          decimals: tokenInfo.decimals,
          logoUri: tokenInfo.logoUri,
        };
      });

      setErc20Transfers(transfersWithInfo);
    };

    extractAndFetch();
  }, [tx?.logs, rpcUrl, chainId]);
  
  // Read initial tab from URL hash
  const getInitialTab = (): 'overview' | 'logs' => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      return hash === 'logs' ? 'logs' : 'overview';
    }
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>(getInitialTab);
  
  // Update URL hash when tab changes
  const handleTabChange = (tab: 'overview' | 'logs') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const hash = tab === 'overview' ? '' : `#${tab}`;
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    }
  };
  
  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'logs') {
        setActiveTab('logs');
      } else {
        setActiveTab('overview');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchTransaction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = buildApiUrl(`/api/explorer/${chainId}/tx/${txHash}`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch transaction");
      }
      const data = await response.json();
      setTx(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [chainId, txHash, buildApiUrl]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  if (loading) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <div className="space-y-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-5 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchTransaction}>Retry</Button>
          </div>
      </div>
    );
  }

  return (
    <>
      {/* Transaction Details Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
          Transaction Details
        </h2>
      </div>

      {/* Tabs - Outside Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`#overview`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('overview');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Overview
          </Link>
          <Link
            href={`#logs`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('logs');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Logs ({tx?.logs?.length || 0})
          </Link>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {activeTab === 'overview' ? (
            <div className="p-4 sm:p-6 space-y-5">
            {/* Transaction Hash */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label="Transaction Hash"
              themeColor={themeColor}
              value={
                <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                  {tx?.hash || '-'}
                </span>
              }
              copyValue={tx?.hash}
            />

            {/* Status */}
            <DetailRow
              icon={<CheckCircle className="w-4 h-4" />}
              label="Status"
              themeColor={themeColor}
              value={<StatusBadge status={tx?.status || 'pending'} />}
            />

            {/* Block */}
            <DetailRow
              icon={<Box className="w-4 h-4" />}
              label="Block"
              themeColor={themeColor}
              value={
                tx?.blockNumber ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={buildBlockUrl(`/explorer/${chainSlug}`, tx.blockNumber)}
                      className="text-sm font-medium hover:underline cursor-pointer"
                      style={{ color: themeColor }}
                    >
                      {parseInt(tx.blockNumber).toLocaleString()}
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {tx.confirmations} Block Confirmations
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-500">Pending</span>
                )
              }
            />

            {/* Timestamp */}
            <DetailRow
              icon={<Clock className="w-4 h-4" />}
              label="Timestamp"
              themeColor={themeColor}
              value={
                <span className="text-sm text-zinc-900 dark:text-white">
                  {tx?.timestamp ? formatTimestamp(tx.timestamp) : 'Pending'}
                </span>
              }
            />

            {/* From */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label="From"
              themeColor={themeColor}
              value={
                tx?.from ? (
                  <Link
                    href={buildAddressUrl(`/explorer/${chainSlug}`, tx.from)}
                    className="text-sm font-mono break-all hover:underline cursor-pointer"
                    style={{ color: themeColor }}
                  >
                    {tx.from}
                  </Link>
                ) : (
                  <span className="text-sm font-mono">-</span>
                )
              }
              copyValue={tx?.from}
            />

            {/* To / Contract */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label={tx?.contractAddress ? "Interacted With (To)" : "Interacted With (To)"}
              themeColor={themeColor}
              value={
                tx?.to ? (
                  <div className="flex items-center gap-2">
                  <Link
                    href={buildAddressUrl(`/explorer/${chainSlug}`, tx.to)}
                      className="text-sm font-mono break-all hover:underline cursor-pointer"
                    style={{ color: themeColor }}
                  >
                    {tx.to}
                  </Link>
                    {verifiedAddresses.has(tx.to.toLowerCase()) && (
                      <span 
                        className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500"
                        title="Verified on Sourcify"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                ) : tx?.contractAddress ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">[Contract Created]</span>
                    <Link
                      href={buildAddressUrl(`/explorer/${chainSlug}`, tx.contractAddress)}
                      className="text-sm font-mono hover:underline cursor-pointer"
                      style={{ color: themeColor }}
                    >
                      {tx.contractAddress}
                    </Link>
                    {verifiedAddresses.has(tx.contractAddress.toLowerCase()) && (
                      <span 
                        className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500"
                        title="Verified on Sourcify"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-500">-</span>
                )
              }
              copyValue={tx?.to || tx?.contractAddress || undefined}
            />

            {/* Decoded Method */}
            {(() => {
              const decoded = tx?.input ? decodeFunctionInput(tx.input) : null;
              if (!decoded) return null;
              return (
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Method"
                themeColor={themeColor}
                value={
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">
                      {decoded.name}
                  </span>
                }
              />
              );
            })()}

            {/* ERC-20 Transfers */}
            {erc20Transfers.length > 0 && (
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label={`ERC-20 Tokens Transferred (${erc20Transfers.length})`}
                themeColor={themeColor}
                value={
                  <div className="space-y-3">
                    {erc20Transfers.map((transfer, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-zinc-500">From</span>
                          <Link 
                            href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.from)}
                            className="font-mono text-xs hover:underline cursor-pointer" 
                            style={{ color: themeColor }}
                          >
                            {formatAddress(transfer.from)}
                          </Link>
                          <span className="text-zinc-400">→</span>
                          <span className="text-zinc-500">To</span>
                          <Link 
                            href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.to)}
                            className="font-mono text-xs hover:underline cursor-pointer" 
                            style={{ color: themeColor }}
                          >
                            {formatAddress(transfer.to)}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">For</span>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {formatTokenAmountFromWei(transfer.value, transfer.decimals)}
                          </span>
                          <Link 
                            href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.tokenAddress)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium hover:underline cursor-pointer"
                            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                          >
                            {transfer.logoUri && (
                              <Image
                                src={transfer.logoUri}
                                alt={transfer.symbol}
                                width={14}
                                height={14}
                                className="rounded-full"
                              />
                            )}
                            {transfer.symbol}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              />
            )}

            {/* Cross-Chain Transfers (ICM) */}
            {(() => {
              const crossChainTransfers = tx?.logs ? extractCrossChainTransfers(tx.logs) : [];
              if (crossChainTransfers.length === 0) return null;
              
              // Get source chain info for display
              const sourceChainInfo = l1ChainsData.find(c => c.chainId === chainId);
              
              return (
                <DetailRow
                  icon={<ArrowRightLeft className="w-4 h-4" />}
                  label={`Cross-Chain Tokens Transferred (${crossChainTransfers.length})`}
                  themeColor={themeColor}
                  value={
                    <div className="space-y-3">
                      {crossChainTransfers.map((transfer, idx) => {
                        const destChain = getChainFromBlockchainId(transfer.destinationBlockchainID);
                        const formattedAmount = formatTokenAmountFromWei(transfer.amount);
                        // Use destination chain token symbol if available, otherwise source chain's
                        const transferTokenSymbol = destChain?.tokenSymbol || sourceChainInfo?.tokenSymbol || tokenSymbol || 'Token';
                        
                        return (
                          <div 
                            key={idx} 
                            className="flex flex-col gap-2 text-sm p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                          >
                            {/* Line 1: Source Chain → Destination Chain */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Source Chain */}
                              <Link 
                                href={`/explorer/${chainSlug}`}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium hover:underline cursor-pointer"
                                style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                              >
                                {chainLogoURI && (
                                  <Image
                                    src={chainLogoURI}
                                    alt={chainName}
                                    width={14}
                                    height={14}
                                    className="rounded-full"
                                  />
                                )}
                                {chainName}
                              </Link>
                              
                              <span className="text-zinc-400">→</span>
                              
                              {/* Destination Chain */}
                              {destChain ? (
                                <Link 
                                  href={`/explorer/${destChain.slug}`}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium hover:underline cursor-pointer"
                                  style={{ backgroundColor: `${destChain.color}20`, color: destChain.color }}
                                >
                                  {destChain.chainLogoURI && (
                                    <Image
                                      src={destChain.chainLogoURI}
                                      alt={destChain.chainName}
                                      width={14}
                                      height={14}
                                      className="rounded-full"
                                    />
                                  )}
                                  {destChain.chainName}
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400">
                                  <span className="w-3.5 h-3.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                  {transfer.destinationBlockchainID.slice(0, 10)}...
                                </span>
                              )}
                            </div>
                            
                            {/* Line 2: From → To For Amount Token */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-zinc-500">From</span>
                              <Link 
                                href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.sender)}
                                className="font-mono text-xs hover:underline cursor-pointer" 
                                style={{ color: themeColor }}
                              >
                                {formatAddress(transfer.sender)}
                              </Link>
                              <span className="text-zinc-400">→</span>
                              <span className="text-zinc-500">To</span>
                              {destChain ? (
                                <Link 
                                  href={buildAddressUrl(`/explorer/${destChain.slug}`, transfer.recipient)}
                                  className="font-mono text-xs hover:underline cursor-pointer" 
                                  style={{ color: destChain.color }}
                                >
                                  {formatAddress(transfer.recipient)}
                                </Link>
                              ) : (
                                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                  {formatAddress(transfer.recipient)}
                                </span>
                              )}
                              <span className="text-zinc-500">For</span>
                              <span className="font-semibold text-zinc-900 dark:text-white">
                                {formattedAmount}
                              </span>
                              <Link 
                                href={buildAddressUrl(`/explorer/${chainSlug}`, transfer.contractAddress)}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium hover:underline cursor-pointer"
                                style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                              >
                                {transferTokenSymbol}
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  }
                />
              );
            })()}

            {/* Value */}
            <DetailRow
              icon={<DollarSign className="w-4 h-4" />}
              label="Value"
              themeColor={themeColor}
              value={
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {formatTokenValue(tx?.value)} <TokenDisplay symbol={tokenSymbol} />
                  </span>
                  {tokenPrice && tx?.value && parseFloat(tx.value) > 0 && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      ({formatUsdValue(parseFloat(tx.value) * tokenPrice)} USD)
                    </span>
                  )}
                </div>
              }
            />

            {/* Transaction Fee */}
            <DetailRow
              icon={<Fuel className="w-4 h-4" />}
              label="Transaction Fee"
              themeColor={themeColor}
              value={
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {formatTokenValue(tx?.txFee)} <TokenDisplay symbol={tokenSymbol} />
                  </span>
                  {tokenPrice && tx?.txFee && parseFloat(tx.txFee) > 0 && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      ({formatPrice(parseFloat(tx.txFee) * tokenPrice)} USD)
                    </span>
                  )}
                </div>
              }
            />

            {/* Gas Price */}
            <DetailRow
              icon={<Fuel className="w-4 h-4" />}
              label="Gas Price"
              themeColor={themeColor}
              value={
                <span className="text-sm text-zinc-900 dark:text-white">
                  {tx?.gasPrice || '-'}
                </span>
              }
            />

            {/* Show More Toggle */}
            <button
              onClick={() => setShowMore(!showMore)}
              className="flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
              style={{ color: themeColor }}
            >
              {showMore ? 'Click to see Less' : 'Click to see More'}
              {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showMore && (
              <>
                {/* Gas Limit & Usage */}
                <DetailRow
                  icon={<Fuel className="w-4 h-4" />}
                  label="Gas Limit & Usage"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {tx?.gasLimit ? parseInt(tx.gasLimit).toLocaleString() : '-'} | {tx?.gasUsed ? parseInt(tx.gasUsed).toLocaleString() : '-'} ({tx?.gasLimit && tx?.gasUsed ? ((parseInt(tx.gasUsed) / parseInt(tx.gasLimit)) * 100).toFixed(2) : '0'}%)
                    </span>
                  }
                />

                {/* Nonce */}
                <DetailRow
                  icon={<Hash className="w-4 h-4" />}
                  label="Nonce"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {tx?.nonce || '-'}
                    </span>
                  }
                />

                {/* Transaction Index */}
                <DetailRow
                  icon={<Hash className="w-4 h-4" />}
                  label="Position In Block"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {tx?.transactionIndex || '-'}
                    </span>
                  }
                />

                {/* Input Data */}
                {(() => {
                  const decodedInput = tx?.input ? decodeFunctionInput(tx.input) : null;
                  return (
                <DetailRow
                  icon={<FileText className="w-4 h-4" />}
                  label="Input Data"
                  themeColor={themeColor}
                  value={
                        <div className="w-full space-y-3">
                          {/* Toggle between decoded and raw */}
                          {decodedInput && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowRawInput(false)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                                  !showRawInput
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                              >
                                Decoded
                              </button>
                              <button
                                onClick={() => setShowRawInput(true)}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                                  showRawInput
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                              >
                                Raw
                              </button>
                            </div>
                          )}
                          
                          {/* Decoded View */}
                          {decodedInput && !showRawInput ? (
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
                              {/* Method Signature */}
                              <div>
                                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Function</div>
                                <div className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                  {decodedInput.name}
                                </div>
                                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
                                  {decodedInput.signature}
                                </div>
                                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
                                  Selector: {decodedInput.selector}
                                </div>
                              </div>
                              
                              {/* Parameters */}
                              {decodedInput.params.length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Parameters</div>
                                  <div className="space-y-2">
                                    {decodedInput.params.map((param, idx) => {
                                      const isAddress = param.type === 'address' && param.value.startsWith('0x') && param.value.length === 42;
                                      const isNumber = (param.type.startsWith('uint') || param.type.startsWith('int')) && /^\d+$/.test(param.value);
                                      
                                      return (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-sm">
                                          <span className="text-zinc-600 dark:text-zinc-400 font-medium min-w-[100px] sm:min-w-[160px]">
                                            <span className="text-zinc-400 dark:text-zinc-500 text-xs">{param.type}</span>{' '}
                                            {param.name || `param${idx}`}:
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            {isAddress ? (
                                              <Link
                                                href={buildAddressUrl(`/explorer/${chainSlug}`, param.value)}
                                                className="font-mono text-xs hover:underline cursor-pointer break-all"
                                                style={{ color: themeColor }}
                                              >
                                                {param.value}
                                              </Link>
                                            ) : isNumber ? (
                                              <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                                                {BigInt(param.value).toLocaleString()}
                                              </span>
                                            ) : param.components && param.components.length > 0 ? (
                                              <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs space-y-1">
                                                {param.components.map((comp, compIdx) => {
                                                  const compIsAddress = comp.type === 'address' && comp.value.startsWith('0x') && comp.value.length === 42;
                                                  const compIsNumber = (comp.type.startsWith('uint') || comp.type.startsWith('int')) && /^\d+$/.test(comp.value);
                                                  return (
                                                    <div key={compIdx} className="flex items-start gap-2">
                                                      <span className="text-zinc-400 dark:text-zinc-500 font-mono">
                                                        {comp.name || `[${compIdx}]`}:
                                                      </span>
                                                      {compIsAddress ? (
                                                        <Link
                                                          href={buildAddressUrl(`/explorer/${chainSlug}`, comp.value)}
                                                          className="font-mono hover:underline cursor-pointer break-all"
                                                          style={{ color: themeColor }}
                                                        >
                                                          {comp.value}
                                                        </Link>
                                                      ) : compIsNumber ? (
                                                        <span className="font-mono text-zinc-900 dark:text-zinc-100 break-all">
                                                          {BigInt(comp.value).toLocaleString()}
                                                        </span>
                                                      ) : (
                                                        <span className="font-mono text-zinc-900 dark:text-zinc-100 break-all">
                                                          {comp.value}
                                                        </span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                                                {param.value}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Raw View */
                    <div className="w-full">
                              <pre className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg overflow-x-auto max-h-64 text-zinc-700 dark:text-zinc-300">
                        {tx?.input || '0x'}
                      </pre>
                            </div>
                          )}
                    </div>
                  }
                />
                  );
                })()}
              </>
            )}
            </div>
          ) : (
            /* Logs Tab */
            <div className="p-4 sm:p-6">
              {tx?.logs && tx.logs.length > 0 ? (
                <div className="space-y-4">
                  {tx.logs.map((log, index) => {
                    const logIndex = parseInt(log.logIndex || '0', 16);
                    const decodedEvent = decodeEventLog(log);
                    
                    return (
                      <div
                        key={index}
                        className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4"
                      >
                        {/* Header with Index Badge */}
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                {logIndex}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            {/* Address */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                  Address
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm break-all" style={{ color: themeColor }}>
                                  {log.address}
                                </span>
                                <CopyButton text={log.address} />
                                <Link
                                  href={`/explorer/${chainSlug}`}
                                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                                  title="View contract"
                                >
                                  <Hash className="w-4 h-4" />
                                </Link>
                              </div>
                            </div>

                            {/* Event Name */}
                            {decodedEvent ? (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Name
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    {decodedEvent.name}
                                  </span>
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                    (
                                  </span>
                                  {decodedEvent.params.map((param, paramIdx) => (
                                    <span key={paramIdx} className="text-sm">
                                      {param.indexed && (
                                        <span className="text-xs text-blue-500 dark:text-blue-400 mr-1">indexed</span>
                                      )}
                                      <span className="text-zinc-600 dark:text-zinc-400">{param.type} </span>
                                      <span className="font-medium" style={{ color: param.indexed ? '#3b82f6' : '#10b981' }}>
                                        {param.name || `param${paramIdx}`}
                                      </span>
                                      {paramIdx < decodedEvent.params.length - 1 && (
                                        <span className="text-zinc-600 dark:text-zinc-400">, </span>
                                      )}
                                    </span>
                                  ))}
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">)</span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Name
                                  </span>
                                </div>
                                <span className="text-sm text-zinc-500 dark:text-zinc-400">Unknown Event</span>
                              </div>
                            )}

                            {/* Topics */}
                            {log.topics && log.topics.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Topics
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {log.topics.map((topic, topicIdx) => {
                                    // Find the corresponding indexed parameter for this topic
                                    const indexedParams = decodedEvent?.params.filter(p => p.indexed) || [];
                                    const paramForTopic = topicIdx > 0 ? indexedParams[topicIdx - 1] : null;
                                    
                                    return (
                                    <div key={topicIdx} className="flex items-start gap-2">
                                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-6 flex-shrink-0">
                                        {topicIdx}:
                                      </span>
                                        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                                        <span className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                                          {topic}
                                        </span>
                                        <CopyButton text={topic} />
                                          {paramForTopic && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                              {paramForTopic.name}: {paramForTopic.type === 'address' ? formatAddress(paramForTopic.value) : paramForTopic.value}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Data */}
                            {log.data && log.data !== '0x' && (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Data
                                  </span>
                                </div>
                                {decodedEvent ? (
                                  <div className="space-y-2">
                                    {decodedEvent.params
                                      .filter(p => !p.indexed)
                                      .map((param, paramIdx) => (
                                        <div key={paramIdx} className="flex items-center gap-2">
                                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                            {param.name || `param${paramIdx}`}:
                                      </span>
                                          <span className="text-sm font-medium text-zinc-900 dark:text-white font-mono">
                                            {param.type === 'address' ? formatAddress(param.value) : param.value}
                                      </span>
                                          <CopyButton text={param.value} />
                                        </div>
                                      ))}
                                    {decodedEvent.params.filter(p => !p.indexed).length === 0 && (
                                      <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                                        {log.data}
                                      </span>
                                      <CopyButton text={log.data} />
                                      </div>
                                  )}
                                </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                                      {log.data}
                                    </span>
                                    <CopyButton text={log.data} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">No logs found for this transaction.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

