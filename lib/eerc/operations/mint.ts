// Private mint — a standalone eERC's owner mints encrypted tokens to a
// registered user. Generates the 24-public-signal Groth16 mint proof plus the
// receiver and auditor PCTs, then submits privateMint(user, proof).
//
// Ported from @avalabs/ac-eerc-sdk (`EERC.privateMint`) with the wallet and
// public client injected, like transfer.ts and withdraw.ts.

import { poseidon5 } from 'poseidon-lite';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { BabyJub, FF, Poseidon, SNARK_FIELD_SIZE } from '../crypto';
import type { BJPoint } from '../crypto/babyjub';
import { generateProof } from '../proof';
import type { Hex } from '../types';

export interface MintInputs {
  encryptedERC: Hex;
  chainId: number;
  recipientAddress: Hex;
  recipientPublicKey: BJPoint;
  auditorPublicKey: BJPoint;
  /** Amount in eERC cents (2 decimals). */
  amount: bigint;
  writeContract: (args: { address: Hex; abi: unknown[]; functionName: string; args: unknown[] }) => Promise<Hex>;
}

export async function privateMint(inputs: MintInputs): Promise<{ txHash: Hex }> {
  const { encryptedERC, chainId, recipientAddress, recipientPublicKey, auditorPublicKey, amount, writeContract } =
    inputs;
  if (amount <= 0n) throw new Error('Mint amount must be positive');
  if (recipientPublicKey[0] === 0n && recipientPublicKey[1] === 0n)
    throw new Error('The recipient is not registered on this eERC Registrar');
  if (auditorPublicKey[0] === 0n && auditorPublicKey[1] === 0n)
    throw new Error('This token has no auditor key set yet');

  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);
  const poseidon = new Poseidon(field, curve);

  // ElGamal-encrypt the amount for the recipient's balance, and Poseidon-encrypt it for the recipient and the auditor.
  const { cipher, random } = await curve.encryptMessage(recipientPublicKey, amount);
  const rPCT = await poseidon.processPoseidonEncryption({ inputs: [amount], publicKey: recipientPublicKey });
  const aPCT = await poseidon.processPoseidonEncryption({ inputs: [amount], publicKey: auditorPublicKey });

  const chain = BigInt(chainId);
  // The contract rejects a second mint with the same nullifier, derived from the auditor PCT.
  const nullifierHash = poseidon5([chain, ...aPCT.cipher].map(String));

  const circuitInput = {
    ValueToMint: amount,
    ChainID: chain,
    NullifierHash: nullifierHash,
    ReceiverPublicKey: [recipientPublicKey[0], recipientPublicKey[1]],
    ReceiverVTTC1: cipher.c1,
    ReceiverVTTC2: cipher.c2,
    ReceiverVTTRandom: random,
    ReceiverPCT: rPCT.cipher,
    ReceiverPCTAuthKey: rPCT.authKey,
    ReceiverPCTNonce: rPCT.nonce,
    ReceiverPCTRandom: rPCT.encryptionRandom,
    AuditorPublicKey: [auditorPublicKey[0], auditorPublicKey[1]],
    AuditorPCT: aPCT.cipher,
    AuditorPCTAuthKey: aPCT.authKey,
    AuditorPCTNonce: aPCT.nonce,
    AuditorPCTRandom: aPCT.encryptionRandom,
  };

  const { points, publicSignals } = await generateProof('mint', circuitInput);
  if (publicSignals.length !== 24) throw new Error(`Expected 24 public signals for mint, got ${publicSignals.length}`);

  const txHash = await writeContract({
    address: encryptedERC,
    abi: EncryptedERCArtifact.abi,
    functionName: 'privateMint',
    args: [recipientAddress, { proofPoints: points, publicSignals }],
  });
  return { txHash };
}
