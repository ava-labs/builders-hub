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
  timestampMilliseconds?: string; // Avalanche-specific: block timestamp in milliseconds (hex)
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

// ACP-176: Dynamic EVM gas limit and price discovery
// https://build.avax.network/docs/acps/176-dynamic-evm-gas-limit-and-price-discovery-updates
const ACP176_STATE_SIZE = 24; // 3 * 8 bytes (three uint64s)
const ACP176_MIN_TARGET_PER_SECOND = 1_000_000n;
const ACP176_TARGET_CONVERSION = 33_554_432n; // 1024 * 32768 = 2^25
const ACP176_MIN_GAS_PRICE = 1n;
const ACP176_TARGET_TO_PRICE_UPDATE_CONVERSION = 87n;
const ACP176_TARGET_TO_MAX_CAPACITY = 10n;

function fakeExponential(factor: bigint, numerator: bigint, denominator: bigint): bigint {
  let result = 0n;
  let accum = factor * denominator;
  let i = 1n;
  while (accum > 0n) {
    result += accum;
    accum = (accum * numerator) / (denominator * i);
    i++;
  }
  return result / denominator;
}

interface ACP176FeeState {
  gasCapacity: string;
  gasExcess: string;
  targetExcess: string;
  targetGasPerSecond: string;
  maxCapacity: string;
  gasPrice: string; // wei
}

function parseACP176FeeState(extraData: string): ACP176FeeState | undefined {
  const hex = extraData.startsWith('0x') ? extraData.slice(2) : extraData;
  // Need at least 24 bytes = 48 hex chars
  if (hex.length < ACP176_STATE_SIZE * 2) return undefined;

  const gasCapacity = BigInt('0x' + hex.slice(0, 16));
  const gasExcess = BigInt('0x' + hex.slice(16, 32));
  const targetExcess = BigInt('0x' + hex.slice(32, 48));

  const target = fakeExponential(
    ACP176_MIN_TARGET_PER_SECOND,
    targetExcess,
    ACP176_TARGET_CONVERSION,
  );

  const maxCapacity = target * ACP176_TARGET_TO_MAX_CAPACITY;

  const priceUpdateConversion = target * ACP176_TARGET_TO_PRICE_UPDATE_CONVERSION;
  const gasPrice = priceUpdateConversion > 0n
    ? fakeExponential(ACP176_MIN_GAS_PRICE, gasExcess, priceUpdateConversion)
    : 0n;

  return {
    gasCapacity: gasCapacity.toString(),
    gasExcess: gasExcess.toString(),
    targetExcess: targetExcess.toString(),
    targetGasPerSecond: target.toString(),
    maxCapacity: maxCapacity.toString(),
    gasPrice: gasPrice.toString(),
  };
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

    // Parse timestampMilliseconds for Avalanche (hex string to number)
    const timestampMilliseconds = block.timestampMilliseconds 
      ? parseInt(block.timestampMilliseconds, 16) 
      : undefined;

    // Parse ACP-176 fee state from extraData (C-Chain only)
    const feeState = chainId === '43114' && block.extraData
      ? parseACP176FeeState(block.extraData)
      : undefined;

    // Format the response
    const formattedBlock = {
      number: formatHexToNumber(block.number),
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: hexToTimestamp(block.timestamp),
      timestampMilliseconds,
      miner: block.miner,
      transactionCount: block.transactions.length,
      transactions: transactionHashes,
      gasUsed: formatHexToNumber(block.gasUsed),
      gasLimit: formatHexToNumber(block.gasLimit),
      baseFeePerGas: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : undefined,
      gasFee,
      feeState,
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

