import { zeroAddress, type Address } from 'viem';

export type InitializedProbeClient = {
  readContract: (args: { address: Address; abi: readonly unknown[]; functionName: string }) => Promise<unknown>;
};

/**
 * A ValidatorManager behind OwnableUpgradeable reports the zero address from
 * owner() until initialize() has run. The ABI has no admin() function, so
 * owner() is the callable signal for "already initialized".
 *
 * A non-zero owner means initialized (`true`). The zero address does not mean
 * the opposite: a manager whose ownership was renounced reports it too, so it
 * reads as unknown (`null`) and the caller must settle it another way. Read
 * errors propagate.
 */
export async function readInitializedState(
  client: InitializedProbeClient,
  address: Address,
  abi: readonly unknown[],
): Promise<boolean | null> {
  const owner = await client.readContract({ address, abi, functionName: 'owner' });
  if (typeof owner === 'string' && owner.toLowerCase() !== zeroAddress) return true;
  return null;
}
