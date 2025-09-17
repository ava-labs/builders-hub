import { WalletClient } from "viem";
import { packL1ConversionMessage, PackL1ConversionMessageArgs } from "../utils/convertWarp";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { networkIDs, utils } from "@avalabs/avalanchejs";

interface AddressObject {
    threshold: number;
    addresses: string[];
}

interface ValidatorSigner {
    publicKey: string;
    proofOfPossession: string;
}

interface Validator {
    nodeID: string;
    weight: number;
    balance: number;
    signer: ValidatorSigner;
    remainingBalanceOwner: AddressObject;
    deactivationOwner: AddressObject;
}

interface SubnetAuthorization {
    signatureIndices: number[];
}

interface OutputObject {
    addresses: string[];
    amount: number;
    locktime: number;
    threshold: number;
}

interface Output {
    assetID: string;
    fxID: string;
    output: OutputObject;
}

interface InputObject {
    amount: number;
    signatureIndices: number[];
}

interface Input {
    txID: string;
    outputIndex: number;
    assetID: string;
    fxID: string;
    input: InputObject;
}

interface UnsignedTx {
    networkID: number;
    blockchainID: string;
    outputs: Output[];
    inputs: Input[];
    memo: string;
    subnetID: string;
    chainID: string;
    address: string;
    validators: Validator[];
    subnetAuthorization: SubnetAuthorization;
}

interface Credential {
    signatures: string[];
}

interface Transaction {
    unsignedTx: UnsignedTx;
    credentials: Credential[];
    id: string;
}

interface TransactionResult {
    tx: Transaction;
    encoding: string;
}

interface ConversionDataResponse {
    result: TransactionResult;
}


export type ExtractWarpMessageFromTxParams = {
    txId: string;
}

export type ExtractWarpMessageFromTxResponse = {
    message: string;
    justification: string;
    subnetId: string;
    signingSubnetId: string;
    networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
    validators: Validator[];
    chainId: string;
    managerAddress: string;
}

// FIXME: This should be included in avacloud-sdk but I'm afraid to version bump right now
// if you have better idea to get the subnetId from a blockchainId, please go ahead and change it
/**
 * Fetches blockchain information from Glacier API
 * @param network "fuji" or "mainnet"
 * @param blockchainId The blockchain ID to query
 * @returns The subnet ID associated with the blockchain
 */
export async function getSubnetIdFromChainId(network: "fuji" | "mainnet", blockchainId: string): Promise<string> {
    try {
        const response = await fetch(`https://glacier-api.avax.network/v1/networks/${network}/blockchains/${blockchainId}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Glacier API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.subnetId) {
            throw new Error('No subnetId found in response');
        }
        
        return data.subnetId;
    } catch (error) {
        console.error('Error fetching subnet info from Glacier:', error);
        throw error;
    }
}

//TODO: rename
export async function extractWarpMessageFromPChainTx(client: WalletClient<any, any, any, CoreWalletRpcSchema>, { txId }: ExtractWarpMessageFromTxParams): Promise<ExtractWarpMessageFromTxResponse> {
    const isTestnetMode = await isTestnet(client);
    const rpcEndpoint = getRPCEndpoint(isTestnetMode);
    const networkId = isTestnetMode ? networkIDs.FujiID : networkIDs.MainnetID;

    //Fixme: here we do a direct call instead of using avalanchejs, because we need to get the raw response from the node
    const response = await fetch(rpcEndpoint + "/ext/bc/P", {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'platform.getTx',
            params: {
                txID: txId,
                encoding: 'json'
            },
            id: 1
        })
    });

    const data = await response.json() as ConversionDataResponse

    if (!data?.result?.tx?.unsignedTx?.subnetID || !data?.result?.tx?.unsignedTx?.chainID || !data?.result?.tx?.unsignedTx?.address || !data?.result?.tx?.unsignedTx?.validators) {
        console.log('txId', txId)
        console.log('data', data)
        throw new Error("Invalid transaction data, are you sure this is a conversion transaction?");
    }

    const conversionArgs: PackL1ConversionMessageArgs = {
        subnetId: data.result.tx.unsignedTx.subnetID,
        managerChainID: data.result.tx.unsignedTx.chainID,
        managerAddress: data.result.tx.unsignedTx.address,
        validators: data.result.tx.unsignedTx.validators.map((validator) => {
            return {
                nodeID: validator.nodeID,
                nodePOP: validator.signer,
                weight: validator.weight
            }
        })
    };

    const [message, justification] = packL1ConversionMessage(conversionArgs, networkId, data.result.tx.unsignedTx.blockchainID);
    const network = networkId === networkIDs.FujiID ? "fuji" : "mainnet";
    const signingSubnetId = await getSubnetIdFromChainId(network, data.result.tx.unsignedTx.chainID);
    return {
        message: utils.bufferToHex(message),
        justification: utils.bufferToHex(justification),
        subnetId: data.result.tx.unsignedTx.subnetID,
        signingSubnetId: signingSubnetId,
        networkId,
        validators: data.result.tx.unsignedTx.validators,
        chainId: data.result.tx.unsignedTx.chainID,
        managerAddress: data.result.tx.unsignedTx.address,
    }
}
