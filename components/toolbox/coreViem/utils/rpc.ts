import { avalanche, avalancheFuji } from "viem/chains";

//TODO: probably we should get rid of this
export const getRPCEndpoint = (isTestnet: boolean) => {
    if (isTestnet) {
        return avalancheFuji.rpcUrls.default.http[0].split("/").slice(0, 3).join("/");
    } else {
        return avalanche.rpcUrls.default.http[0].split("/").slice(0, 3).join("/");
    }
}
