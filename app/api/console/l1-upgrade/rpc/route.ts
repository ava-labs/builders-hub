import { NextRequest, NextResponse } from 'next/server';
import { deriveActivePrecompiles } from '@/lib/console/upgrade-json';
import { callJsonRpc, validatePublicRpcUrl } from '../rpc-utils';

type RpcCheckBody = {
  rpcUrl?: string;
};

type LatestBlockResponse = {
  timestamp?: string;
};

function parseBlockTimestamp(block: LatestBlockResponse | null): number | null {
  const raw = block?.timestamp;
  if (!raw) return null;
  if (raw.startsWith('0x')) return Number.parseInt(raw, 16);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function safeRpcCall<T>(rpcUrl: string, method: string, params: unknown[] = []) {
  try {
    return { ok: true as const, value: await callJsonRpc<T>(rpcUrl, method, params) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : `Failed to call ${method}`,
    };
  }
}

export async function POST(request: NextRequest) {
  let body: RpcCheckBody;
  try {
    body = (await request.json()) as RpcCheckBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rpcUrl = body.rpcUrl?.trim();
  if (!rpcUrl) return NextResponse.json({ error: 'rpcUrl is required' }, { status: 400 });

  const urlError = validatePublicRpcUrl(rpcUrl);
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });

  const [chainConfig, activeRules, latestBlock] = await Promise.all([
    safeRpcCall<unknown>(rpcUrl, 'eth_getChainConfig'),
    safeRpcCall<unknown>(rpcUrl, 'eth_getActiveRulesAt'),
    safeRpcCall<LatestBlockResponse>(rpcUrl, 'eth_getBlockByNumber', ['latest', false]),
  ]);

  const latestBlockTimestamp = latestBlock.ok ? parseBlockTimestamp(latestBlock.value) : null;

  // Hosted public RPCs often don't expose eth_getActiveRulesAt — derive the
  // active set from eth_getChainConfig instead and only report an error when
  // both sources are unavailable.
  let activeRulesValue = activeRules.ok ? activeRules.value : null;
  let activeRulesError = activeRules.ok ? null : activeRules.error;
  if (!activeRules.ok && chainConfig.ok) {
    activeRulesValue = { precompiles: deriveActivePrecompiles(chainConfig.value, latestBlockTimestamp) };
    activeRulesError = null;
  }

  return NextResponse.json({
    chainConfig: chainConfig.ok ? chainConfig.value : null,
    activeRules: activeRulesValue,
    latestBlockTimestamp,
    errors: {
      chainConfig: chainConfig.ok ? null : chainConfig.error,
      activeRules: activeRulesError,
      latestBlock: latestBlock.ok ? null : latestBlock.error,
    },
  });
}
