// Private transfer — the canonical eERC operation. Generates a 32-public-signal
// Groth16 transfer proof plus auxiliary PCTs (for receiver, auditor, and the
// sender's new balance) and submits the tx.
//
// Ported from @avalabs/ac-eerc-sdk (src/EERC.ts `transfer` / `generateTransferProof`)
// with wagmi-v1 hook dependencies stripped — this module is pure crypto + a
// caller-provided viem wallet writer.

import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { BabyJub, FF, Poseidon, SNARK_FIELD_SIZE } from '../crypto';
import type { BJPoint } from '../crypto/babyjub';
import {
  assertEERCBalanceWitnessMatchesPlaintext,
  normalizeEERCBalanceProofError,
} from '../balanceValidation';
import { generateProof } from '../proof';
import type { EERCDeployment, Hex } from '../types';

/** Flattened encrypted balance: [c1.x, c1.y, c2.x, c2.y] — what the transfer circuit wants. */
export type FlatEncryptedBalance = readonly [bigint, bigint, bigint, bigint];

export interface TransferInputs {
  deployment: EERCDeployment;
  senderAddress: Hex;
  senderPrivateKey: bigint;
  senderPublicKey: BJPoint;
  recipientAddress: Hex;
  recipientPublicKey: BJPoint;
  auditorPublicKey: BJPoint;
  /** Current encrypted balance of the sender, flattened to 4 elements. */
  encryptedBalance: FlatEncryptedBalance;
  /** Decrypted (plaintext) balance of the sender in eERC cents. */
  decryptedBalance: bigint;
  /** Amount to send, in eERC cents. MUST be <= decryptedBalance. */
  amount: bigint;
  /** tokenId for converter mode, 0 for standalone. */
  tokenId: bigint;
  writeContract: (args: {
    address: Hex;
    abi: unknown[];
    functionName: string;
    args: unknown[];
  }) => Promise<Hex>;
}

export async function transferPrivate(inputs: TransferInputs): Promise<{ txHash: Hex }> {
  const {
    deployment,
    senderPrivateKey,
    senderPublicKey,
    recipientAddress,
    recipientPublicKey,
    auditorPublicKey,
    encryptedBalance,
    decryptedBalance,
    amount,
    tokenId,
    writeContract,
  } = inputs;

  if (amount <= 0n) throw new Error('Amount must be positive');
  if (amount > decryptedBalance) throw new Error('Insufficient encrypted balance');
  assertEERCBalanceWitnessMatchesPlaintext({
    encryptedBalance,
    privateKey: senderPrivateKey,
    plaintextBalance: decryptedBalance,
    publicKey: [senderPublicKey[0], senderPublicKey[1]],
  });
  if (recipientPublicKey[0] === 0n && recipientPublicKey[1] === 0n) {
    throw new Error('Recipient is not registered on this eERC Registrar');
  }

  const senderNewBalance = decryptedBalance - amount;

  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);
  const poseidon = new Poseidon(field, curve);

  // (1) ElGamal-encrypt amount under sender's pubkey (for on-chain homomorphic
  //     subtraction from sender's balance).
  const { cipher: sCipher } = await curve.encryptMessage(senderPublicKey, amount);

  // (2) ElGamal-encrypt amount under recipient's pubkey (added to their balance).
  const { cipher: rCipher, random: rRandom } = await curve.encryptMessage(recipientPublicKey, amount);

  // (3) Poseidon-encrypt amount under recipient pubkey — delivers the plaintext
  //     amount to the recipient when they decrypt their new balance history.
  const rPCT = await poseidon.processPoseidonEncryption({ inputs: [amount], publicKey: recipientPublicKey });

  // (4) Poseidon-encrypt amount under auditor pubkey — lets the auditor decrypt
  //     (sender, recipient, amount) for compliance without learning balances.
  const aPCT = await poseidon.processPoseidonEncryption({ inputs: [amount], publicKey: auditorPublicKey });

  // (5) Poseidon-encrypt sender's new balance under their own pubkey so they
  //     can decrypt it next time — this is the balancePCT we submit alongside
  //     the proof.
  const sBalPCT = await poseidon.processPoseidonEncryption({
    inputs: [senderNewBalance],
    publicKey: senderPublicKey,
  });

  const circuitInput = {
    ValueToTransfer: amount,
    SenderPrivateKey: senderPrivateKey,
    SenderPublicKey: [senderPublicKey[0], senderPublicKey[1]],
    SenderBalance: decryptedBalance,
    SenderBalanceC1: [encryptedBalance[0], encryptedBalance[1]],
    SenderBalanceC2: [encryptedBalance[2], encryptedBalance[3]],
    SenderVTTC1: sCipher.c1,
    SenderVTTC2: sCipher.c2,
    ReceiverPublicKey: [recipientPublicKey[0], recipientPublicKey[1]],
    ReceiverVTTC1: rCipher.c1,
    ReceiverVTTC2: rCipher.c2,
    ReceiverVTTRandom: rRandom,
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

  let generatedProof: Awaited<ReturnType<typeof generateProof>>;
  try {
    generatedProof = await generateProof('transfer', circuitInput);
  } catch (err) {
    throw normalizeEERCBalanceProofError(err);
  }
  const { points, publicSignals } = generatedProof;
  if (publicSignals.length !== 32) {
    throw new Error(`Expected 32 public signals for transfer, got ${publicSignals.length}`);
  }

  const proofStruct = {
    proofPoints: points,
    publicSignals,
  };

  const senderBalancePCT: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    sBalPCT.cipher[0]!,
    sBalPCT.cipher[1]!,
    sBalPCT.cipher[2]!,
    sBalPCT.cipher[3]!,
    sBalPCT.authKey[0],
    sBalPCT.authKey[1],
    sBalPCT.nonce,
  ];

  const txHash = await writeContract({
    address: deployment.encryptedERC,
    abi: EncryptedERCArtifact.abi,
    functionName: 'transfer',
    args: [recipientAddress, tokenId, proofStruct, senderBalancePCT],
  });

  return { txHash };
}
