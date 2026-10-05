import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { toNanoAvax } from '../utils/units';

export type IncreaseL1ValidatorBalanceParams = {
  validationId: string;
  balanceInAvax: number;
};

export async function increaseL1ValidatorBalance(
  client: AvalancheWalletClient,
  params: IncreaseL1ValidatorBalanceParams,
): Promise<string> {
  const txnRequest = await client.pChain.prepareIncreaseL1ValidatorBalanceTxn({
    validationId: params.validationId,
    balanceInNanoAvax: toNanoAvax(params.balanceInAvax),
  });

  // Send the transaction
  const result = await client.sendXPTransaction(txnRequest);

  return result.txHash;
}
