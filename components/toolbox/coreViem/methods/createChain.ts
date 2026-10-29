import type { AvalancheWalletClient } from '@avalanche-sdk/client';

export type CreateChainParams = {
  chainName: string;
  subnetAuth: number[];
  subnetId: string;
  vmId: string;
  fxIds: string[];
  genesisData: string;
};

export async function createChain(client: AvalancheWalletClient, params: CreateChainParams): Promise<string> {
  // Parse genesis data from string to object
  const genesisDataObject = JSON.parse(params.genesisData);

  // Prepare the transaction using Avalanche SDK
  const txnRequest = await client.pChain.prepareCreateChainTxn({
    chainName: params.chainName,
    subnetAuth: params.subnetAuth,
    subnetId: params.subnetId,
    vmId: params.vmId,
    fxIds: params.fxIds,
    genesisData: genesisDataObject,
  });

  // The chain ID is the hash of this transaction, which spends fresh UTXOs, so it cannot match an existing chain:
  // the P-Chain rejects a resent transaction.
  const result = await client.sendXPTransaction(txnRequest);

  return result.txHash;
}
