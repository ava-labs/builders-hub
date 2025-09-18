import { PublicClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import validatorManagerAbi from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json"

/**
 * Get the current weight of a validator from the validator manager contract
 * 
 * @param client - The viem public client
 * @param proxyAddress - The address of the validator manager contract
 * @param validationID - The validation ID of the validator
 * @returns The current weight as a bigint or null if not found
 */
export async function getValidatorWeight(
  client: PublicClient<any, any, any, CoreWalletRpcSchema>,
  proxyAddress: `0x${string}`,
  validationID: string
): Promise<bigint | null> {
  try {
    // Call the getValidator view function to get validator details
    const validator = await client.readContract({
      address: proxyAddress,
      abi: validatorManagerAbi.abi,
      functionName: "getValidator",
      args: [validationID],
    });

    // Viem returns the struct as an object with named properties.
    // Access the 'weight' property directly.
    // The Validator struct has a 'weight' field of type uint64, which Viem maps to bigint.
    const validatorData = validator as { weight?: bigint; status?: number; nodeID?: string; startingWeight?: bigint; sentNonce?: bigint; receivedNonce?: bigint; startTime?: bigint; endTime?: bigint };

    if (validatorData && typeof validatorData.weight === 'bigint') {
      return validatorData.weight;
    } else {
      console.error("Error fetching validator weight: 'weight' property not found or not a bigint. Validator data:", validatorData);
      return null;
    }
  } catch (error) {
    console.error("Error fetching validator weight via readContract:", error);
    return null;
  }
} 
