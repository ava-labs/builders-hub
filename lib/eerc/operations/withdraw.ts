// Converter-mode withdrawal — unwraps encrypted eERC back to the original
// ERC20. Generates a 16-public-signal WITHDRAW Groth16 proof + auditor PCT
// + sender-new-balance PCT.
//
// Note: after withdrawal, the amount is public (it leaves the encrypted
// system) — only the *source* balance privacy is preserved.

import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { BabyJub, FF, Poseidon, SNARK_FIELD_SIZE } from '../crypto';
import type { BJPoint } from '../crypto/babyjub';
import { generateProof } from '../proof';
import type { EERCDeployment, Hex } from '../types';
import type { FlatEncryptedBalance } from './transfer';

export interface WithdrawInputs {
  deployment: EERCDeployment;
  senderAddress: Hex;
  senderPrivateKey: bigint;
  senderPublicKey: BJPoint;
  auditorPublicKey: BJPoint;
  encryptedBalance: FlatEncryptedBalance;
  decryptedBalance: bigint;
  amount: bigint;
  tokenId: bigint;
  writeContract: (args: {
    address: Hex;
    abi: unknown[];
    functionName: string;
    args: unknown[];
  }) => Promise<Hex>;
}

export async function withdrawFromEERC(inputs: WithdrawInputs): Promise<{ txHash: Hex }> {
  const {
    deployment,
    senderPrivateKey,
    senderPublicKey,
    auditorPublicKey,
    encryptedBalance,
    decryptedBalance,
    amount,
    tokenId,
    writeContract,
  } = inputs;

  if (amount <= 0n) throw new Error('Amount must be positive');
  if (amount > decryptedBalance) throw new Error('Insufficient encrypted balance');

  const newBalance = decryptedBalance - amount;

  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);
  const poseidon = new Poseidon(field, curve);

  const senderPCT = await poseidon.processPoseidonEncryption({
    inputs: [newBalance],
    publicKey: senderPublicKey,
  });
  const auditorPCT = await poseidon.processPoseidonEncryption({
    inputs: [amount],
    publicKey: auditorPublicKey,
  });

  const circuitInput = {
    ValueToWithdraw: amount,
    SenderPrivateKey: senderPrivateKey,
    SenderPublicKey: [senderPublicKey[0], senderPublicKey[1]],
    SenderBalance: decryptedBalance,
    SenderBalanceC1: [encryptedBalance[0], encryptedBalance[1]],
    SenderBalanceC2: [encryptedBalance[2], encryptedBalance[3]],
    AuditorPublicKey: [auditorPublicKey[0], auditorPublicKey[1]],
    AuditorPCT: auditorPCT.cipher,
    AuditorPCTAuthKey: auditorPCT.authKey,
    AuditorPCTNonce: auditorPCT.nonce,
    AuditorPCTRandom: auditorPCT.encryptionRandom,
  };

  const { points, publicSignals } = await generateProof('withdraw', circuitInput);
  if (publicSignals.length !== 16) {
    throw new Error(`Expected 16 public signals for withdraw, got ${publicSignals.length}`);
  }

  const proofStruct = { proofPoints: points, publicSignals };

  const userBalancePCT: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    senderPCT.cipher[0]!,
    senderPCT.cipher[1]!,
    senderPCT.cipher[2]!,
    senderPCT.cipher[3]!,
    senderPCT.authKey[0],
    senderPCT.authKey[1],
    senderPCT.nonce,
  ];

  const txHash = await writeContract({
    address: deployment.encryptedERC,
    abi: EncryptedERCArtifact.abi,
    functionName: 'withdraw',
    args: [tokenId, proofStruct, userBalancePCT],
  });

  return { txHash };
}
