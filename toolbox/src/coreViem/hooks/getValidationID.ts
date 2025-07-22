import { PublicClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"   

/**
 * Get the validation ID for a given node ID from the validator manager contract
 * @param client - The viem client
 * @param proxyAddress - The address of the proxy contract
 * @param nodeID - The node ID to get the validation ID for
 * @returns The validation ID for the given node ID
 */
export async function getValidationIdHex(client: PublicClient<any, any, any, CoreWalletRpcSchema>, proxyAddress: `0x${string}`, nodeID: string): Promise<`0x${string}`> {
    // Convert nodeID to bytes format
    let nodeIDBytes: `0x${string}`;
    
    if (nodeID.startsWith('0x')) {
        nodeIDBytes = nodeID as `0x${string}`;
    } else {
        nodeIDBytes = `0x${nodeID}` as `0x${string}`;
    }
    
    // First try getNodeValidationID (exists in current ABI)
    try {
        const validationID = await client.readContract({
            address: proxyAddress,
            abi: validatorManagerAbi.abi,
            functionName: "getNodeValidationID",
            args: [nodeIDBytes]
        });
        
        return validationID as `0x${string}`;
    } catch (error) {
        console.warn("getNodeValidationID failed, trying registeredValidators:", error);
    }
    
    // Fallback to registeredValidators (might exist in older contract versions)
    try {
        // Try with a simple ABI for registeredValidators
        const registeredValidatorsAbi = [
            {
                "type": "function",
                "name": "registeredValidators", 
                "inputs": [{"type": "bytes", "name": "nodeID"}],
                "outputs": [{"type": "bytes32", "name": ""}],
                "stateMutability": "view"
            }
        ];
        
        const validationID = await client.readContract({
            address: proxyAddress,
            abi: registeredValidatorsAbi,
            functionName: "registeredValidators",
            args: [nodeIDBytes]
        });
        
        return validationID as `0x${string}`;
    } catch (error) {
        console.warn("registeredValidators also failed:", error);
        throw new Error(`Both getNodeValidationID and registeredValidators failed. NodeID: ${nodeID}. The contract might not have either function or the nodeID format is incorrect.`);
    }
}
