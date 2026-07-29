import type { AvalancheWalletClient } from '@avalanche-sdk/client';

export type RemoveSubnetValidatorParams = {
  subnetId: string;
  nodeId: string;
  /** Indices into the subnet owner's address list that authorize this tx. */
  subnetAuth: number[];
};

/**
 * Remove a legacy subnet validator (RemoveSubnetValidatorTx).
 *
 * This targets validators added by AddSubnetValidatorTx. ACP-77 L1 validators
 * are managed through the validator manager contract instead, via
 * SetL1ValidatorWeightTx or DisableL1ValidatorTx.
 *
 * Still valid after the subnet has been converted to an L1: the P-Chain gates
 * ConvertSubnetToL1Tx / AddSubnetValidatorTx / TransferSubnetOwnershipTx on the
 * subnet not having been converted, but RemoveSubnetValidatorTx only checks
 * subnet auth.
 */
export async function removeSubnetValidator(
  client: AvalancheWalletClient,
  params: RemoveSubnetValidatorParams,
): Promise<string> {
  const txnRequest = await client.pChain.prepareRemoveSubnetValidatorTxn({
    subnetId: params.subnetId,
    nodeId: params.nodeId,
    subnetAuth: params.subnetAuth,
  });

  // Send the transaction (this will prompt the user to sign)
  const result = await client.sendXPTransaction(txnRequest);

  return result.txHash;
}
