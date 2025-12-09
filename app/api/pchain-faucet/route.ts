import { NextRequest, NextResponse } from 'next/server';
import { TransferableOutput, addTxSignatures, pvm, utils, Context } from "@avalabs/avalanchejs";
import { getAuthSession } from '@/lib/auth/authSession';
import { checkFaucetRateLimit, recordFaucetClaim } from '@/lib/faucetRateLimit';

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const FAUCET_P_CHAIN_ADDRESS = process.env.FAUCET_P_CHAIN_ADDRESS;
const NETWORK_API = 'https://api.avax-test.network';
const FIXED_AMOUNT = 0.5;

if (!SERVER_PRIVATE_KEY || !FAUCET_P_CHAIN_ADDRESS) {
  console.error('necessary environment variables are not set');
}

interface TransferResponse {
  success: boolean;
  txID?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amount?: string;
  message?: string;
}

async function transferPToP(
  sourcePrivateKey: string,
  sourceAddress: string,
  destinationAddress: string
): Promise<{ txID: string }> {
  const pvmApi = new pvm.PVMApi(NETWORK_API);
  const context = await Context.getContextFromURI(NETWORK_API);
  const { utxos } = await pvmApi.getUTXOs({ addresses: [sourceAddress] });
  if (utxos.length === 0) {
    throw new Error('No UTXOs found for source address');
  }

  const feeState = await pvmApi.getFeeState();
  const amountNAvax = BigInt(FIXED_AMOUNT * 1e9);
  const tx = pvm.newBaseTx(
    {
      feeState,
      fromAddressesBytes: [utils.bech32ToBytes(sourceAddress)],
      outputs: [
        TransferableOutput.fromNative(
          context.avaxAssetID,
          amountNAvax,
          [utils.bech32ToBytes(destinationAddress)],
        ),
      ],
      utxos,
    },
    context,
  );

  await addTxSignatures({
    unsignedTx: tx,
    privateKeys: [utils.hexToBuffer(sourcePrivateKey)],
  });

  return pvmApi.issueSignedTx(tx.getSignedTx());
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication check
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Server configuration check
    if (!SERVER_PRIVATE_KEY || !FAUCET_P_CHAIN_ADDRESS) {
      return NextResponse.json(
        { success: false, message: 'Server not properly configured' },
        { status: 500 }
      );
    }

    // Validate request parameters
    const searchParams = request.nextUrl.searchParams;
    const destinationAddress = searchParams.get('address');

    if (!destinationAddress) {
      return NextResponse.json(
        { success: false, message: 'Destination address is required' },
        { status: 400 }
      );
    }

    if (destinationAddress === FAUCET_P_CHAIN_ADDRESS) {
      return NextResponse.json(
        { success: false, message: 'Cannot send tokens to the faucet address' },
        { status: 400 }
      );
    }

    // Check rate limits (DB-backed)
    const rateLimitResult = await checkFaucetRateLimit(
      session.user.id,
      'pchain',
      destinationAddress
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, message: rateLimitResult.reason },
        { status: 429 }
      );
    }

    // Execute transfer
    const tx = await transferPToP(
      SERVER_PRIVATE_KEY,
      FAUCET_P_CHAIN_ADDRESS,
      destinationAddress
    );

    // Record successful claim
    await recordFaucetClaim(
      session.user.id,
      'pchain',
      destinationAddress,
      FIXED_AMOUNT.toString(),
      tx.txID
    );

    const response: TransferResponse = {
      success: true,
      txID: tx.txID,
      sourceAddress: FAUCET_P_CHAIN_ADDRESS,
      destinationAddress,
      amount: FIXED_AMOUNT.toString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('P-Chain faucet error:', error);

    const response: TransferResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete transfer'
    };

    return NextResponse.json(response, { status: 500 });
  }
}
