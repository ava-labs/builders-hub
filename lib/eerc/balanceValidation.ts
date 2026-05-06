import { BabyJub, type BJPoint } from './crypto/babyjub';
import { FF } from './crypto/ff';
import { Poseidon } from './crypto';
import { Scalar } from './crypto/scalar';
import { SNARK_FIELD_SIZE, SUB_GROUP_ORDER } from './crypto/constants';
import type { EERCIdentitySecret } from './identity';

export type EERCPCT = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
export type RawEERCPoint = readonly [bigint, bigint];
export type FlatEERCEncryptedBalance = readonly [bigint, bigint, bigint, bigint];

export interface RawEERCAmountPCT {
  pct: EERCPCT;
  index: bigint;
}

export interface RawEERCBalance {
  eGCT: {
    c1: RawEERCPoint;
    c2: RawEERCPoint;
  };
  nonce: bigint;
  amountPCTs: readonly RawEERCAmountPCT[];
  balancePCT: EERCPCT;
  transactionIndex: bigint;
}

export const EERC_BALANCE_PCT_DECRYPTION_MESSAGE =
  'Your cached BabyJubJub key cannot decrypt the encrypted balance history. Open Register, clear the local key, and re-derive it before depositing, transferring, or withdrawing.';

export const EERC_BALANCE_EGCT_MISMATCH_MESSAGE =
  'Encrypted balance verification failed: the decrypted history does not match the on-chain EGCT for your local BabyJubJub key. Open Register, clear/re-derive the local key, then refresh. If this balance was created with a different key, you need that key to spend it.';

export const EERC_BALANCE_PROOF_MISMATCH_MESSAGE =
  'Encrypted balance proof blocked: the local BabyJubJub key cannot prove the on-chain encrypted balance. Refresh Balance, then open Register to clear/re-derive the local key. If this balance was created with a different key, that key is required to withdraw or transfer.';

export const EERC_BALANCE_UNINITIALIZED_MESSAGE =
  'Encrypted balance is uninitialized on-chain — Deposit at least once before withdrawing or transferring.';

export const EERC_AMOUNT_OUT_OF_RANGE_MESSAGE =
  'Amount is outside the BabyJubJub subgroup order. Use a smaller amount.';

export const EERC_PRIVATE_KEY_INVALID_MESSAGE =
  'Local BabyJubJub private key is invalid (zero or out of subgroup range). Open Register and re-derive the local key.';

export type EERCBalanceValidationResult =
  | {
      ok: true;
      decryptedCents: bigint;
    }
  | {
      ok: false;
      decryptedCents: bigint | null;
      reason: 'pct-decryption-failed' | 'egct-mismatch';
      message: string;
    };

export function validateEERCBalance(
  raw: Pick<RawEERCBalance, 'eGCT' | 'amountPCTs' | 'balancePCT'>,
  identity: EERCIdentitySecret,
): EERCBalanceValidationResult {
  let total = 0n;

  if (!isZeroPCT(raw.balancePCT)) {
    const decrypted = decryptPCT(identity, raw.balancePCT);
    if (decrypted === null) {
      return {
        ok: false,
        decryptedCents: null,
        reason: 'pct-decryption-failed',
        message: EERC_BALANCE_PCT_DECRYPTION_MESSAGE,
      };
    }
    total += decrypted;
  }

  for (const amountPCT of raw.amountPCTs) {
    const decrypted = decryptPCT(identity, amountPCT.pct);
    if (decrypted === null) {
      return {
        ok: false,
        decryptedCents: null,
        reason: 'pct-decryption-failed',
        message: EERC_BALANCE_PCT_DECRYPTION_MESSAGE,
      };
    }
    total += decrypted;
  }

  if (!egctMatchesTotal(raw.eGCT, identity.formattedKey, total)) {
    const formatted = Scalar.parseEERCBalance(total);
    return {
      ok: false,
      decryptedCents: total,
      reason: 'egct-mismatch',
      message: `${EERC_BALANCE_EGCT_MISMATCH_MESSAGE} Local history decrypted to ${formatted} eERC, but the prover would reject the raw EGCT.`,
    };
  }

  return { ok: true, decryptedCents: total };
}

export function encryptedBalanceMatchesPlaintext({
  encryptedBalance,
  privateKey,
  plaintextBalance,
}: {
  encryptedBalance: FlatEERCEncryptedBalance;
  privateKey: bigint;
  plaintextBalance: bigint;
}): boolean {
  return egctMatchesTotal(
    {
      c1: [encryptedBalance[0], encryptedBalance[1]],
      c2: [encryptedBalance[2], encryptedBalance[3]],
    },
    privateKey,
    plaintextBalance,
  );
}

/**
 * Run every TS-side check the withdraw/transfer circuit will run on the
 * sender's encrypted balance witness.
 *
 * The circuit verifies (in order):
 *   1. CheckPublicKey: privKey != 0, privKey < subgroup order, and privKey * Base8 == pubKey.
 *   2. CheckValue: c1 and c2 are on the BabyJubJub curve (BabyCheck).
 *   3. CheckValue: value < subgroup order (and value < 2^252 via Num2Bits(252)).
 *   4. CheckValue: ElGamalDecrypt(c1, c2, privKey) == BabyPbk(value).
 *
 * Throwing here gives the user a friendly, actionable message **before** we
 * spin up the multi-second snarkjs proof and expose the raw circom assert.
 */
export function assertEERCBalanceWitnessMatchesPlaintext(args: {
  encryptedBalance: FlatEERCEncryptedBalance;
  privateKey: bigint;
  plaintextBalance: bigint;
  publicKey?: RawEERCPoint;
}): void {
  const { encryptedBalance, privateKey, plaintextBalance, publicKey } = args;

  if (privateKey <= 0n || privateKey >= SUB_GROUP_ORDER) {
    throw new Error(EERC_PRIVATE_KEY_INVALID_MESSAGE);
  }

  if (plaintextBalance < 0n || plaintextBalance >= SUB_GROUP_ORDER) {
    throw new Error(EERC_AMOUNT_OUT_OF_RANGE_MESSAGE);
  }

  const c1: RawEERCPoint = [encryptedBalance[0], encryptedBalance[1]];
  const c2: RawEERCPoint = [encryptedBalance[2], encryptedBalance[3]];

  if (isZeroSentinelPoint(c1) || isZeroSentinelPoint(c2)) {
    throw new Error(EERC_BALANCE_UNINITIALIZED_MESSAGE);
  }

  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);

  if (!curve.inCurve([c1[0], c1[1]]) || !curve.inCurve([c2[0], c2[1]])) {
    throw new Error(EERC_BALANCE_PROOF_MISMATCH_MESSAGE);
  }

  if (publicKey) {
    if (!curve.inCurve([publicKey[0], publicKey[1]])) {
      throw new Error(EERC_PRIVATE_KEY_INVALID_MESSAGE);
    }
    const derived = curve.generatePublicKey(privateKey);
    if (derived[0] !== publicKey[0] || derived[1] !== publicKey[1]) {
      throw new Error(EERC_PRIVATE_KEY_INVALID_MESSAGE);
    }
  }

  if (!encryptedBalanceMatchesPlaintext({ encryptedBalance, privateKey, plaintextBalance })) {
    throw new Error(EERC_BALANCE_PROOF_MISMATCH_MESSAGE);
  }
}

export function normalizeEERCBalanceProofError(err: unknown): Error {
  if (isEERCBalanceProofAssertion(err)) {
    return new Error(EERC_BALANCE_PROOF_MISMATCH_MESSAGE);
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Match the noisy "Assert Failed. Error in template ..." that
 * snarkjs/circom_runtime throws when ANY witness constraint trips inside the
 * eERC circuits. We deliberately accept all four spending circuits
 * (Withdraw/Transfer/Burn/Mint) and the curve/value/PCT/auditor sub-templates
 * so we don't leak `CheckValue_23 line: 258` to end users — the user-facing
 * message is the same root-cause story regardless of which sub-assertion
 * tripped (their local key cannot prove the on-chain balance).
 */
export function isEERCBalanceProofAssertion(err: unknown): boolean {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  if (!/Assert Failed/i.test(message)) return false;
  const subAssert = /(CheckValue|CheckPublicKey|CheckPCT|CheckReceiverValue|CheckAuditorValue|BabyCheck)/i.test(message);
  const circuit = /(WithdrawCircuit|TransferCircuit|BurnCircuit|MintCircuit)/i.test(message);
  return subAssert && circuit;
}

function decryptPCT(identity: EERCIdentitySecret, pct: EERCPCT): bigint | null {
  try {
    return Poseidon.decryptAmountPCT(identity.decryptionKey, pct.map((x) => x.toString()));
  } catch {
    return null;
  }
}

function egctMatchesTotal(
  eGCT: RawEERCBalance['eGCT'],
  privateKey: bigint,
  totalBalance: bigint,
): boolean {
  if (totalBalance === 0n && isZeroEGCT(eGCT)) return true;

  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);

  let decryptedEGCT: BJPoint;
  try {
    decryptedEGCT = curve.elGamalDecryption(privateKey, {
      c1: [eGCT.c1[0], eGCT.c1[1]],
      c2: [eGCT.c2[0], eGCT.c2[1]],
    });
  } catch {
    return false;
  }

  const expectedPoint = curve.mulWithScalar(curve.Base8, totalBalance);
  return decryptedEGCT[0] === expectedPoint[0] && decryptedEGCT[1] === expectedPoint[1];
}

function isZeroPCT(pct: EERCPCT): boolean {
  return pct.every((x) => x === 0n);
}

function isZeroEGCT(eGCT: RawEERCBalance['eGCT']): boolean {
  return eGCT.c1[0] === 0n && eGCT.c1[1] === 0n && eGCT.c2[0] === 0n && eGCT.c2[1] === 0n;
}

/**
 * The contract uses `(0, 0)` as a sentinel for an uninitialized balance —
 * that point is **off the BabyJubJub curve**, so the circuit's `BabyCheck`
 * will refuse it. Spending a fresh-state balance with no deposits is the
 * canonical way users hit the raw `Error in template BabyCheck` assertion.
 */
function isZeroSentinelPoint(p: RawEERCPoint): boolean {
  return p[0] === 0n && p[1] === 0n;
}
