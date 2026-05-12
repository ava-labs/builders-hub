import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { getTx } from '@avalanche-sdk/client/methods/pChain';
import { isTestnet } from './isTestnet';
import { networkIDs } from '@avalabs/avalanchejs';
import { newConversionData, newSubnetToL1ConversionMessage, newWarpMessage } from '@avalanche-sdk/interchain/warp';
import { hexToCB58 } from '@avalanche-sdk/client/utils';

interface AddressObject {
  threshold: number;
  addresses: string[];
}

interface ValidatorSigner {
  publicKey: string;
  proofOfPossession: string;
}

interface Validator {
  nodeID: string;
  weight: number;
  balance: number;
  signer: ValidatorSigner;
  remainingBalanceOwner: AddressObject;
  deactivationOwner: AddressObject;
}

export type ExtractWarpMessageFromTxParams = {
  txId: string;
};

export type ExtractWarpMessageFromTxResponse = {
  message: string;
  justification: string;
  subnetId: string;
  signingSubnetId: string;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
  validators: Validator[];
  chainId: string;
  managerAddress: string;
};

// FIXME: This should be included in avacloud-sdk but I'm afraid to version bump right now
// if you have better idea to get the subnetId from a blockchainId, please go ahead and change it
/**
 * Fetches blockchain information from Glacier API
 * @param network "fuji" or "mainnet"
 * @param blockchainId The blockchain ID to query
 * @returns The subnet ID associated with the blockchain
 */
async function getSubnetIdFromChainId(network: 'fuji' | 'mainnet', blockchainId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://glacier-api.avax.network/v1/networks/${network}/blockchains/${blockchainId}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Data API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.subnetId) {
      throw new Error('No subnetId found in response');
    }

    return data.subnetId;
  } catch (error) {
    console.error('Error fetching subnet info from Glacier:', error);
    throw error;
  }
}

//TODO: rename
export async function extractWarpMessageFromPChainTx(
  client: AvalancheWalletClient,
  { txId }: ExtractWarpMessageFromTxParams,
): Promise<ExtractWarpMessageFromTxResponse> {
  const isTestnetMode = await isTestnet(client);
  const networkId = isTestnetMode ? networkIDs.FujiID : networkIDs.MainnetID;

  // Use SDK's getTx method to fetch the transaction
  const txData = await getTx(client.pChainClient, {
    txID: txId,
    encoding: 'json',
  });

  // The SDK returns the transaction data
  const data = txData as any; // Type as any since the SDK types may not match the exact structure we need

  if (
    !data?.tx?.unsignedTx?.subnetID ||
    !data?.tx?.unsignedTx?.chainID ||
    !data?.tx?.unsignedTx?.address ||
    !data?.tx?.unsignedTx?.validators
  ) {
    throw new Error('Invalid transaction data, are you sure this is a conversion transaction?');
  }

  // newConversionData sorts validators by nodeId internally for canonical conversionID hashing.
  const validators = data.tx.unsignedTx.validators.map((v: any) => ({
    nodeId: v.nodeID.startsWith('NodeID-') ? v.nodeID.split('-')[1] : v.nodeID,
    blsPublicKey: v.signer.publicKey,
    weight: BigInt(v.weight),
  }));

  // Build ConversionData (preimage for the conversionID) and derive conversionID
  const conversionData = newConversionData(
    data.tx.unsignedTx.subnetID,
    data.tx.unsignedTx.chainID,
    data.tx.unsignedTx.address,
    validators,
  );
  const conversionIdHex = conversionData.getConversionId();
  const conversionIdCB58 = hexToCB58(conversionIdHex as `0x${string}`);

  // Build the SubnetToL1ConversionMessage and wrap it in a WarpUnsignedMessage
  const innerMsg = newSubnetToL1ConversionMessage(conversionIdCB58);
  const unsigned = newWarpMessage(networkId, data.tx.unsignedTx.blockchainID, '', innerMsg.toHex());

  const network = networkId === networkIDs.FujiID ? 'fuji' : 'mainnet';
  const signingSubnetId = await getSubnetIdFromChainId(network, data.tx.unsignedTx.chainID);

  return {
    message: unsigned.toHex(),
    justification: conversionData.toHex(),
    subnetId: data.tx.unsignedTx.subnetID,
    signingSubnetId: signingSubnetId,
    networkId,
    validators: data.tx.unsignedTx.validators,
    chainId: data.tx.unsignedTx.chainID,
    managerAddress: data.tx.unsignedTx.address,
  };
}
