import { isAddress, type PublicClient } from 'viem';

// EIP-1967 slots: a proxy keeps its implementation and its admin here.
export const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

const isZeroWord = (word: string | undefined) => !word || /^0x0*$/.test(word);

/**
 * Why `target` must not become the implementation behind `proxy`, or null
 * when it may. A proxy pointed at itself or at another proxy sends every
 * call back into a proxy until the gas runs out, so the Validator Manager
 * stops working until the admin upgrades it again. Pass an empty `proxy`
 * for a proxy that does not exist yet.
 */
export async function implementationProblem(
  client: PublicClient,
  proxy: string,
  target: string,
): Promise<string | null> {
  if (!isAddress(target)) return 'Enter a valid contract address.';
  if (proxy && target.toLowerCase() === proxy.toLowerCase()) {
    return 'This is the proxy itself. Enter the ValidatorManager implementation.';
  }
  const code = await client.getCode({ address: target });
  if (!code || code === '0x') return 'No contract exists at this address on this chain.';
  const [implementation, admin] = await Promise.all([
    client.getStorageAt({ address: target, slot: IMPLEMENTATION_SLOT }),
    client.getStorageAt({ address: target, slot: ADMIN_SLOT }),
  ]);
  if (!isZeroWord(implementation) || !isZeroWord(admin)) {
    return 'This address is a proxy. Enter the ValidatorManager implementation behind it.';
  }
  return null;
}
