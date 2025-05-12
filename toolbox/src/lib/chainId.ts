import { createPublicClient } from "viem";
import { http } from "viem";
import { utils } from "@avalabs/avalanchejs";

export async function fetchChainId(rpcUrl: string): Promise<{ ethereumChainId: number, avalancheChainId: string }> {
    try {
        const publicClient = createPublicClient({
            transport: http(rpcUrl),
        });
        const WARP_PRECOMPILE_ADDRESS = "0x0200000000000000000000000000000000000005";

        // Get the Ethereum chain ID first
        const ethereumChainId = await publicClient.getChainId();

        // Create an interface for the Warp precompile
        const warpAbi = [
            {
                name: "getBlockchainID",
                type: "function",
                stateMutability: "view",
                inputs: [],
                outputs: [{ name: "blockchainID", type: "bytes32" }]
            }
        ] as const;

        // Call the getBlockchainID function
        const blockchainIDHex = await publicClient.readContract({
            address: WARP_PRECOMPILE_ADDRESS,
            abi: warpAbi,
            functionName: "getBlockchainID",
        });

        console.log('blockchainID', blockchainIDHex);
        const chainIdBytes = utils.hexToBuffer(blockchainIDHex);
        const avalancheChainId = utils.base58check.encode(chainIdBytes);


        return { ethereumChainId, avalancheChainId };
    } catch (error) {
        console.error("Failed to fetch chain ID:", error);
        throw error;
    }
}
