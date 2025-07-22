import { PublicClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"   


/**
 * Check the owner of a given contract matches the expected owner
 * @param client - The viem client
 * @param contractAddress - The address of the contract
 * @param expectedOwner - The expected owner of the contract
 * @returns True if the owner matches the expected owner, false otherwise
 */
export async function validateContractOwner(client: PublicClient<any, any, any, CoreWalletRpcSchema>, contractAddress: `0x${string}`, expectedOwner: `0x${string}`): Promise<boolean> {
    const owner = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: "owner",
    }) as `0x${string}`;
    return expectedOwner.toLowerCase() === owner.toLowerCase();
}