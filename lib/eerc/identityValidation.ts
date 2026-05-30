import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import { loadIdentity, type EERCIdentitySecret } from './identity';
import type { Hex } from './types';
import type { Abi } from 'viem';

export const EERC_IDENTITY_MISMATCH_MESSAGE =
  'Your cached BabyJubJub key does not match the public key registered on-chain. Open Register, clear the local key, and re-derive it from the wallet that created the registration before depositing, transferring, or withdrawing.';

export const EERC_IDENTITY_NOT_REGISTERED_MESSAGE = 'Register your BabyJubJub identity before using encrypted-ERC.';

export function eercPublicKeysEqual(
  localKey: readonly [bigint, bigint] | null | undefined,
  onChainKey: readonly [bigint, bigint] | null | undefined,
): boolean {
  return Boolean(localKey && onChainKey && localKey[0] === onChainKey[0] && localKey[1] === onChainKey[1]);
}

export function isZeroEERCPublicKey(key: readonly [bigint, bigint] | null | undefined): boolean {
  return !key || (key[0] === 0n && key[1] === 0n);
}

export function assertEERCIdentityMatchesOnChain(
  identity: EERCIdentitySecret,
  onChainPublicKey: readonly [bigint, bigint],
): void {
  if (isZeroEERCPublicKey(onChainPublicKey)) {
    throw new Error(EERC_IDENTITY_NOT_REGISTERED_MESSAGE);
  }
  if (!eercPublicKeysEqual(identity.publicKey, onChainPublicKey)) {
    throw new Error(EERC_IDENTITY_MISMATCH_MESSAGE);
  }
}

interface RegistrarReader {
  readContract(args: {
    address: Hex;
    abi: Abi | readonly unknown[];
    functionName: 'getUserPublicKey';
    args: readonly [string];
  }): Promise<unknown>;
}

export async function loadVerifiedEERCIdentity({
  address,
  registrar,
  publicClient,
}: {
  address: string;
  registrar: Hex;
  publicClient: RegistrarReader;
}): Promise<EERCIdentitySecret> {
  const identity = loadIdentity(address, registrar);
  if (!identity) throw new Error(EERC_IDENTITY_NOT_REGISTERED_MESSAGE);

  const key = (await publicClient.readContract({
    address: registrar,
    abi: RegistrarArtifact.abi,
    functionName: 'getUserPublicKey',
    args: [address],
  })) as readonly [bigint, bigint];

  assertEERCIdentityMatchesOnChain(identity, key);
  return identity;
}

export function localIdentityMatchesRegistrar(
  identity: EERCIdentitySecret | null,
  onChainPublicKey: readonly [bigint, bigint] | null,
): boolean | null {
  if (!identity || !onChainPublicKey || isZeroEERCPublicKey(onChainPublicKey)) return null;
  return eercPublicKeysEqual(identity.publicKey, onChainPublicKey);
}
