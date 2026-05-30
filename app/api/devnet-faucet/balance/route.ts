import { NextResponse } from 'next/server';
import { createPublicClient, http, defineChain, formatEther } from 'viem';
import { getAuthSession } from '@/lib/auth/authSession';

const DEVNET_RPC_URL = 'https://api.avax-dev.network/ext/bc/C/rpc';
const DEVNET_CHAIN_ID = 43117;
const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

const devnetCChain = defineChain({
  id: DEVNET_CHAIN_ID,
  name: 'Avalanche Devnet C-Chain',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: {
    default: { http: [DEVNET_RPC_URL] },
  },
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const email = session.user.email || '';
    if (!email.endsWith('@avalabs.org')) {
      return NextResponse.json(
        { success: false, message: 'Restricted to @avalabs.org accounts' },
        { status: 403 }
      );
    }

    if (!FAUCET_ADDRESS) {
      return NextResponse.json(
        { success: false, message: 'Faucet not configured' },
        { status: 500 }
      );
    }

    const publicClient = createPublicClient({
      chain: devnetCChain,
      transport: http(DEVNET_RPC_URL),
    });

    const balanceWei = await publicClient.getBalance({
      address: FAUCET_ADDRESS as `0x${string}`,
    });

    const balance = formatEther(balanceWei);

    return NextResponse.json({
      success: true,
      balance,
      address: FAUCET_ADDRESS,
    });
  } catch (error) {
    console.error('Devnet faucet balance error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
