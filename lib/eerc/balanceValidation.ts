import { BabyJub, type BJPoint } from './crypto/babyjub';
import { FF } from './crypto/ff';
import { Poseidon } from './crypto';
import { Scalar } from './crypto/scalar';
import { SNARK_FIELD_SIZE } from './crypto/constants';
import type { EERCIdentitySecret } from './identity';

export type EERCPCT = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
export type RawEERCPoint = readonly [bigint, bigint];

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
