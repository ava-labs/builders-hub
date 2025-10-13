import { WalletClient } from "viem";
import {
    utils,
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { getPChainAddress } from "./getPChainAddress";
import { getRPCEndpoint } from "../utils/rpc";
import { pvm } from "@avalabs/avalanchejs";
import { Context } from "@avalabs/avalanchejs";
import { getChains } from "../utils/glacier";

export type CreateChainParams = {
    chainName: string;
    subnetAuth: number[];
    subnetId: string;
    vmId: string;
    fxIds: string[];
    genesisData: string;
}

export async function createChain(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: CreateChainParams): Promise<string> {
    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));
    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const feeState = await pvmApi.getFeeState();
    const context = await Context.getContextFromURI(rpcEndpoint);

    const pChainAddress = await getPChainAddress(client);

    const { utxos } = await pvmApi.getUTXOs({
        addresses: [pChainAddress]
    });

    // Create the unsigned transaction to get the chain ID before sending
    const tx = pvm.e.newCreateChainTx({
        feeState,
        fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
        utxos,
        chainName: params.chainName,
        subnetAuth: params.subnetAuth,
        subnetId: params.subnetId,
        vmId: params.vmId,
        fxIds: params.fxIds,
        genesisData: JSON.parse(params.genesisData),
    }, context);

    // Get the chain ID from the unsigned transaction
    const chainID = tx.getBlockchainId().toString();

    // Check for chain ID collisions using Glacier API
    const existingChains = await getChains();
    const chainIdCollision = existingChains.find(chain =>
        chain.platformChainId === chainID
    );

    if (chainIdCollision) {
        throw new Error(`Chain ID collision detected. The generated chain ID "${chainID}" already exists.`);
    }

    const manager = utils.getManagerForVM(tx.getVM());
    const [codec] = manager.getCodecFromBuffer(tx.toBytes());
    const utxoHexes = tx.utxos.map(utxo => utils.bufferToHex(utxo.toBytes(codec)));

    // If no collision, proceed with sending the transaction
    const txID = await window.avalanche!.request({
        method: 'avalanche_sendTransaction',
        params: {
            transactionHex: utils.bufferToHex(tx.toBytes()),
            chainAlias: 'P',
            utxos: utxoHexes,
        }
    }) as string;

    return txID;
}
