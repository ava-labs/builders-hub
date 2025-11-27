import { NextResponse } from 'next/server';
import l1ChainsData from '@/constants/l1-chains.json';

// ERC20 function signatures
const ERC20_SIGNATURES: Record<string, { name: string; inputs: string[] }> = {
  '0xa9059cbb': { name: 'transfer', inputs: ['address', 'uint256'] },
  '0x23b872dd': { name: 'transferFrom', inputs: ['address', 'address', 'uint256'] },
  '0x095ea7b3': { name: 'approve', inputs: ['address', 'uint256'] },
  '0x70a08231': { name: 'balanceOf', inputs: ['address'] },
  '0xdd62ed3e': { name: 'allowance', inputs: ['address', 'address'] },
  '0x18160ddd': { name: 'totalSupply', inputs: [] },
  '0x313ce567': { name: 'decimals', inputs: [] },
  '0x06fdde03': { name: 'name', inputs: [] },
  '0x95d89b41': { name: 'symbol', inputs: [] },
};

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

function decodeERC20Input(input: string): { method: string; params: Record<string, string> } | null {
  if (!input || input === '0x' || input.length < 10) {
    return null;
  }

  const methodId = input.slice(0, 10).toLowerCase();
  const sig = ERC20_SIGNATURES[methodId];

  if (!sig) {
    return null;
  }

  const params: Record<string, string> = {};
  const data = input.slice(10);

  try {
    let offset = 0;
    for (let i = 0; i < sig.inputs.length; i++) {
      const inputType = sig.inputs[i];
      const chunk = data.slice(offset, offset + 64);
      
      if (inputType === 'address') {
        params[`param${i + 1}`] = '0x' + chunk.slice(24);
      } else if (inputType === 'uint256') {
        const value = BigInt('0x' + chunk);
        params[`param${i + 1}`] = value.toString();
      }
      
      offset += 64;
    }
  } catch {
    return { method: sig.name, params: {} };
  }

  return { method: sig.name, params };
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

// Decode ERC20 Transfer event log
function decodeTransferLog(log: { topics: string[]; data: string }): { from: string; to: string; value: string } | null {
  // Transfer event signature: Transfer(address,address,uint256)
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  
  if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC.toLowerCase() || log.topics.length < 3) {
    return null;
  }

  try {
    const from = '0x' + log.topics[1].slice(26);
    const to = '0x' + log.topics[2].slice(26);
    const value = BigInt(log.data).toString();
    return { from, to, value };
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string; txHash: string }> }
) {
  const { chainId, txHash } = await params;

  const chain = l1ChainsData.find(c => c.chainId === chainId);
  if (!chain || !chain.rpcUrl) {
    return NextResponse.json({ error: 'Chain not found or RPC URL missing' }, { status: 404 });
  }

  try {
    const rpcUrl = chain.rpcUrl;

    // Use eth_getTransactionReceipt as the primary method (more widely available)
    const receipt = await fetchFromRPC(rpcUrl, 'eth_getTransactionReceipt', [txHash]) as RpcReceipt | null;

    if (!receipt) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Try to get full transaction details (may not be available on all RPCs)
    let tx: RpcTransaction | null = null;
    try {
      tx = await fetchFromRPC(rpcUrl, 'eth_getTransactionByHash', [txHash]) as RpcTransaction | null;
    } catch {
      // eth_getTransactionByHash not available, continue with receipt only
      console.log('eth_getTransactionByHash not available, using receipt only');
    }

    // Fetch block for timestamp
    let timestamp = null;
    if (receipt.blockNumber) {
      try {
        const block = await fetchFromRPC(rpcUrl, 'eth_getBlockByNumber', [receipt.blockNumber, false]) as RpcBlock | null;
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
      confirmations = receipt.blockNumber ? parseInt(latestBlock, 16) - parseInt(receipt.blockNumber, 16) : 0;
    } catch {
      // Block number fetch failed
    }

    // Decode input data (only if we have full tx)
    const decodedInput = tx?.input ? decodeERC20Input(tx.input) : null;

    // Decode transfer events from receipt logs
    const transfers: Array<{ from: string; to: string; value: string; tokenAddress: string }> = [];
    if (receipt.logs) {
      for (const log of receipt.logs) {
        const transfer = decodeTransferLog(log);
        if (transfer) {
          transfers.push({
            ...transfer,
            tokenAddress: log.address,
          });
        }
      }
    }

    // Calculate transaction fee using receipt data
    const gasUsed = formatHexToNumber(receipt.gasUsed);
    const effectiveGasPrice = receipt.effectiveGasPrice || tx?.gasPrice || '0x0';
    const txFee = effectiveGasPrice !== '0x0'
      ? (BigInt(receipt.gasUsed) * BigInt(effectiveGasPrice)).toString()
      : '0';

    // Build response using receipt data primarily, supplement with tx data if available
    const formattedTx = {
      hash: receipt.transactionHash,
      status: receipt.status === '0x1' ? 'success' : 'failed',
      blockNumber: receipt.blockNumber ? formatHexToNumber(receipt.blockNumber) : null,
      blockHash: receipt.blockHash,
      timestamp,
      confirmations,
      from: receipt.from,
      to: receipt.to,
      contractAddress: receipt.contractAddress || null,
      // Value only available from tx, default to 0 if not available
      value: tx?.value ? formatWeiToEther(tx.value) : '0',
      valueWei: tx?.value || '0x0',
      // Gas price from receipt's effectiveGasPrice or tx's gasPrice
      gasPrice: effectiveGasPrice !== '0x0' ? formatGwei(effectiveGasPrice) : 'N/A',
      gasPriceWei: effectiveGasPrice,
      // Gas limit only from tx
      gasLimit: tx?.gas ? formatHexToNumber(tx.gas) : 'N/A',
      gasUsed,
      txFee: txFee !== '0' ? formatWeiToEther(txFee) : '0',
      txFeeWei: txFee,
      // Nonce only from tx
      nonce: tx?.nonce ? formatHexToNumber(tx.nonce) : 'N/A',
      transactionIndex: receipt.transactionIndex ? formatHexToNumber(receipt.transactionIndex) : null,
      // Input only from tx
      input: tx?.input || '0x',
      decodedInput,
      transfers,
      type: tx?.type ? parseInt(tx.type, 16) : 0,
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

