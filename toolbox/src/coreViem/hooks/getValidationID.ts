import { PublicClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { parseNodeID } from "../utils/ids";
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"   

/**
 * Get the validation ID for a given node ID from the validator manager contract
 * @param client - The viem client
 * @param proxyAddress - The address of the proxy contract
 * @param nodeID - The node ID to get the validation ID for
 * @returns The validation ID for the given node ID
 */
export async function getValidationIdHex(client: PublicClient<any, any, any, CoreWalletRpcSchema>, proxyAddress: `0x${string}`, nodeID: string): Promise<`0x${string}`> {
    const nodeIDBytes = parseNodeID(nodeID)
    const validationID = await client.readContract({
      address: proxyAddress as `0x${string}`,
      abi: validatorManagerAbi.abi,
      functionName: "registeredValidators",
      args: [nodeIDBytes]
    })
    return validationID as `0x${string}`
}
