import type { NextRequest } from 'next/server';
import { TransferableOutput, addTxSignatures, pvm, utils, Context } from '@avalabs/avalanchejs';
import { z } from 'zod';
import { withApi, successResponse, BadRequestError, InternalError, RateLimitError, validateQuery } from '@/lib/api';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import type { AwardedConsoleBadge } from '@/server/services/consoleBadge/types';

const FIXED_AMOUNT = 0.5;

const querySchema = z.object({
  address: z
    .string()
    .min(1, 'Destination address is required')
    .startsWith('P-', { message: 'Invalid P-Chain address format' }),
});

async function transferPToP(
  privateKey: string,
  sourceAddress: string,
  destinationAddress: string,
): Promise<{ txID: string }> {
  const context = await Context.getContextFromURI('https://api.avax-test.network');
  const pvmApi = new pvm.PVMApi('https://api.avax-test.network');
  const feeState = await pvmApi.getFeeState();
  const { utxos } = await pvmApi.getUTXOs({ addresses: [sourceAddress] });
  const amountNAvax = BigInt(Math.floor(FIXED_AMOUNT * 1e9));

  const outputs = [
    TransferableOutput.fromNative(context.avaxAssetID, amountNAvax, [utils.bech32ToBytes(destinationAddress)]),
  ];

  const tx = pvm.newBaseTx(
    {
      feeState,
      fromAddressesBytes: [utils.bech32ToBytes(sourceAddress)],
      outputs,
      utxos,
    },
    context,
  );

  await addTxSignatures({
    unsignedTx: tx,
    privateKeys: [utils.hexToBuffer(privateKey)],
  });

  return pvmApi.issueSignedTx(tx.getSignedTx());
}

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
    const FAUCET_P_CHAIN_ADDRESS = process.env.FAUCET_P_CHAIN_ADDRESS;

    if (!SERVER_PRIVATE_KEY || !FAUCET_P_CHAIN_ADDRESS) {
      throw new InternalError('Server not properly configured');
    }

    const { address: destinationAddress } = validateQuery(req, querySchema);

    if (destinationAddress.toLowerCase() === FAUCET_P_CHAIN_ADDRESS.toLowerCase()) {
      throw new BadRequestError('Cannot send tokens to the faucet address');
    }

    const reservationResult = await checkAndReserveFaucetClaim(
      session.user.id,
      'pchain',
      destinationAddress,
      FIXED_AMOUNT.toString(),
    );

    if (!reservationResult.allowed) {
      throw new RateLimitError(reservationResult.reason);
    }

    const claimId = reservationResult.claimId!;

    let txID: string;
    try {
      const tx = await transferPToP(SERVER_PRIVATE_KEY, FAUCET_P_CHAIN_ADDRESS, destinationAddress);
      txID = tx.txID;
    } catch {
      await cancelFaucetClaim(claimId);
      throw new InternalError('Faucet transaction failed');
    }

    await completeFaucetClaim(claimId, txID);

    let awardedBadges: AwardedConsoleBadge[] = [];
    try {
      awardedBadges = await checkAndAwardConsoleBadges(session.user.id, 'faucet_claim');
    } catch {
      // Badge check is non-critical; swallow failures
    }

    return successResponse({
      txID,
      sourceAddress: FAUCET_P_CHAIN_ADDRESS,
      destinationAddress,
      amount: FIXED_AMOUNT,
      message: `Successfully transferred ${FIXED_AMOUNT} AVAX`,
      awardedBadges,
    });
  },
  { auth: true },
);
