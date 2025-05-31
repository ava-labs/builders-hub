import { WalletClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { getRPCEndpoint } from "../utils/rpc";
import { getBlockchainInfo } from "../utils/glacier";

export const STANDARD_SUBNET_EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy";

export type SubnetVMInfo = {
    blockchainId: string;
    vmId: string;
    blockchainName: string;
    isStandardVM: boolean;
};

export type SubnetVMAnalysis = {
    chains: SubnetVMInfo[];
    hasNonStandardVMs: boolean;
    vmAliases: Record<string, string>; // vmId -> alias mapping
};

/**
 * Analyzes all chains in a subnet to determine their VM IDs and whether VM aliases are needed
 */
export async function getSubnetVMInfo(
    client: WalletClient<any, any, any, CoreWalletRpcSchema>,
    subnetId: string
): Promise<SubnetVMAnalysis> {
    const isTestnetMode = await isTestnet(client);
    const rpcEndpoint = getRPCEndpoint(isTestnetMode);

    // Get all blockchain IDs for this subnet using platform.validates
    const response = await fetch(rpcEndpoint + "/ext/bc/P", {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'platform.validates',
            params: {
                subnetID: subnetId
            },
            id: 1
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(`Failed to get blockchains for subnet ${subnetId}: ${data.error.message}`);
    }

    const blockchainIds: string[] = data.result.blockchainIDs || [];

    if (blockchainIds.length === 0) {
        return {
            chains: [],
            hasNonStandardVMs: false,
            vmAliases: {}
        };
    }

    // Get VM info for each blockchain using Glacier API
    const chains: SubnetVMInfo[] = [];
    const vmAliases: Record<string, string> = {};

    for (const blockchainId of blockchainIds) {
        try {
            const blockchainInfo = await getBlockchainInfo(blockchainId);

            const isStandardVM = blockchainInfo.vmId === STANDARD_SUBNET_EVM_VM_ID;

            chains.push({
                blockchainId,
                vmId: blockchainInfo.vmId,
                blockchainName: blockchainInfo.blockchainName,
                isStandardVM
            });

            // If not standard VM, create an alias mapping
            if (!isStandardVM) {
                // Create a simple alias based on the blockchain name or use the VM ID
                const alias = blockchainInfo.blockchainName.toLowerCase().replace(/[^a-z0-9]/g, '') ||
                    blockchainInfo.vmId.slice(0, 8);
                vmAliases[blockchainInfo.vmId] = alias;
            }
        } catch (error) {
            console.warn(`Failed to get blockchain info for ${blockchainId}:`, error);
            // Add with unknown info but mark as potentially non-standard
            chains.push({
                blockchainId,
                vmId: 'unknown',
                blockchainName: 'unknown',
                isStandardVM: false
            });
        }
    }

    const hasNonStandardVMs = chains.some(chain => !chain.isStandardVM);

    return {
        chains,
        hasNonStandardVMs,
        vmAliases
    };
} 