import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { getTx } from '@avalanche-sdk/client/methods/pChain';
import { isTestnet } from './isTestnet';
import { networkIDs } from '@avalabs/avalanchejs';
import {
  parseWarpUnsignedMessage,
  parseAddressedCallPayload,
  parseL1ValidatorWeightMessage,
} from '@avalanche-sdk/interchain/warp';
import { CB58ToHex } from '@avalanche-sdk/client/utils';

export type ExtractL1ValidatorWeightMessageParams = {
  txId: string;
};

export type ExtractL1ValidatorWeightMessageResponse = {
  message: string;
  validationID: string;
  nonce: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
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
  const networkId = isTestnetMode ? networkIDs.FujiID : networkIDs.MainnetID;

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

  // Unwrap WarpUnsignedMessage → AddressedCall payload (hex)
  const warpUnsigned = parseWarpUnsignedMessage(unsignedTx.message);
  const addressedCallHex = '0x' + warpUnsigned.payload.toString('hex');

  // Unwrap AddressedCall → inner L1ValidatorWeightMessage payload (hex)
  const addressedCall = parseAddressedCallPayload(addressedCallHex);
  const innerPayloadHex = '0x' + addressedCall.payload.toString('hex');

  // Parse the inner L1ValidatorWeightMessage
  const parsed = parseL1ValidatorWeightMessage(innerPayloadHex);

  return {
    message: innerPayloadHex,
    validationID: CB58ToHex(parsed.validationId.value()),
    nonce: parsed.nonce.value(),
    weight: parsed.weight.value(),
    networkId,
  };
}
