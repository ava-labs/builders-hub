import { NextResponse } from 'next/server';
import l1ChainsData from '@/constants/l1-chains.json';

interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: string;
  input: string;
  type?: string;
}

interface RpcTransactionReceipt {
  transactionHash: string;
  gasUsed: string;
  effectiveGasPrice: string;
  status: string;
}

interface RpcBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  transactions: RpcTransaction[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  size?: string;
  nonce?: string;
  difficulty?: string;
  totalDifficulty?: string;
  extraData?: string;
  stateRoot?: string;
  receiptsRoot?: string;
  transactionsRoot?: string;
  logsBloom?: string;
  sha3Uncles?: string;
  mixHash?: string;
}

async function fetchFromRPC(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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

function formatGwei(wei: string): string {
  const weiValue = BigInt(wei);
  const gweiValue = Number(weiValue) / 1e9;
  return `${gweiValue.toFixed(2)} Gwei`;
}

function hexToTimestamp(hex: string): string {
  const timestamp = parseInt(hex, 16) * 1000;
  return new Date(timestamp).toISOString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string; blockNumber: string }> }
) {
  const { chainId, blockNumber } = await params;

  // Get query params for custom chains
  const { searchParams } = new URL(request.url);
  const customRpcUrl = searchParams.get('rpcUrl');

  const chain = l1ChainsData.find(c => c.chainId === chainId);
  const rpcUrl = chain?.rpcUrl || customRpcUrl;
  
  if (!rpcUrl) {
    return NextResponse.json({ error: 'Chain not found or RPC URL missing. Provide rpcUrl query parameter for custom chains.' }, { status: 404 });
  }

  try {

    // Determine if blockNumber is a number or hash
    let blockParam: string | number;
    if (blockNumber.startsWith('0x')) {
      blockParam = blockNumber;
    } else {
      blockParam = `0x${parseInt(blockNumber).toString(16)}`;
    }

    // Fetch block with full transaction objects (using true parameter)
    const block = await fetchFromRPC(rpcUrl, 'eth_getBlockByNumber', [blockParam, true]) as RpcBlock | null;

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Calculate total gas fee by fetching receipts and summing all transaction fees
    let gasFee: string | undefined;
    let totalGasFeeWei = BigInt(0);

    if (block.transactions && block.transactions.length > 0) {
      // Fetch all transaction receipts in parallel
      const receiptPromises = block.transactions.map(tx => 
        fetchFromRPC(rpcUrl, 'eth_getTransactionReceipt', [tx.hash]) as Promise<RpcTransactionReceipt | null>
      );
      
      const receipts = await Promise.all(receiptPromises);
      
      // Sum up all transaction fees: gasUsed * effectiveGasPrice
      for (const receipt of receipts) {
        if (receipt && receipt.gasUsed && receipt.effectiveGasPrice) {
          const gasUsed = BigInt(receipt.gasUsed);
          const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
          totalGasFeeWei += gasUsed * effectiveGasPrice;
        }
      }
      
      // Convert from wei to native token (divide by 1e18)
      gasFee = (Number(totalGasFeeWei) / 1e18).toFixed(6);
    }

    // Extract transaction hashes for the response
    const transactionHashes = block.transactions.map(tx => tx.hash);

    // Format the response
    const formattedBlock = {
      number: formatHexToNumber(block.number),
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: hexToTimestamp(block.timestamp),
      miner: block.miner,
      transactionCount: block.transactions.length,
      transactions: transactionHashes,
      gasUsed: formatHexToNumber(block.gasUsed),
      gasLimit: formatHexToNumber(block.gasLimit),
      baseFeePerGas: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : undefined,
      gasFee,
      size: block.size ? formatHexToNumber(block.size) : undefined,
      nonce: block.nonce,
      difficulty: block.difficulty ? formatHexToNumber(block.difficulty) : undefined,
      extraData: block.extraData,
      stateRoot: block.stateRoot,
      receiptsRoot: block.receiptsRoot,
      transactionsRoot: block.transactionsRoot,
    };

    return NextResponse.json(formattedBlock);
  } catch (error) {
    console.error(`Error fetching block ${blockNumber} for chain ${chainId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch block data' }, { status: 500 });
  }
}

