// Orchestrates the Registrar.register() flow:
//   1. Derive BJJ identity from wallet signature (if not cached).
//   2. Compute the registration hash the circuit expects.
//   3. Generate a Groth16 registration proof.
//   4. Build the `RegisterProof` calldata and submit via the wallet client.
//
// The caller provides a `signMessage` + `writeContract` pair — this keeps
// the module agnostic between wagmi-v3 hooks, raw viem clients, or Node
// deploy scripts.

import { poseidon3 } from 'poseidon-lite';
import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import { deriveIdentity, type EERCIdentitySecret } from './identity';
import { generateProof } from './proof';
import type { Hex } from './types';

export interface RegisterInputs {
  /** The connected EVM address that will be bound to the new BJJ identity. */
  address: Hex;
  /** The chain ID the registration is bound to (read from wallet / publicClient). */
  chainId: number;
  /** The deployed Registrar contract for this chain. */
  registrarAddress: Hex;
  /** Sign an EIP-191 message with the user's wallet. */
  signMessage: (message: string) => Promise<Hex>;
  /** Submit the register() transaction, returning the tx hash. */
  writeContract: (args: {
    address: Hex;
    abi: unknown[];
    functionName: 'register';
    args: unknown[];
  }) => Promise<Hex>;
  /** Optional previously-cached identity, to avoid re-prompting for a signature. */
  cachedIdentity?: EERCIdentitySecret;
}

export interface RegisterResult {
  identity: EERCIdentitySecret;
  txHash: Hex;
}

export async function registerOnChain(inputs: RegisterInputs): Promise<RegisterResult> {
  const { address, chainId, registrarAddress, signMessage, writeContract } = inputs;

  const identity = inputs.cachedIdentity ?? (await deriveIdentity(address, signMessage));

  const chainIdBig = BigInt(chainId);
  const fullAddress = BigInt(address);
  // The circuit's "registration hash" binds (chainId, private key, address) —
  // prevents an attacker who learns a user's public key from reusing it on a
  // different chain or for a different address.
  const registrationHash = poseidon3([chainIdBig, identity.formattedKey, fullAddress]);

  const circuitInput = {
    SenderPrivateKey: identity.formattedKey,
    SenderPublicKey: [identity.publicKey[0], identity.publicKey[1]],
    SenderAddress: fullAddress,
    ChainID: chainIdBig,
    RegistrationHash: registrationHash,
  };

  const { points, publicSignals } = await generateProof('registration', circuitInput);

  // Solidity expects exactly 5 public signals for the register circuit.
  if (publicSignals.length !== 5) {
    throw new Error(`Unexpected publicSignals length ${publicSignals.length}, expected 5`);
  }

  const registerProof = {
    proofPoints: points,
    publicSignals: [publicSignals[0], publicSignals[1], publicSignals[2], publicSignals[3], publicSignals[4]],
  };

  const txHash = await writeContract({
    address: registrarAddress,
    abi: RegistrarArtifact.abi,
    functionName: 'register',
    args: [registerProof],
  });

  return { identity, txHash };
}
