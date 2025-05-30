import { WalletClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";

export async function getCorethAddress(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const addresses = await client.getAddresses()
    return addresses[0];
}
