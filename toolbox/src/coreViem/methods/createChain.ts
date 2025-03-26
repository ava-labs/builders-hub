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

    const txID = await window.avalanche!.request({
        method: 'avalanche_sendTransaction',
        params: {
            transactionHex: utils.bufferToHex(tx.toBytes()),
            chainAlias: 'P',
        }
    }) as string;

    return txID;

}
