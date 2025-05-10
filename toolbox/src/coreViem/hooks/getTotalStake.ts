import { PublicClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import validatorManagerAbi from "../../../contracts/icm-contracts/compiled/ValidatorManager.json"

/**
 * Get the total L1 weight from the validator manager contract
 * 
 * @param client - The viem public client
 * @param proxyAddress - The address of the validator manager contract
 * @returns The total L1 weight as a bigint
 */
export async function getTotalStake(
  client: PublicClient<any, any, any, CoreWalletRpcSchema>,
  proxyAddress: `0x${string}`
): Promise<bigint> {
  try {
    // Call the l1TotalWeight view function - this is the correct method name
    const totalWeight = await client.readContract({
      address: proxyAddress,
      abi: validatorManagerAbi.abi,
      functionName: "l1TotalWeight",
    });
    
    return totalWeight as bigint;
  } catch (error) {
    console.error("Error fetching total L1 weight:", error);
    // Return 0n if there's an error
    return 0n;
  }
}

/**
 * Calculate if a validator weight would exceed the maximum percentage of total stake
 * 
 * @param totalStake - The current total L1 weight
 * @param validatorWeight - The weight of the validator to check
 * @param maxPercentage - The maximum allowed percentage (default: 20)
 * @returns An object with the percentage and whether it exceeds the maximum
 */
export function validateStakePercentage(
  totalStake: bigint, 
  validatorWeight: bigint,
  maxPercentage: number = 20
): { percentage: number; exceedsMaximum: boolean } {
  if (totalStake === 0n) {
    // If there's no total stake, this would be the first validator
    return { percentage: 100, exceedsMaximum: false };
  }
  
  // Calculate the percentage that this validator would represent
  // Formula: (validatorWeight / (totalStake + validatorWeight)) * 100
  const percentage = Number(validatorWeight * 100n) / Number(totalStake + validatorWeight);
  
  return {
    percentage,
    exceedsMaximum: percentage >= maxPercentage
  };
} 