import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { utils } from '@avalabs/avalanchejs';

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

  // Core rebuilds the unsigned tx before signing, and it needs the funding
  // UTXOs to do that. When the request omits them it falls back to Glacier
  // (`getUtxosByTxFromGlacier`), so a lagging or down P-Chain indexer breaks
  // signing even though the tx and the node are both fine. The prepare step
  // already selected the exact UTXOs, so hand them over and keep Core off the
  // indexer entirely. Core parses this field with `Utxo.fromBytes`, so it wants
  // serialized UTXO bytes as hex, not UTXO IDs.
  const codec = utils.getManagerForVM('PVM').getDefaultCodec();
  const utxoIds = txnRequest.tx.utxos.map((utxo) => utils.bufferToHex(utxo.toBytes(codec)));

  // Send the transaction (this will prompt the user to sign)
  const result = await client.sendXPTransaction({ ...txnRequest, utxoIds });

  return result.txHash;
}
