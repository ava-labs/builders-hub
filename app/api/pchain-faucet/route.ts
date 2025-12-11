import { NextRequest, NextResponse } from 'next/server';
import { TransferableOutput, addTxSignatures, pvm, utils, Context } from "@avalabs/avalanchejs";
import { getAuthSession } from '@/lib/auth/authSession';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const FAUCET_P_CHAIN_ADDRESS = process.env.FAUCET_P_CHAIN_ADDRESS;
const FIXED_AMOUNT = 2;

interface TransferResponse {
  success: boolean;
  txID?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amount?: number;
  message?: string;
}

async function transferPToP(
  privateKey: string,
  sourceAddress: string,
  destinationAddress: string
): Promise<{ txID: string }> {
  const context = await Context.getContextFromURI("https://api.avax-test.network");
  const pvmApi = new pvm.PVMApi("https://api.avax-test.network");
  const feeState = await pvmApi.getFeeState();
  const { utxos } = await pvmApi.getUTXOs({ addresses: [sourceAddress] });
  const amountNAvax = BigInt(FIXED_AMOUNT) * BigInt(1e9);

  const outputs = [
    TransferableOutput.fromNative(context.avaxAssetID, amountNAvax, [
      utils.bech32ToBytes(destinationAddress),
    ]),
  ];

  const tx = pvm.newBaseTx(
    {
      feeState,
      fromAddressesBytes: [utils.bech32ToBytes(sourceAddress)],
      outputs,
      utxos,
    },
    context
  );

  await addTxSignatures({
    unsignedTx: tx,
    privateKeys: [utils.hexToBuffer(privateKey)],
  });

  return pvmApi.issueSignedTx(tx.getSignedTx());
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
      message: `Successfully transferred ${FIXED_AMOUNT} AVAX`
    });

  } catch (error) {
    console.error('P-Chain faucet error:', error);

    if (claimId) {
      await cancelFaucetClaim(claimId);
    }

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to complete transfer' },
      { status: 500 }
    );
  }
}
