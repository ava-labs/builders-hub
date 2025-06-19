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
 * Validate if a proposed validator weight adjustment is within the allowed percentage of total L1 stake.
 * The rule: The absolute change in a validator's weight must not be 20% or more of the L1's total stake *before* the change.
 * 
 * @param totalL1StakeBeforeChange - The current total L1 weight before this proposed change.
 * @param newProposedWeightForValidator - The new proposed weight for the validator.
 * @param currentWeightOfValidatorToChange - The current weight of the validator being changed. Defaults to 0n for new validators.
 * @returns An object with the calculated percentage of total L1 stake that the adjustment represents, and whether it exceeds the 20% maximum.
 */
export function validateStakePercentage(
  totalL1StakeBeforeChange: bigint, 
  newProposedWeightForValidator: bigint,
  currentWeightOfValidatorToChange: bigint = 0n
): { percentageChange: number; exceedsMaximum: boolean } {

  // If the L1 is currently empty and we are adding the first validator.
  // Any positive weight is permissible as there's no existing stake to compare against for a percentage change.
  if (totalL1StakeBeforeChange === 0n && currentWeightOfValidatorToChange === 0n && newProposedWeightForValidator > 0n) {
    return { percentageChange: 100, exceedsMaximum: false }; // Represents 100% of new stake, but allowed.
  }

  // If total L1 stake is 0 and we are trying to set a weight (e.g. to 0), this is a no-op or non-impacting scenario.
  if (totalL1StakeBeforeChange === 0n) {
    return { percentageChange: 0, exceedsMaximum: false };
  }

  const weightAdjustment = newProposedWeightForValidator > currentWeightOfValidatorToChange 
    ? newProposedWeightForValidator - currentWeightOfValidatorToChange 
    : currentWeightOfValidatorToChange - newProposedWeightForValidator; // abs() for BigInt

  // Calculate the percentage of the total L1 stake that this adjustment represents.
  // Multiply by 10000 for precision with two decimal places, then divide by 100.
  const percentageOfTotalRepresentedByChange = 
    Number((weightAdjustment * 10000n) / totalL1StakeBeforeChange) / 100;

  return {
    percentageChange: percentageOfTotalRepresentedByChange,
    exceedsMaximum: percentageOfTotalRepresentedByChange >= 20
  };
} 