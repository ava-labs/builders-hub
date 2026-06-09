import { NextRequest, NextResponse } from 'next/server';
import { callJsonRpc, validatePublicRpcUrl } from '../rpc-utils';

type RpcCheckBody = {
  rpcUrl?: string;
};

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

  const [chainConfig, activeRules] = await Promise.all([
    safeRpcCall<unknown>(rpcUrl, 'eth_getChainConfig'),
    safeRpcCall<unknown>(rpcUrl, 'eth_getActiveRulesAt'),
  ]);

  return NextResponse.json({
    chainConfig: chainConfig.ok ? chainConfig.value : null,
    activeRules: activeRules.ok ? activeRules.value : null,
    errors: {
      chainConfig: chainConfig.ok ? null : chainConfig.error,
      activeRules: activeRules.ok ? null : activeRules.error,
    },
  });
}
