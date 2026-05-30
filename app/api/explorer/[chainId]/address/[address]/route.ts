import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from '@/constants/l1-chains.json';

// Initialize Avalanche SDK
const avalanche = new Avalanche({
  network: "mainnet",
});

interface NativeTransaction {
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
  value?: string; // For ERC-1155
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

interface AddressInfo {
  address: string;
  isContract: boolean;
  contractMetadata?: ContractMetadata;
  nativeBalance: {
    balance: string;
    balanceFormatted: string;
    symbol: string;
    price?: number;
    valueUsd?: number;
  };
  // ERC20 balances are fetched separately via /erc20-balances endpoint
  transactions: NativeTransaction[];
  erc20Transfers: Erc20Transfer[];
  nftTransfers: NftTransfer[];
  internalTransactions: InternalTransaction[];
  nextPageToken?: string;
  addressChains?: AddressChain[];
}

// RPC helper
async function fetchFromRPC(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'RPC error');
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Check if address is a contract
async function isContract(rpcUrl: string, address: string): Promise<boolean> {
  try {
    const code = await fetchFromRPC(rpcUrl, 'eth_getCode', [address, 'latest']) as string;
    // If code is '0x' or empty, it's an EOA (Externally Owned Account)
    return code !== '0x' && code !== '' && code.length > 2;
  } catch (error) {
    console.warn('Failed to check if address is contract:', error);
    return false;
  }
}

// Get native balance from RPC using eth_getBalance
async function getNativeBalance(rpcUrl: string, address: string, tokenSymbol?: string): Promise<AddressInfo['nativeBalance']> {
  try {
    const balanceHex = await fetchFromRPC(rpcUrl, 'eth_getBalance', [address, 'latest']) as string;
    const balanceWei = BigInt(balanceHex);
    const decimals = 18; // Native tokens typically have 18 decimals
    const balanceFormatted = (Number(balanceWei) / Math.pow(10, decimals)).toFixed(6);

    return {
      balance: balanceWei.toString(),
      balanceFormatted,
      symbol: tokenSymbol || '',
    };
  } catch (error) {
    console.warn('Failed to fetch native balance from RPC:', error);
    return {
      balance: '0',
      balanceFormatted: '0',
      symbol: tokenSymbol || '',
    };
  }
}

// ERC20 balances are now fetched via separate /erc20-balances endpoint

// Get contract metadata using Glacier
async function getContractMetadata(address: string, chainId: string): Promise<ContractMetadata | undefined> {
  try {
    const result = await avalanche.data.evm.contracts.getMetadata({
      address: address,
      chainId: chainId,
    });

    if (!result) return undefined;

    // Extract symbol based on contract type (ERC-20, ERC-721, ERC-1155 have symbol, UNKNOWN doesn't)
    let symbol: string | undefined;
    if (result.ercType === 'ERC-20' || result.ercType === 'ERC-721' || result.ercType === 'ERC-1155') {
      symbol = result.symbol || undefined;
    }

    return {
      name: result.name || undefined,
      description: result.description || undefined,
      officialSite: result.officialSite || undefined,
      email: result.email || undefined,
      logoUri: result.logoAsset?.imageUri || undefined,
      bannerUri: result.bannerAsset?.imageUri || undefined,
      color: result.color || undefined,
      resourceLinks: result.resourceLinks?.map(link => ({
        type: link.type || '',
        url: link.url || '',
      })) || undefined,
      tags: result.tags || undefined,
      deploymentDetails: result.deploymentDetails ? {
        txHash: result.deploymentDetails.txHash || undefined,
        deployerAddress: result.deploymentDetails.deployerAddress || undefined,
        deployerContractAddress: result.deploymentDetails.deployerContractAddress || undefined,
      } : undefined,
      ercType: result.ercType || undefined,
      symbol,
    };
  } catch (error) {
    console.warn('Failed to fetch contract metadata from Glacier:', error);
    return undefined;
  }
}

// Get address chains using Glacier (multichain info)
async function getAddressChains(address: string): Promise<AddressChain[]> {
  try {
    const result = await avalanche.data.evm.address.chains.list({
      address: address,
    });

    const chains: AddressChain[] = [];
    const chainList = result.indexedChains || [];
    
    for (const chain of chainList) {
      const chainId = chain.chainId || '';
      const isTestnet = chain.isTestnet || false;
      
      // Look up chain info from l1-chains.json
      const chainInfo = l1ChainsData.find(c => c.chainId === chainId);
      
      // Build chain name with testnet suffix if needed
      let chainName = chain.chainName || chainInfo?.chainName || '';
      if (isTestnet && !chainName.endsWith(' - Testnet')) {
        chainName = `${chainName} - Testnet`;
      }
      
      chains.push({
        chainId,
        chainName,
        chainLogoUri: chain.chainLogoUri || chainInfo?.chainLogoURI || undefined,
      });
    }

    return chains;
  } catch (error) {
    console.warn('Failed to fetch address chains from Glacier:', error);
    return [];
  }
}

// Get transactions using Glacier
interface TransactionResult {
  transactions: NativeTransaction[];
  erc20Transfers: Erc20Transfer[];
  nftTransfers: NftTransfer[];
  internalTransactions: InternalTransaction[];
  nextPageToken?: string;
}

async function getTransactions(
  address: string, 
  chainId: string,
  pageToken?: string
): Promise<TransactionResult> {
  try {
    const result = await avalanche.data.evm.address.transactions.list({
      address: address,
      chainId: chainId,
      sortOrder: 'desc',
      pageSize: 25,
      pageToken: pageToken,
    });

    const transactions: NativeTransaction[] = [];
    const erc20Transfers: Erc20Transfer[] = [];
    const nftTransfers: NftTransfer[] = [];
    const internalTransactions: InternalTransaction[] = [];
    let nextPageToken: string | undefined;

    for await (const page of result) {
      const txDetailsList = page.result?.transactions || [];
      nextPageToken = page.result?.nextPageToken;
      
      for (const txDetails of txDetailsList) {
        const nativeTx = txDetails.nativeTransaction;
        if (!nativeTx) continue;
        
        const blockNumber = nativeTx.blockNumber?.toString() || '';
        const timestamp = nativeTx.blockTimestamp ?? 0;
        const txHash = nativeTx.txHash || '';
        
        // Native transaction
        // Clean method name - remove parameters like "mint(address)" -> "mint"
        let methodName = nativeTx.method?.methodName || undefined;
        if (methodName && methodName.includes('(')) {
          methodName = methodName.split('(')[0];
        }
        
        // Use methodHash as methodId (function selector) for decoding
        const methodHash = nativeTx.method?.methodHash;
        const methodId = methodHash && methodHash.startsWith('0x') && methodHash.length === 10 
          ? methodHash 
          : undefined;
        
        transactions.push({
          hash: txHash,
          blockNumber,
          blockIndex: nativeTx.blockIndex ?? 0,
          timestamp,
          from: nativeTx.from?.address || '',
          to: nativeTx.to?.address || null,
          value: nativeTx.value || '0',
          gasLimit: nativeTx.gasLimit || '0',
          gasUsed: nativeTx.gasUsed || '0',
          gasPrice: nativeTx.gasPrice || '0',
          nonce: nativeTx.nonce || '0',
          txStatus: nativeTx.txStatus?.toString() || '1',
          txType: nativeTx.txType ?? 0,
          method: methodName,
          methodId: methodId,
        });
        
        // ERC20 transfers
        if (txDetails.erc20Transfers) {
          for (const transfer of txDetails.erc20Transfers) {
            erc20Transfers.push({
              txHash,
              blockNumber,
              timestamp,
              from: transfer.from?.address || '',
              to: transfer.to?.address || '',
              value: transfer.value || '0',
              tokenAddress: transfer.erc20Token?.address || '',
              tokenName: transfer.erc20Token?.name || '',
              tokenSymbol: transfer.erc20Token?.symbol || '',
              tokenDecimals: transfer.erc20Token?.decimals || 18,
              tokenLogo: transfer.erc20Token?.logoUri,
              logIndex: transfer.logIndex ?? 0,
            });
          }
        }
        
        // ERC721 transfers (NFT)
        if (txDetails.erc721Transfers) {
          for (const transfer of txDetails.erc721Transfers) {
            nftTransfers.push({
              txHash,
              blockNumber,
              timestamp,
              from: transfer.from?.address || '',
              to: transfer.to?.address || '',
              tokenAddress: transfer.erc721Token?.address || '',
              tokenName: transfer.erc721Token?.name || '',
              tokenSymbol: transfer.erc721Token?.symbol || '',
              tokenId: transfer.erc721Token?.tokenId || '',
              tokenType: 'ERC-721',
              logIndex: transfer.logIndex ?? 0,
            });
          }
        }
        
        // ERC1155 transfers (NFT)
        if (txDetails.erc1155Transfers) {
          for (const transfer of txDetails.erc1155Transfers) {
            nftTransfers.push({
              txHash,
              blockNumber,
              timestamp,
              from: transfer.from?.address || '',
              to: transfer.to?.address || '',
              tokenAddress: transfer.erc1155Token?.address || '',
              tokenName: transfer.erc1155Token?.metadata?.name || '',
              tokenSymbol: transfer.erc1155Token?.metadata?.symbol || '',
              tokenId: transfer.erc1155Token?.tokenId || '',
              tokenType: 'ERC-1155',
              value: transfer.value,
              logIndex: transfer.logIndex ?? 0,
            });
          }
        }
        
        // Internal transactions
        if (txDetails.internalTransactions) {
          for (const internalTx of txDetails.internalTransactions) {
            internalTransactions.push({
              txHash,
              blockNumber,
              timestamp,
              from: internalTx.from?.address || '',
              to: internalTx.to?.address || '',
              value: internalTx.value || '0',
              gasUsed: internalTx.gasUsed || '0',
              gasLimit: internalTx.gasLimit || '0',
              txType: internalTx.internalTxType || '',
              isReverted: internalTx.isReverted ?? false,
            });
          }
        }
      }
      // Only get first page
      break;
    }

    return { transactions, erc20Transfers, nftTransfers, internalTransactions, nextPageToken };
  } catch (error) {
    console.warn('Failed to fetch transactions from Glacier:', error);
    return { transactions: [], erc20Transfers: [], nftTransfers: [], internalTransactions: [] };
  }
}

// Helper to track timing
async function timed<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string; address: string }> }
) {
  const totalStart = performance.now();
  const { chainId, address: rawAddress } = await params;
  
  // Get query params
  const { searchParams } = new URL(request.url);
  const pageToken = searchParams.get('pageToken') || undefined;
  const customRpcUrl = searchParams.get('rpcUrl');
  const customTokenSymbol = searchParams.get('tokenSymbol');

  // Validate and normalize address
  const address = rawAddress.toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }

  const chain = l1ChainsData.find(c => c.chainId === chainId) as any;
  const rpcUrl = chain?.rpcUrl || customRpcUrl;
  const tokenSymbol = chain?.networkToken?.symbol || customTokenSymbol || undefined;
  
  if (!rpcUrl) {
    return NextResponse.json({ error: 'Chain not found or RPC URL missing. Provide rpcUrl query parameter for custom chains.' }, { status: 404 });
  }

  try {
    const timings: Record<string, number> = {};

    // Fetch all data in parallel with timing
    // Note: ERC20 balances are fetched separately via /erc20-balances endpoint
    // Note: Dune labels are fetched separately via /api/dune/[address] endpoint
    const [
      isContractTimed,
      nativeBalanceTimed,
      txResultTimed,
      addressChainsTimed,
    ] = await Promise.all([
      timed('isContract', () => isContract(rpcUrl, address)),
      timed('nativeBalance', () => getNativeBalance(rpcUrl, address, tokenSymbol)),
      timed('transactions', () => getTransactions(address, chainId, pageToken)),
      timed('addressChains', () => getAddressChains(address)),
    ]);

    // Store timings
    timings.isContract = isContractTimed.duration;
    timings.nativeBalance = nativeBalanceTimed.duration;
    timings.transactions = txResultTimed.duration;
    timings.addressChains = addressChainsTimed.duration;

    // Extract results
    const isContractResult = isContractTimed.result;
    const nativeBalance = nativeBalanceTimed.result;
    const txResult = txResultTimed.result;
    const addressChains = addressChainsTimed.result;

    // Fetch contract metadata if it's a contract
    let contractMetadata: ContractMetadata | undefined;
    if (isContractResult) {
      const metadataTimed = await timed('contractMetadata', () => getContractMetadata(address, chainId));
      contractMetadata = metadataTimed.result;
      timings.contractMetadata = metadataTimed.duration;
    }

    const addressInfo: AddressInfo = {
      address,
      isContract: isContractResult,
      contractMetadata,
      nativeBalance,
      // ERC20 balances fetched separately via /erc20-balances endpoint
      // Dune labels fetched separately via /api/dune/[address] endpoint
      transactions: txResult.transactions,
      erc20Transfers: txResult.erc20Transfers,
      nftTransfers: txResult.nftTransfers,
      internalTransactions: txResult.internalTransactions,
      nextPageToken: txResult.nextPageToken,
      addressChains: addressChains.length > 0 ? addressChains : undefined,
    };

    const totalDuration = performance.now() - totalStart;
    
    // Log timings
    console.log(`[Address API] ${address} on chain ${chainId} - Total: ${totalDuration.toFixed(0)}ms`);
    console.log(`  Parallel fetch: isContract=${timings.isContract.toFixed(0)}ms, nativeBalance=${timings.nativeBalance.toFixed(0)}ms`);
    console.log(`  Parallel fetch: transactions=${timings.transactions.toFixed(0)}ms, addressChains=${timings.addressChains.toFixed(0)}ms`);
    if (timings.contractMetadata) {
      console.log(`  Sequential: contractMetadata=${timings.contractMetadata.toFixed(0)}ms`);
    }

    return NextResponse.json(addressInfo);
  } catch (error) {
    const totalDuration = performance.now() - totalStart;
    console.error(`[Address API] Error fetching ${address} on chain ${chainId} after ${totalDuration.toFixed(0)}ms:`, error);
    return NextResponse.json({ error: 'Failed to fetch address data' }, { status: 500 });
  }
}

