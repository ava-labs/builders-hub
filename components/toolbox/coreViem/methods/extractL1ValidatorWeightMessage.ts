import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { getTx } from '@avalanche-sdk/client/methods/pChain';
import { isTestnet } from './isTestnet';
import { MAINNET_NETWORK_ID, TESTNET_NETWORK_ID } from '@avalanche-sdk/client/methods';
import { utils } from '@avalanche-sdk/client/utils';
import {
  unpackL1ValidatorWeightPayload,
  extractPayloadFromWarpMessage,
  extractPayloadFromAddressedCall,
} from '../utils/convertWarp';

export type ExtractL1ValidatorWeightMessageParams = {
  txId: string;
};

export type ExtractL1ValidatorWeightMessageResponse = {
  message: string;
  validationID: string;
  nonce: bigint;
  weight: bigint;
  networkId: typeof TESTNET_NETWORK_ID | typeof MAINNET_NETWORK_ID;
};

/**
 * Extracts L1ValidatorWeightMessage from a P-Chain SetL1ValidatorWeightTx
 * @param client - The Avalanche wallet client
 * @param params - Parameters containing the transaction ID
 * @returns The extracted weight message data
 */
export async function extractL1ValidatorWeightMessage(
  client: AvalancheWalletClient,
  { txId }: ExtractL1ValidatorWeightMessageParams,
): Promise<ExtractL1ValidatorWeightMessageResponse> {
  const isTestnetMode = await isTestnet(client);
  const networkId = isTestnetMode ? TESTNET_NETWORK_ID : MAINNET_NETWORK_ID;

  // Use SDK's getTx method to fetch the transaction
  const txData = await getTx(client.pChainClient, {
    txID: txId,
    encoding: 'json',
  });

  // The SDK returns the transaction data directly
  const data = txData as any;

  if (!data?.tx?.unsignedTx) {
    throw new Error('Invalid transaction data, are you sure this is a SetL1ValidatorWeightTx?');
  }

  const unsignedTx = data.tx.unsignedTx;

  // Extract the WarpMessage from the transaction
  if (!unsignedTx.message) {
    throw new Error('Transaction does not contain a WarpMessage');
  }

  // Parse the WarpMessage to extract the AddressedCall
  const warpMessageBytes = Buffer.from(utils.hexToBuffer(unsignedTx.message));
  const addressedCallBytes = extractPayloadFromWarpMessage(warpMessageBytes);

  // Extract the actual L1ValidatorWeightMessage payload from the AddressedCall
  const l1ValidatorWeightPayload = extractPayloadFromAddressedCall(addressedCallBytes);
  if (!l1ValidatorWeightPayload) {
    throw new Error('Failed to extract L1ValidatorWeightMessage payload from AddressedCall');
  }

  // Use the utility function to parse the L1ValidatorWeightMessage
  const parsedData = unpackL1ValidatorWeightPayload(new Uint8Array(l1ValidatorWeightPayload));

  return {
    message: utils.bufferToHex(l1ValidatorWeightPayload),
    validationID: utils.bufferToHex(Buffer.from(parsedData.validationID)),
    nonce: parsedData.nonce,
    weight: parsedData.weight,
    networkId,
  };
}
