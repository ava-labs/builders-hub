import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import { getTx } from "@avalanche-sdk/client/methods/pChain";
import { isTestnet } from "./isTestnet";
import { networkIDs, utils } from "@avalabs/avalanchejs";
import { 
  unpackRegisterL1ValidatorPayload,
  extractPayloadFromWarpMessage,
  extractPayloadFromAddressedCall 
} from "../utils/convertWarp";

export type ExtractRegisterL1ValidatorMessageParams = {
  txId: string;
}

export type ExtractRegisterL1ValidatorMessageResponse = {
  message: string;
  subnetID: string;
  nodeID: string;
  blsPublicKey: string;
  expiry: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
}

/**
 * Extracts RegisterL1ValidatorMessage from a P-Chain RegisterL1ValidatorTx
 * @param client - The Avalanche wallet client
 * @param params - Parameters containing the transaction ID
 * @returns The extracted registration message data
 */
export async function extractRegisterL1ValidatorMessage(
  client: AvalancheWalletClient,
  { txId }: ExtractRegisterL1ValidatorMessageParams
): Promise<ExtractRegisterL1ValidatorMessageResponse> {
  const isTestnetMode = await isTestnet(client);
  const networkId = isTestnetMode ? networkIDs.FujiID : networkIDs.MainnetID;

  // Use SDK's getTx method to fetch the transaction
  const txData = await getTx(client.pChainClient, {
    txID: txId,
    encoding: 'json'
  });

  // The SDK returns the transaction data directly
  const data = txData as any;

  if (!data?.tx?.unsignedTx) {
    console.log('txId', txId);
    console.log('data', data);
    throw new Error("Invalid transaction data, are you sure this is a RegisterL1ValidatorTx?");
  }

  const unsignedTx = data.tx.unsignedTx;

  // Extract the WarpMessage from the transaction
  if (!unsignedTx.message) {
    console.log('Transaction structure:', JSON.stringify(unsignedTx, null, 2));
    throw new Error("Transaction does not contain a WarpMessage");
  }

  // Parse the WarpMessage to extract the AddressedCall
  const warpMessageBytes = Buffer.from(utils.hexToBuffer(unsignedTx.message));
  const addressedCallBytes = extractPayloadFromWarpMessage(warpMessageBytes);

  // Extract the actual RegisterL1ValidatorMessage payload from the AddressedCall
  const registerL1ValidatorPayload = extractPayloadFromAddressedCall(addressedCallBytes);
  if (!registerL1ValidatorPayload) {
    throw new Error("Failed to extract RegisterL1ValidatorMessage payload from AddressedCall");
  }

  // Use the utility function to parse the RegisterL1ValidatorMessage
  const parsedData = unpackRegisterL1ValidatorPayload(new Uint8Array(registerL1ValidatorPayload));

  return {
    message: utils.bufferToHex(registerL1ValidatorPayload),
    subnetID: utils.bufferToHex(Buffer.from(parsedData.subnetID)),
    nodeID: utils.bufferToHex(Buffer.from(parsedData.nodeID)),
    blsPublicKey: utils.bufferToHex(Buffer.from(parsedData.blsPublicKey)),
    expiry: parsedData.registrationExpiry,
    weight: parsedData.weight,
    networkId
  };
}


