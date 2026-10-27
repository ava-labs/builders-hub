import { NextRequest, NextResponse } from 'next/server';
import { createAvalancheWalletClient } from '@avalanche-sdk/client';
import { privateKeyToAvalancheAccount } from '@avalanche-sdk/client/accounts';
import { avalancheFuji } from 'viem/chains';
import { getAuthSession } from '@/lib/auth/authSession';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const FAUCET_P_CHAIN_ADDRESS = process.env.FAUCET_P_CHAIN_ADDRESS;
const FIXED_AMOUNT = 0.5;

interface TransferResponse {
  success: boolean;
  txID?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amount?: number;
  message?: string;
}

/**
 * The key as the SDK takes it, 0x and 64 hex digits. avalanchejs also took it without 0x, with 0X, or with a
 * leading zero dropped, so the stored key can be in any of those forms.
 */
const asHexKey = (key: string): `0x${string}` => `0x${key.replace(/^0x/i, '').padStart(64, '0')}`;

async function transferPToP(
  privateKey: string,
  sourceAddress: string,
  destinationAddress: string
): Promise<{ txID: string }> {
  // The Avalanche SDK reads the UTXOs, the fee state and the context from the Fuji API, builds the BaseTx (change
  // back to the source), signs it with the faucet's key and issues it.
  const client = createAvalancheWalletClient({
    chain: avalancheFuji as never,
    transport: { type: 'http' },
    account: privateKeyToAvalancheAccount(asHexKey(privateKey)),
  });
  const txnRequest = await client.pChain.prepareBaseTxn({
    fromAddresses: [sourceAddress],
    outputs: [{ addresses: [destinationAddress], amount: BigInt(Math.floor(FIXED_AMOUNT * 1e9)) }],
  });
  const { txHash } = await client.sendXPTransaction(txnRequest);
  return { txID: txHash };
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

    if (!SERVER_PRIVATE_KEY || !FAUCET_P_CHAIN_ADDRESS) {
      return NextResponse.json(
        { success: false, message: 'Server not properly configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const destinationAddress = searchParams.get('address');

    if (!destinationAddress) {
      return NextResponse.json(
        { success: false, message: 'Destination address is required' },
        { status: 400 }
      );
    }

    if (!destinationAddress.startsWith('P-')) {
      return NextResponse.json(
        { success: false, message: 'Invalid P-Chain address format' },
        { status: 400 }
      );
    }

    if (destinationAddress.toLowerCase() === FAUCET_P_CHAIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'Cannot send tokens to the faucet address' },
        { status: 400 }
      );
    }

    const reservationResult = await checkAndReserveFaucetClaim(
      session.user.id,
      'pchain',
      destinationAddress,
      FIXED_AMOUNT.toString()
    );

    if (!reservationResult.allowed) {
      return NextResponse.json(
        { success: false, message: reservationResult.reason },
        { status: 429 }
      );
    }

    claimId = reservationResult.claimId!;

    const tx = await transferPToP(
      SERVER_PRIVATE_KEY,
      FAUCET_P_CHAIN_ADDRESS,
      destinationAddress
    );

    await completeFaucetClaim(claimId, tx.txID);

    return NextResponse.json({
      success: true,
      txID: tx.txID,
      sourceAddress: FAUCET_P_CHAIN_ADDRESS,
      destinationAddress,
      amount: FIXED_AMOUNT,
      message: `Successfully transferred ${FIXED_AMOUNT} AVAX`,
    });

  } catch (error) {
    console.error('P-Chain faucet error:', error);

    if (claimId) {
      await cancelFaucetClaim(claimId);
    }

    // A fixed message: the SDK's RPC errors carry the request body (the signed tx) and the node URL.
    return NextResponse.json(
      { success: false, message: 'Failed to complete transfer' },
      { status: 500 }
    );
  }
}
