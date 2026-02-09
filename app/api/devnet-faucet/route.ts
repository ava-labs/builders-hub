import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getAuthSession } from '@/lib/auth/authSession';

const DEVNET_RPC_URL = 'https://api.avax-dev.network/ext/bc/C/rpc';
const DEVNET_CHAIN_ID = 43117;
const DRIP_AMOUNT = '2';

const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

const devnetCChain = defineChain({
  id: DEVNET_CHAIN_ID,
  name: 'Avalanche Devnet C-Chain',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: {
    default: { http: [DEVNET_RPC_URL] },
  },
});

const account = SERVER_PRIVATE_KEY ? privateKeyToAccount(SERVER_PRIVATE_KEY as `0x${string}`) : null;

// Simple in-memory rate limit: 1 claim per address per 10 minutes
const recentClaims = new Map<string, number>();
const RATE_LIMIT_MS = 10 * 60 * 1000;

function cleanupClaims() {
  const now = Date.now();
  for (const [key, timestamp] of recentClaims) {
    if (now - timestamp > RATE_LIMIT_MS) {
      recentClaims.delete(key);
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check @avalabs.org email
    const email = session.user.email || '';
    if (!email.endsWith('@avalabs.org')) {
      return NextResponse.json(
        { success: false, message: 'Devnet faucet is restricted to @avalabs.org accounts' },
        { status: 403 }
      );
    }

    if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS || !account) {
      return NextResponse.json(
        { success: false, message: 'Faucet not configured' },
        { status: 500 }
      );
    }

    const destinationAddress = request.nextUrl.searchParams.get('address');
    if (!destinationAddress || !isAddress(destinationAddress)) {
      return NextResponse.json(
        { success: false, message: 'Valid EVM address is required' },
        { status: 400 }
      );
    }

    if (destinationAddress.toLowerCase() === FAUCET_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'Cannot send tokens to the faucet address' },
        { status: 400 }
      );
    }

    // Rate limit check
    cleanupClaims();
    const claimKey = `${session.user.id}:${destinationAddress.toLowerCase()}`;
    const lastClaim = recentClaims.get(claimKey);
    if (lastClaim && Date.now() - lastClaim < RATE_LIMIT_MS) {
      const remaining = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastClaim)) / 60000);
      return NextResponse.json(
        { success: false, message: `Rate limited. Try again in ${remaining} minutes.` },
        { status: 429 }
      );
    }

    const walletClient = createWalletClient({
      account,
      chain: devnetCChain,
      transport: http(DEVNET_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: devnetCChain,
      transport: http(DEVNET_RPC_URL),
    });

    // Check faucet balance
    const balance = await publicClient.getBalance({ address: FAUCET_ADDRESS as `0x${string}` });
    const amountToSend = parseEther(DRIP_AMOUNT);

    if (balance < amountToSend) {
      return NextResponse.json(
        { success: false, message: 'Insufficient faucet balance on devnet' },
        { status: 500 }
      );
    }

    const txHash = await walletClient.sendTransaction({
      to: destinationAddress as `0x${string}`,
      value: amountToSend,
    });

    // Record the claim
    recentClaims.set(claimKey, Date.now());

    return NextResponse.json({
      success: true,
      txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: DRIP_AMOUNT,
      chainId: DEVNET_CHAIN_ID,
    });
  } catch (error) {
    console.error('Devnet faucet error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to complete transfer' },
      { status: 500 }
    );
  }
}
