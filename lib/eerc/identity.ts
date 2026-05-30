// Derive + persist the BabyJubJub identity for an (address, registrar)
// tuple. The BJJ secret is deterministic from an EIP-191 signature over
// REGISTER_MESSAGE, so strictly speaking we could re-derive it every page
// load. We cache it in localStorage anyway so the user isn't forced to
// open a MetaMask prompt on every tool.
//
// Security note: the BJJ secret is stored plaintext in localStorage. This
// is fine for a Fuji testnet demo but should be upgraded (e.g. derived
// on-demand, kept in memory only, or stored behind a passphrase) before
// any mainnet use.

import { BabyJub } from './crypto/babyjub';
import { FF } from './crypto/ff';
import { SNARK_FIELD_SIZE, REGISTER_MESSAGE } from './crypto/constants';
import { formatKeyForCurve, getPrivateKeyFromSignature } from './crypto/key';
import type { BJPoint } from './crypto/babyjub';

export interface EERCIdentitySecret {
  /** Hex string (no 0x prefix) of the raw decryption key before curve formatting. */
  decryptionKey: string;
  /** BabyJubJub secret scalar ready for use with `curve.generatePublicKey`. */
  formattedKey: bigint;
  /** Public key `[x, y]` corresponding to `formattedKey`. */
  publicKey: BJPoint;
}

const LOCAL_STORAGE_PREFIX = 'eerc:identity:';

function storageKey(address: string, registrar: string): string {
  return `${LOCAL_STORAGE_PREFIX}${address.toLowerCase()}@${registrar.toLowerCase()}`;
}

export function loadIdentity(address: string, registrar: string): EERCIdentitySecret | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(address, registrar));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { decryptionKey: string };
    return expandIdentity(parsed.decryptionKey);
  } catch {
    return null;
  }
}

export function saveIdentity(address: string, registrar: string, identity: EERCIdentitySecret): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    storageKey(address, registrar),
    JSON.stringify({ decryptionKey: identity.decryptionKey }),
  );
}

export function clearIdentity(address: string, registrar: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(address, registrar));
}

/** Given the raw decryption key, compute the curve-formatted key + public key. */
export function expandIdentity(decryptionKey: string): EERCIdentitySecret {
  const formattedKey = formatKeyForCurve(decryptionKey);
  const curve = new BabyJub(new FF(SNARK_FIELD_SIZE));
  const publicKey = curve.generatePublicKey(formattedKey);
  return { decryptionKey, formattedKey, publicKey };
}

/**
 * Ask the connected wallet to sign the REGISTER message and derive the BJJ
 * identity. The caller provides the `signMessage` function — this keeps the
 * module free of wagmi/viem imports so it can be reused from Node scripts.
 */
export async function deriveIdentity(
  address: `0x${string}`,
  signMessage: (message: string) => Promise<`0x${string}`>,
): Promise<EERCIdentitySecret> {
  const signature = await signMessage(REGISTER_MESSAGE(address));
  const decryptionKey = getPrivateKeyFromSignature(signature);
  return expandIdentity(decryptionKey);
}
