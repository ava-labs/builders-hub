import { NextResponse } from 'next/server';
import l1ChainsData from '@/constants/l1-chains.json';

interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: string;
  nonce: string;
  blockNumber: string;
  transactionIndex: string;
  input: string;
}

interface RpcBlock {
  number: string;
  transactions: RpcTransaction[];
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
    let blockParam: string;
    if (blockNumber.startsWith('0x')) {
      blockParam = blockNumber;
    } else {
      blockParam = `0x${parseInt(blockNumber).toString(16)}`;
    }

    // Fetch block with full transaction objects
    const block = await fetchFromRPC(rpcUrl, 'eth_getBlockByNumber', [blockParam, true]) as RpcBlock | null;

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Format transactions
    const transactions = block.transactions.map((tx: RpcTransaction) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasPrice: tx.gasPrice,
      gas: tx.gas,
      nonce: tx.nonce,
      blockNumber: tx.blockNumber,
      transactionIndex: tx.transactionIndex,
      input: tx.input,
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error(`Error fetching transactions for block ${blockNumber} on chain ${chainId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

