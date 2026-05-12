import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { getTx } from '@avalanche-sdk/client/methods/pChain';
import { isTestnet } from './isTestnet';
import { networkIDs } from '@avalabs/avalanchejs';
import {
  parseWarpUnsignedMessage,
  parseAddressedCallPayload,
  parseRegisterL1ValidatorMessage,
} from '@avalanche-sdk/interchain/warp';
import { bytesToHex } from 'viem';

export type ExtractRegisterL1ValidatorMessageParams = {
  txId: string;
};

export type ExtractRegisterL1ValidatorMessageResponse = {
  message: string;
  subnetID: string;
  nodeID: string;
  blsPublicKey: string;
  expiry: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
};

/**
 * Extracts RegisterL1ValidatorMessage from a P-Chain RegisterL1ValidatorTx
 * @param client - The Avalanche wallet client
 * @param params - Parameters containing the transaction ID
 * @returns The extracted registration message data
 */
export async function extractRegisterL1ValidatorMessage(
  client: AvalancheWalletClient,
  { txId }: ExtractRegisterL1ValidatorMessageParams,
): Promise<ExtractRegisterL1ValidatorMessageResponse> {
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
    throw new Error('Invalid transaction data, are you sure this is a RegisterL1ValidatorTx?');
  }

  const unsignedTx = data.tx.unsignedTx;

  // Extract the WarpMessage from the transaction
  if (!unsignedTx.message) {
    throw new Error('Transaction does not contain a WarpMessage');
  }

  // Unwrap WarpUnsignedMessage → AddressedCall payload → inner RegisterL1ValidatorMessage
  const warpUnsigned = parseWarpUnsignedMessage(unsignedTx.message);
  const addressedCallHex = '0x' + warpUnsigned.payload.toString('hex');
  const addressedCall = parseAddressedCallPayload(addressedCallHex);
  const innerPayloadHex = '0x' + addressedCall.payload.toString('hex');

  const parsed = parseRegisterL1ValidatorMessage(innerPayloadHex);

  return {
    message: innerPayloadHex,
    subnetID: bytesToHex(parsed.subnetId.toBytes()),
    nodeID: bytesToHex(parsed.nodeId.toBytes()),
    blsPublicKey: bytesToHex(parsed.blsPublicKey.toBytes()),
    expiry: parsed.expiry.value(),
    weight: parsed.weight.value(),
    networkId,
  };
}
