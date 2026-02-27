import { packL1ConversionMessage, PackL1ConversionMessageArgs } from "../../../coreViem/utils/convertWarp";
import { networkIDs, utils } from "@avalabs/avalanchejs";

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
  const network = isTestnet ? "fuji" : "mainnet";
  const rpcUrl = isTestnet
    ? "https://api.avax-test.network/ext/bc/P"
    : "https://api.avax.network/ext/bc/P";

  // Fetch the P-Chain transaction
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "platform.getTx",
      params: { txID: txId, encoding: "json" },
      id: 1,
    }),
  });

  const data = await response.json();
  const tx = data?.result?.tx;

  if (!tx?.unsignedTx?.subnetID || !tx?.unsignedTx?.chainID || !tx?.unsignedTx?.address || !tx?.unsignedTx?.validators) {
    throw new Error("Invalid transaction data — is this a ConvertSubnetToL1Tx?");
  }

  const { subnetID, chainID, address, validators, blockchainID } = tx.unsignedTx;

  const conversionArgs: PackL1ConversionMessageArgs = {
    subnetId: subnetID,
    managerChainID: chainID,
    managerAddress: address,
    validators: validators.map((v: any) => ({
      nodeID: v.nodeID,
      nodePOP: v.signer,
      weight: v.weight,
    })),
  };

  const [message, justification] = packL1ConversionMessage(conversionArgs, networkId, blockchainID);

  // Get signingSubnetId from Glacier
  const glacierRes = await fetch(
    `https://glacier-api.avax.network/v1/networks/${network}/blockchains/${chainID}`,
    { headers: { accept: "application/json" } }
  );
  if (!glacierRes.ok) throw new Error(`Glacier returned ${glacierRes.status}`);
  const glacierData = await glacierRes.json();
  if (!glacierData.subnetId) throw new Error("No subnetId from Glacier");

  return {
    message: utils.bufferToHex(message),
    justification: utils.bufferToHex(justification),
    subnetId: subnetID,
    signingSubnetId: glacierData.subnetId,
    networkId,
    validators,
    chainId: chainID,
    managerAddress: address,
  };
}
