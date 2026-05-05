import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { BabyJub, FF, Poseidon, SNARK_FIELD_SIZE } from '../crypto';
import type { BJPoint } from '../crypto/babyjub';
import type { EERCDeployment, ERC20Meta, Hex } from '../types';

/** ERC20 allowance + balanceOf + approve — tiny ABI slice so we don't import a whole library. */
export const ERC20_MINIMAL_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Converts a human-entered amount in ERC20 decimals (e.g. "1.5") into the
 * eERC's 2-decimal internal representation. The contract does the same math
 * internally; we mirror it here so we can *show* the user the exact cents
 * they'll receive — and warn about any dust that won't fit.
 */
export function computeDepositCents(amountWei: bigint, tokenDecimals: number, eercDecimals: number): {
  cents: bigint;
  /** Portion of the input that was truncated during conversion — refunded by the contract. */
  dustWei: bigint;
} {
  const diff = BigInt(tokenDecimals - eercDecimals);
  if (diff < 0n) {
    // eERC decimals exceed token decimals — multiply instead of divide. Rare for
    // real tokens since eERC is 2 decimals and most ERC20s have 6/8/18.
    const cents = amountWei * 10n ** -diff;
    return { cents, dustWei: 0n };
  }
  const divisor = 10n ** diff;
  const cents = amountWei / divisor;
  const dustWei = amountWei - cents * divisor;
  return { cents, dustWei };
}

export interface DepositInputs {
  deployment: EERCDeployment;
  token: ERC20Meta;
  /** Amount in the source ERC20's native (smallest-unit) representation. */
  amountWei: bigint;
  /** User's BabyJubJub public key — encrypt the deposit amount to this. */
  userPublicKey: BJPoint;
  /** viem/wagmi writeContract wrapper that returns the tx hash. */
  writeContract: (args: {
    address: Hex;
    abi: unknown[];
    functionName: string;
    args: unknown[];
  }) => Promise<Hex>;
}

/**
 * Encode + submit an eERC converter-mode deposit. No ZK proof is required —
 * the only cryptography is the Poseidon PCT of the (amount-in-cents) that
 * the contract uses to update the user's encrypted balance.
 */
export async function depositToEERC(inputs: DepositInputs): Promise<{ txHash: Hex; cents: bigint; dustWei: bigint }> {
  const { deployment, token, amountWei, userPublicKey, writeContract } = inputs;

  const { cents, dustWei } = computeDepositCents(amountWei, token.decimals, deployment.decimals);
  if (cents <= 0n) {
    throw new Error(
      `Amount too small — converting ${amountWei} (${token.decimals} decimals) to eERC's ${deployment.decimals}-decimal form gives 0 cents. Minimum is 10^${token.decimals - deployment.decimals} of the smallest unit.`,
    );
  }

  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);
  const poseidon = new Poseidon(field, curve);
  const { cipher, nonce, authKey } = await poseidon.processPoseidonEncryption({
    inputs: [cents],
    publicKey: userPublicKey,
  });

  // The contract expects a 7-element uint256[7] PCT array: [c0, c1, c2, c3, authKeyX, authKeyY, nonce].
  const pct: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    cipher[0]!,
    cipher[1]!,
    cipher[2]!,
    cipher[3]!,
    authKey[0],
    authKey[1],
    nonce,
  ];

  const txHash = await writeContract({
    address: deployment.encryptedERC,
    abi: EncryptedERCArtifact.abi,
    functionName: 'deposit',
    args: [amountWei, token.address, pct],
  });

  return { txHash, cents, dustWei };
}
