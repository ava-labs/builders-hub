import { NextRequest, NextResponse } from 'next/server';
import { callJsonRpc, validatePublicRpcUrl, validateRpcAddress } from '../rpc-utils';

type CodeBody = {
  rpcUrl?: string;
  address?: string;
};

export async function POST(request: NextRequest) {
  let body: CodeBody;
  try {
    body = (await request.json()) as CodeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

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
      return NextResponse.json({ error: 'No runtime bytecode found at that address.' }, { status: 404 });
    }
    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch runtime bytecode.' },
      { status: 502 },
    );
  }
}
