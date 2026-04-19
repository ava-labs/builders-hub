import { networkIDs, utils } from '@avalabs/avalanchejs';
import {
  unpackRegisterL1ValidatorPayload,
  extractPayloadFromWarpMessage,
  extractPayloadFromAddressedCall,
} from '@/components/toolbox/coreViem/utils/convertWarp';

export interface RegisterL1ValidatorData {
  message: string;
  subnetID: string;
  nodeID: string;
  blsPublicKey: string;
  expiry: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
}

/**
 * Fetches RegisterL1ValidatorMessage data from a P-Chain RegisterL1ValidatorTx.
 * No wallet dependency — uses standard P-Chain RPC (same pattern as fetchConversionData.ts).
 */
export async function fetchRegisterL1ValidatorData(txId: string, isTestnet: boolean): Promise<RegisterL1ValidatorData> {
  const networkId = isTestnet ? networkIDs.FujiID : networkIDs.MainnetID;
  const rpcUrl = isTestnet ? 'https://api.avax-test.network/ext/bc/P' : 'https://api.avax.network/ext/bc/P';

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'platform.getTx',
      params: { txID: txId, encoding: 'json' },
      id: 1,
    }),
  });

  const data = await response.json();
  const tx = data?.result?.tx;

  if (!tx?.unsignedTx) {
    throw new Error('Invalid transaction data — is this a RegisterL1ValidatorTx?');
  }

  const unsignedTx = tx.unsignedTx;

  if (!unsignedTx.message) {
    throw new Error('Transaction does not contain a WarpMessage');
  }

  // Parse the WarpMessage to extract the AddressedCall
  const warpMessageBytes = Buffer.from(utils.hexToBuffer(unsignedTx.message));
  const addressedCallBytes = extractPayloadFromWarpMessage(warpMessageBytes);

  // Extract the actual RegisterL1ValidatorMessage payload from the AddressedCall
  const registerL1ValidatorPayload = extractPayloadFromAddressedCall(addressedCallBytes);
  if (!registerL1ValidatorPayload) {
    throw new Error('Failed to extract RegisterL1ValidatorMessage payload from AddressedCall');
  }

  // Parse the RegisterL1ValidatorMessage
  const parsedData = unpackRegisterL1ValidatorPayload(new Uint8Array(registerL1ValidatorPayload));

  return {
    message: utils.bufferToHex(registerL1ValidatorPayload),
    subnetID: utils.bufferToHex(Buffer.from(parsedData.subnetID)),
    nodeID: utils.bufferToHex(Buffer.from(parsedData.nodeID)),
    blsPublicKey: utils.bufferToHex(Buffer.from(parsedData.blsPublicKey)),
    expiry: parsedData.registrationExpiry,
    weight: parsedData.weight,
    networkId,
  };
}
