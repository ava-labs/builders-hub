import type { NextRequest } from 'next/server';
import { z } from 'zod';
import l1ChainsData from '@/constants/l1-chains.json';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { validateParams } from '@/lib/api/validate';
import { NotFoundError } from '@/lib/api/errors';

const paramsSchema = z.object({
  chainId: z.string().regex(/^\d+$/, 'chainId must be numeric'),
  blockNumber: z.string().regex(/^\d+$/, 'blockNumber must be numeric'),
});

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

export const GET = withApi(
  async (req: NextRequest, { params }) => {
    const { chainId, blockNumber } = validateParams(params, paramsSchema);

    // Get query params for custom chains
    const { searchParams } = new URL(req.url);
    const customRpcUrl = searchParams.get('rpcUrl');

    const chain = l1ChainsData.find((c) => c.chainId === chainId);
    const rpcUrl = chain?.rpcUrl || customRpcUrl;

    if (!rpcUrl) {
      throw new NotFoundError('Chain not found or RPC URL missing. Provide rpcUrl query parameter for custom chains.');
    }

    // Convert blockNumber to hex
    const blockParam = `0x${parseInt(blockNumber).toString(16)}`;

    // Fetch block with full transaction objects
    const block = (await fetchFromRPC(rpcUrl, 'eth_getBlockByNumber', [blockParam, true])) as RpcBlock | null;

    if (!block) {
      throw new NotFoundError('Block');
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

    return successResponse({ transactions });
  },
  {
    rateLimit: { windowMs: 60_000, maxRequests: 60, identifier: 'ip' },
  },
);
