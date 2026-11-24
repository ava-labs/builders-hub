import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { readJsonBody } from '@/lib/api/json-body';
import { callJsonRpc, validatePublicRpcUrl, validateRpcAddress, getClientIp } from '../rpc-utils';

const bodySchema = z.object({
  rpcUrl: z.string().optional(),
  address: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Unauthenticated public utility endpoint — throttle per IP so it can't be
  // used as an unbounded SSRF/relay probe.
  if (!checkRateLimit(`l1-upgrade-code:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 60 }).allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 });
  }

  const body = await readJsonBody(request, bodySchema);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const rpcUrl = body.rpcUrl?.trim();
  const address = body.address?.trim();
  if (!rpcUrl || !address) {
    return NextResponse.json({ error: 'rpcUrl and address are required' }, { status: 400 });
  }

  const urlError = validatePublicRpcUrl(rpcUrl);
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });

  const addressError = validateRpcAddress(address);
  if (addressError) return NextResponse.json({ error: addressError }, { status: 400 });

  try {
    const code = await callJsonRpc<string>(rpcUrl, 'eth_getCode', [address, 'latest']);
    if (!code || code === '0x') {
      return NextResponse.json(
        {
          error: `No contract code found at ${address} on ${new URL(rpcUrl).host}. Point "Source RPC URL" at a chain where this contract is deployed (e.g. Avalanche C-Chain).`,
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch runtime bytecode.' },
      { status: 502 },
    );
  }
}
