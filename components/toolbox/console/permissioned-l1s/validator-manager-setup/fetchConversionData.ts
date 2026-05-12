import { networkIDs } from '@avalabs/avalanchejs';
import { newConversionData, newSubnetToL1ConversionMessage, newWarpMessage } from '@avalanche-sdk/interchain/warp';
import { hexToCB58 } from '@avalanche-sdk/client/utils';

interface Validator {
  nodeID: string;
  weight: number;
  balance: number;
  signer: { publicKey: string; proofOfPossession: string };
  remainingBalanceOwner: { threshold: number; addresses: string[] };
  deactivationOwner: { threshold: number; addresses: string[] };
}

export interface ConversionData {
  message: string;
  justification: string;
  subnetId: string;
  signingSubnetId: string;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
  validators: Validator[];
  chainId: string;
  managerAddress: string;
}

/**
 * Fetches ConvertSubnetToL1Tx data from P-Chain RPC and builds the warp message.
 * No wallet dependency — uses standard P-Chain RPC + Glacier API.
 */
export async function fetchConversionData(txId: string, isTestnet: boolean): Promise<ConversionData> {
  const networkId = isTestnet ? networkIDs.FujiID : networkIDs.MainnetID;
  const network = isTestnet ? 'fuji' : 'mainnet';
  const rpcUrl = isTestnet ? 'https://api.avax-test.network/ext/bc/P' : 'https://api.avax.network/ext/bc/P';

  // Fetch the P-Chain transaction
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

  if (
    !tx?.unsignedTx?.subnetID ||
    !tx?.unsignedTx?.chainID ||
    !tx?.unsignedTx?.address ||
    !tx?.unsignedTx?.validators
  ) {
    throw new Error('Invalid transaction data — is this a ConvertSubnetToL1Tx?');
  }

  const { subnetID, chainID, address, validators: rawValidators, blockchainID } = tx.unsignedTx;

  // newConversionData sorts validators by nodeId internally for canonical conversionID hashing.
  const sdkValidators = rawValidators.map((v: any) => ({
    nodeId: v.nodeID.startsWith('NodeID-') ? v.nodeID.split('-')[1] : v.nodeID,
    blsPublicKey: v.signer.publicKey,
    weight: BigInt(v.weight),
  }));

  // Build ConversionData (preimage for the conversionID) and derive conversionID
  const conversionData = newConversionData(subnetID, chainID, address, sdkValidators);
  const conversionIdHex = conversionData.getConversionId();
  const conversionIdCB58 = hexToCB58(conversionIdHex as `0x${string}`);

  // Build the SubnetToL1ConversionMessage and wrap it in a WarpUnsignedMessage
  const innerMsg = newSubnetToL1ConversionMessage(conversionIdCB58);
  const unsigned = newWarpMessage(networkId, blockchainID, '', innerMsg.toHex());

  // Get signingSubnetId from Glacier
  const glacierRes = await fetch(`https://glacier-api.avax.network/v1/networks/${network}/blockchains/${chainID}`, {
    headers: { accept: 'application/json' },
  });
  if (!glacierRes.ok) throw new Error(`Glacier returned ${glacierRes.status}`);
  const glacierData = await glacierRes.json();
  if (!glacierData.subnetId) throw new Error('No subnetId from Glacier');

  return {
    message: unsigned.toHex(),
    justification: conversionData.toHex(),
    subnetId: subnetID,
    signingSubnetId: glacierData.subnetId,
    networkId,
    validators: rawValidators,
    chainId: chainID,
    managerAddress: address,
  };
}
