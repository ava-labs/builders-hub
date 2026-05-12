import { networkIDs } from '@avalabs/avalanchejs';
import {
  parseWarpUnsignedMessage,
  parseAddressedCallPayload,
  parseRegisterL1ValidatorMessage,
} from '@avalanche-sdk/interchain/warp';
import { bytesToHex } from 'viem';

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
