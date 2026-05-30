import { NextResponse } from 'next/server';
import l1ChainsData from '@/constants/l1-chains.json';

interface RpcTransaction {
  hash: string;
  nonce: string;
  blockHash: string;
  blockNumber: string;
  transactionIndex: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: string;
  input: string;
  v?: string;
  r?: string;
  s?: string;
  type?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

interface RpcReceipt {
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  contractAddress: string | null;
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
  status: string;
  logsBloom: string;
  effectiveGasPrice?: string;
}

interface RpcBlock {
  timestamp: string;
  number: string;
}

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

function formatHexToNumber(hex: string): string {
  return parseInt(hex, 16).toString();
}

function formatWeiToEther(wei: string): string {
  const weiValue = BigInt(wei);
  const divisor = BigInt(10 ** 18);
  const intPart = weiValue / divisor;
  const fracPart = weiValue % divisor;
  const fracStr = fracPart.toString().padStart(18, '0');
  return `${intPart}.${fracStr}`;
}

function formatGwei(wei: string): string {
  const weiValue = BigInt(wei);
  const gweiValue = Number(weiValue) / 1e9;
  return `${gweiValue.toFixed(9)} Gwei`;
}

function hexToTimestamp(hex: string): string {
  const timestamp = parseInt(hex, 16) * 1000;
  return new Date(timestamp).toISOString();
}


export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string; txHash: string }> }
) {
  const { chainId, txHash } = await params;

  // Get query params for custom chains
  const { searchParams } = new URL(request.url);
  const customRpcUrl = searchParams.get('rpcUrl');

  const chain = l1ChainsData.find(c => c.chainId === chainId);
  const rpcUrl = chain?.rpcUrl || customRpcUrl;
  
  if (!rpcUrl) {
    return NextResponse.json({ error: 'Chain not found or RPC URL missing. Provide rpcUrl query parameter for custom chains.' }, { status: 404 });
  }

  try {

    // Fetch receipt and transaction in parallel for better performance
    const [receiptResult, txResult] = await Promise.allSettled([
      fetchFromRPC(rpcUrl, 'eth_getTransactionReceipt', [txHash]),
      fetchFromRPC(rpcUrl, 'eth_getTransactionByHash', [txHash]),
    ]);

    const receipt = receiptResult.status === 'fulfilled' ? receiptResult.value as RpcReceipt | null : null;
    const tx = txResult.status === 'fulfilled' ? txResult.value as RpcTransaction | null : null;

    if (!receipt) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Log if transaction fetch failed but continue with receipt
    if (txResult.status === 'rejected') {
      console.log(`eth_getTransactionByHash failed for ${txHash}, using receipt only:`, txResult.reason);
    }

    // Fetch block for timestamp (use tx blockNumber if receipt doesn't have it, though receipt should always have it)
    let timestamp = null;
    const blockNumberForTimestamp = receipt.blockNumber || tx?.blockNumber;
    if (blockNumberForTimestamp) {
      try {
        const block = await fetchFromRPC(rpcUrl, 'eth_getBlockByNumber', [blockNumberForTimestamp, false]) as RpcBlock | null;
        if (block) {
          timestamp = hexToTimestamp(block.timestamp);
        }
      } catch {
        // Block fetch failed, continue without timestamp
      }
    }

    // Get current block for confirmations
    let confirmations = 0;
    try {
      const latestBlock = await fetchFromRPC(rpcUrl, 'eth_blockNumber', []) as string;
      const txBlockNumber = receipt.blockNumber || tx?.blockNumber;
      if (txBlockNumber) {
        confirmations = Math.max(0, parseInt(latestBlock, 16) - parseInt(txBlockNumber, 16));
      }
    } catch {
      // Block number fetch failed
    }

    // Calculate transaction fee using receipt data
    const gasUsed = formatHexToNumber(receipt.gasUsed);
    // Prefer effectiveGasPrice from receipt (more accurate for EIP-1559), fallback to tx gasPrice
    const effectiveGasPrice = receipt.effectiveGasPrice || tx?.gasPrice || '0x0';
    const txFee = effectiveGasPrice !== '0x0'
      ? (BigInt(receipt.gasUsed) * BigInt(effectiveGasPrice)).toString()
      : '0';

    // Use transaction fields when available, fallback to receipt fields
    // Transaction object has more complete data, so prefer it when available
    const transactionIndex = tx?.transactionIndex 
      ? formatHexToNumber(tx.transactionIndex) 
      : receipt.transactionIndex 
        ? formatHexToNumber(receipt.transactionIndex) 
        : null;
    
    const blockNumber = tx?.blockNumber 
      ? formatHexToNumber(tx.blockNumber) 
      : receipt.blockNumber 
        ? formatHexToNumber(receipt.blockNumber) 
        : null;
    
    const blockHash = tx?.blockHash || receipt.blockHash || null;
    const from = tx?.from || receipt.from;
    const to = tx?.to !== undefined ? tx.to : receipt.to;

    // Build response using transaction data when available, supplement with receipt data
    const formattedTx = {
      hash: tx?.hash || receipt.transactionHash,
      status: receipt.status === '0x1' ? 'success' : 'failed',
      blockNumber,
      blockHash,
      timestamp,
      confirmations,
      from,
      to,
      contractAddress: receipt.contractAddress || null,
      // Value only available from tx, default to 0 if not available
      value: tx?.value ? formatWeiToEther(tx.value) : '0',
      valueWei: tx?.value || '0x0',
      // Gas price: prefer receipt's effectiveGasPrice (accurate for EIP-1559), fallback to tx's gasPrice
      gasPrice: effectiveGasPrice !== '0x0' ? formatGwei(effectiveGasPrice) : 'N/A',
      gasPriceWei: effectiveGasPrice,
      // Gas limit only from tx
      gasLimit: tx?.gas ? formatHexToNumber(tx.gas) : 'N/A',
      gasUsed,
      txFee: txFee !== '0' ? formatWeiToEther(txFee) : '0',
      txFeeWei: txFee,
      // Nonce only from tx
      nonce: tx?.nonce ? formatHexToNumber(tx.nonce) : 'N/A',
      transactionIndex,
      // Input only from tx
      input: tx?.input || '0x',
      // Transaction type: parse hex string to number
      type: tx?.type ? (typeof tx.type === 'string' ? parseInt(tx.type, 16) : tx.type) : 0,
      // EIP-1559 fields only from tx
      maxFeePerGas: tx?.maxFeePerGas ? formatGwei(tx.maxFeePerGas) : null,
      maxPriorityFeePerGas: tx?.maxPriorityFeePerGas ? formatGwei(tx.maxPriorityFeePerGas) : null,
      logs: receipt.logs || [],
    };

    return NextResponse.json(formattedTx);
  } catch (error) {
    console.error(`Error fetching transaction ${txHash} on chain ${chainId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch transaction data' }, { status: 500 });
  }
}

