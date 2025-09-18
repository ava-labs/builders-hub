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

export type CreateSubnetParams = {
    subnetOwners: string[];
}

export async function createSubnet(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: CreateSubnetParams): Promise<string> {
    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));
    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const feeState = await pvmApi.getFeeState();
    const context = await Context.getContextFromURI(rpcEndpoint);

    const pChainAddress = await getPChainAddress(client);

    const { utxos } = await pvmApi.getUTXOs({
        addresses: [pChainAddress]
    });

    const tx = pvm.e.newCreateSubnetTx({
        feeState,
        fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
        utxos,
        subnetOwners: params.subnetOwners.map(utils.bech32ToBytes),
    }, context);

    const txID = await client.request({
        method: 'avalanche_sendTransaction',
        params: {
            transactionHex: utils.bufferToHex(tx.toBytes()),
            chainAlias: 'P',
        }
    }) as string;

    return txID;

}
