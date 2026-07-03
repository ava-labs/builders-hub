import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getAuthSession } from '@/lib/auth/authSession';
import { findValidCoupon } from '@/lib/faucet/coupon';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';

const DEVNET_RPC_URL = 'https://api.avax-dev.network/ext/bc/C/rpc';
const DEVNET_CHAIN_ID = 43117;
const DEFAULT_DRIP_AMOUNT = 2;
const MIN_DRIP_AMOUNT = 1;
const MAX_DRIP_AMOUNT = 2005;

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

function parseDripAmount(amountParam: string | null): number | null {
  const amount = amountParam?.trim() || DEFAULT_DRIP_AMOUNT.toString();
  if (!/^[1-9]\d*$/.test(amount)) {
    return null;
  }

  const parsedAmount = Number(amount);
  if (!Number.isSafeInteger(parsedAmount) || parsedAmount < MIN_DRIP_AMOUNT || parsedAmount > MAX_DRIP_AMOUNT) {
    return null;
  }

  return parsedAmount;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let claimId: string | null = null;

  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // @avalabs.org accounts have unrestricted internal access. Everyone else must
    // present a valid coupon code, which lifts the gate but applies rate limits.
    const email = session.user.email || '';
    const isAvaLabs = email.endsWith('@avalabs.org');

    let couponId: string | undefined;
    if (!isAvaLabs) {
      const couponCheck = await findValidCoupon(request.nextUrl.searchParams.get('coupon') || '');
      if (!couponCheck.valid) {
        return NextResponse.json(
          { success: false, message: couponCheck.reason },
          { status: 403 }
        );
      }
      couponId = couponCheck.couponId;
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

    const dripAmount = parseDripAmount(request.nextUrl.searchParams.get('amount'));
    if (dripAmount === null) {
      return NextResponse.json(
        { success: false, message: `Amount must be a whole number from ${MIN_DRIP_AMOUNT} to ${MAX_DRIP_AMOUNT} AVAX` },
        { status: 400 }
      );
    }

    // Coupon (external) claims are rate limited and recorded against the coupon.
    // Internal @avalabs.org claims stay unlimited and are not recorded.
    if (!isAvaLabs) {
      const reservation = await checkAndReserveFaucetClaim(
        session.user.id,
        'devnet',
        destinationAddress,
        dripAmount.toString(),
        DEVNET_CHAIN_ID.toString(),
        couponId
      );
      if (!reservation.allowed) {
        return NextResponse.json(
          { success: false, message: reservation.reason },
          { status: 429 }
        );
      }
      claimId = reservation.claimId ?? null;
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
    const amountToSend = parseEther(dripAmount.toString());

    if (balance < amountToSend) {
      // Throw (not early-return) so a reserved coupon claim is cancelled in catch.
      throw new Error('Insufficient faucet balance on devnet');
    }

    // Get the current nonce to avoid stale nonce issues
    const nonce = await publicClient.getTransactionCount({
      address: FAUCET_ADDRESS as `0x${string}`,
    });

    // Simple native transfer is always 21000 gas.
    // We hardcode it to skip eth_estimateGas which fails on the devnet RPC.
    const txHash = await walletClient.sendTransaction({
      to: destinationAddress as `0x${string}`,
      value: amountToSend,
      gas: 21000n,
      nonce,
    });

    if (claimId) {
      // The transfer already succeeded. If stamping the tx hash fails, keep the
      // reserved claim (it still counts against the rate limit) rather than letting
      // the catch below delete it and hand the user a free extra claim.
      try {
        await completeFaucetClaim(claimId, txHash);
      } catch (stampError) {
        console.error('Failed to record devnet faucet claim tx hash:', stampError);
      }
    }

    return NextResponse.json({
      success: true,
      txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: dripAmount.toString(),
      chainId: DEVNET_CHAIN_ID,
    });
  } catch (error) {
    console.error('Devnet faucet error:', error);
    if (claimId) {
      await cancelFaucetClaim(claimId);
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to complete transfer' },
      { status: 500 }
    );
  }
}
