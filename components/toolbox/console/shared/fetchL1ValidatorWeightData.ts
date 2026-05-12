import { networkIDs } from '@avalabs/avalanchejs';
import {
  parseWarpUnsignedMessage,
  parseAddressedCallPayload,
  parseL1ValidatorWeightMessage,
} from '@avalanche-sdk/interchain/warp';
import { CB58ToHex } from '@avalanche-sdk/client/utils';

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

  // Unwrap WarpUnsignedMessage → AddressedCall payload → inner L1ValidatorWeightMessage
  const warpUnsigned = parseWarpUnsignedMessage(unsignedTx.message);
  const addressedCallHex = '0x' + warpUnsigned.payload.toString('hex');
  const addressedCall = parseAddressedCallPayload(addressedCallHex);
  const innerPayloadHex = '0x' + addressedCall.payload.toString('hex');

  const parsed = parseL1ValidatorWeightMessage(innerPayloadHex);

  return {
    message: innerPayloadHex,
    validationID: CB58ToHex(parsed.validationId.value()),
    nonce: parsed.nonce.value(),
    weight: parsed.weight.value(),
    networkId,
  };
}
