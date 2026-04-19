import { networkIDs, utils } from '@avalabs/avalanchejs';
import {
  unpackL1ValidatorWeightPayload,
  extractPayloadFromWarpMessage,
  extractPayloadFromAddressedCall,
} from '@/components/toolbox/coreViem/utils/convertWarp';

export interface L1ValidatorWeightData {
  message: string;
  validationID: string;
  nonce: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
}

/**
 * Fetches L1ValidatorWeightMessage data from a P-Chain SetL1ValidatorWeightTx.
 * No wallet dependency — uses standard P-Chain RPC (same pattern as fetchConversionData.ts).
 */
export async function fetchL1ValidatorWeightData(txId: string, isTestnet: boolean): Promise<L1ValidatorWeightData> {
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
    throw new Error('Invalid transaction data — is this a SetL1ValidatorWeightTx?');
  }

  const unsignedTx = tx.unsignedTx;

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

  // Parse the L1ValidatorWeightMessage
  const parsedData = unpackL1ValidatorWeightPayload(new Uint8Array(l1ValidatorWeightPayload));

  return {
    message: utils.bufferToHex(l1ValidatorWeightPayload),
    validationID: utils.bufferToHex(Buffer.from(parsedData.validationID)),
    nonce: parsedData.nonce,
    weight: parsedData.weight,
    networkId,
  };
}
