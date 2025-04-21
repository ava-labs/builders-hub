import { pvm } from "@avalabs/avalanchejs";
import { WalletClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { getPChainAddress } from "./getPChainAddress";
import { getRPCEndpoint } from "../utils/rpc";

export async function getPChainBalance(client: WalletClient<any, any, any, CoreWalletRpcSchema>): Promise<bigint> {
    const pChainAddress = await getPChainAddress(client);
    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));

    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const balance = await pvmApi.getBalance({
        addresses: [pChainAddress],
    })

    return balance.balance;
}
