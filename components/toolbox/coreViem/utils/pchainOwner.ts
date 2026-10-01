import { utils } from '@avalabs/avalanchejs';

/** A P-Chain owner: its addresses, and how many of them must sign. */
type Owner = { addresses: string[]; threshold: number };

/**
 * The 20 bytes of a P-Chain address, or null. Takes bech32 with a chain alias
 * (P-fuji1...), bech32 without one (fuji1..., as the SDK takes it), or 0x hex.
 */
export function pChainAddressBytes(address: string): Uint8Array | null {
  const value = address.trim();
  if (/^0x/i.test(value)) return /^0x[0-9a-f]{40}$/i.test(value) ? utils.hexToBuffer(value) : null;
  try {
    const bytes = utils.bech32ToBytes(value.includes('-') ? value : `P-${value}`);
    return bytes.length === 20 ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Why an owner must not be signed into a ConvertSubnetToL1Tx or a validator
 * registration, or null when it may be. The P-Chain and the Validator Manager
 * both accept threshold 0 with no addresses: an owner that needs no
 * signature. The P-Chain also accepts the zero address, which no key controls.
 */
export function pChainOwnerProblem({ addresses, threshold }: Owner): string | null {
  if (addresses.length === 0) return 'needs at least one P-Chain address';
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > addresses.length) {
    return `needs a threshold from 1 to ${addresses.length}`;
  }
  for (const address of addresses) {
    const bytes = pChainAddressBytes(address);
    if (!bytes) return `has an address that is not a P-Chain address: ${address.trim() || '(empty)'}`;
    if (bytes.every((byte) => byte === 0)) return 'has the zero address, which no key controls';
  }
  return null;
}

/** The first problem among labelled owners, as a sentence, or null. */
export function firstOwnerProblem(owners: ReadonlyArray<readonly [Owner, string]>): string | null {
  for (const [owner, label] of owners) {
    const problem = pChainOwnerProblem(owner);
    if (problem) return `The ${label} ${problem}.`;
  }
  return null;
}
