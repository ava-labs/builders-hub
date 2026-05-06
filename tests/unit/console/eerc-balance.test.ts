import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EERC_BALANCE_PROOF_MISMATCH_MESSAGE,
  EERC_BALANCE_UNINITIALIZED_MESSAGE,
  EERC_AMOUNT_OUT_OF_RANGE_MESSAGE,
  EERC_PRIVATE_KEY_INVALID_MESSAGE,
  assertEERCBalanceWitnessMatchesPlaintext,
  isEERCBalanceProofAssertion,
  normalizeEERCBalanceProofError,
  validateEERCBalance,
  type EERCPCT,
  type RawEERCBalance,
  type RawEERCAmountPCT,
} from '@/lib/eerc/balanceValidation';
import { SUB_GROUP_ORDER } from '@/lib/eerc/crypto/constants';
import { BabyJub, type BJPoint } from '@/lib/eerc/crypto/babyjub';
import { FF } from '@/lib/eerc/crypto/ff';
import { Poseidon } from '@/lib/eerc/crypto';
import { SNARK_FIELD_SIZE } from '@/lib/eerc/crypto/constants';
import { expandIdentity, type EERCIdentitySecret } from '@/lib/eerc/identity';
import { EERC_IDENTITY_MISMATCH_MESSAGE, assertEERCIdentityMatchesOnChain } from '@/lib/eerc/identityValidation';

const ZERO_PCT: EERCPCT = [0n, 0n, 0n, 0n, 0n, 0n, 0n];
const ZERO_EGCT: RawEERCBalance['eGCT'] = {
  c1: [0n, 0n],
  c2: [0n, 0n],
};

function makeIdentity(seed: string): EERCIdentitySecret {
  return expandIdentity(seed.padStart(64, '0'));
}

function cryptoSuite() {
  const field = new FF(SNARK_FIELD_SIZE);
  const curve = new BabyJub(field);
  return { curve, poseidon: new Poseidon(field, curve) };
}

async function encryptPCT(identity: EERCIdentitySecret, amount: bigint): Promise<EERCPCT> {
  const { poseidon } = cryptoSuite();
  const encrypted = await poseidon.processPoseidonEncryption({
    inputs: [amount],
    publicKey: identity.publicKey,
  });
  return [
    encrypted.cipher[0]!,
    encrypted.cipher[1]!,
    encrypted.cipher[2]!,
    encrypted.cipher[3]!,
    encrypted.authKey[0],
    encrypted.authKey[1],
    encrypted.nonce,
  ];
}

async function encryptEGCT(publicKey: BJPoint, amount: bigint): Promise<RawEERCBalance['eGCT']> {
  const { curve } = cryptoSuite();
  const { cipher } = await curve.encryptMessage(publicKey, amount);
  return {
    c1: cipher.c1,
    c2: cipher.c2,
  };
}

function makeBalance({
  eGCT,
  balancePCT = ZERO_PCT,
  amountPCTs = [],
}: {
  eGCT: RawEERCBalance['eGCT'];
  balancePCT?: EERCPCT;
  amountPCTs?: readonly RawEERCAmountPCT[];
}): RawEERCBalance {
  return {
    eGCT,
    nonce: 0n,
    amountPCTs,
    balancePCT,
    transactionIndex: 0n,
  };
}

describe('validateEERCBalance', () => {
  beforeEach(() => {
    let nextRandom = 1000n;
    vi.spyOn(BabyJub, 'generateRandomValue').mockImplementation(async () => nextRandom++);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid deposit-only balance where amountPCTs match EGCT', async () => {
    const identity = makeIdentity('1');
    const raw = makeBalance({
      eGCT: await encryptEGCT(identity.publicKey, 200n),
      amountPCTs: [{ pct: await encryptPCT(identity, 200n), index: 0n }],
    });

    expect(validateEERCBalance(raw, identity)).toEqual({ ok: true, decryptedCents: 200n });
  });

  it('accepts balancePCT plus current amountPCTs after an outgoing operation', async () => {
    const identity = makeIdentity('2');
    const raw = makeBalance({
      eGCT: await encryptEGCT(identity.publicKey, 200n),
      balancePCT: await encryptPCT(identity, 125n),
      amountPCTs: [{ pct: await encryptPCT(identity, 75n), index: 1n }],
    });

    expect(validateEERCBalance(raw, identity)).toEqual({ ok: true, decryptedCents: 200n });
  });

  it('rejects PCT history that decrypts to 2.00 when EGCT belongs to another key', async () => {
    const identity = makeIdentity('3');
    const wrongIdentity = makeIdentity('4');
    const result = validateEERCBalance(
      makeBalance({
        eGCT: await encryptEGCT(wrongIdentity.publicKey, 200n),
        amountPCTs: [{ pct: await encryptPCT(identity, 200n), index: 0n }],
      }),
      identity,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('egct-mismatch');
      expect(result.decryptedCents).toBe(200n);
    }
  });

  it('accepts a fresh zero balance with an all-zero EGCT', () => {
    const identity = makeIdentity('5');

    expect(validateEERCBalance(makeBalance({ eGCT: ZERO_EGCT }), identity)).toEqual({
      ok: true,
      decryptedCents: 0n,
    });
  });
});

describe('assertEERCBalanceWitnessMatchesPlaintext', () => {
  beforeEach(() => {
    let nextRandom = 2000n;
    vi.spyOn(BabyJub, 'generateRandomValue').mockImplementation(async () => nextRandom++);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts the exact encrypted balance and plaintext used by the proof input', async () => {
    const identity = makeIdentity('8');
    const eGCT = await encryptEGCT(identity.publicKey, 100n);

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [eGCT.c1[0], eGCT.c1[1], eGCT.c2[0], eGCT.c2[1]],
        privateKey: identity.formattedKey,
        plaintextBalance: 100n,
      }),
    ).not.toThrow();
  });

  it('rejects the exact proof input when the plaintext does not match the EGCT', async () => {
    const identity = makeIdentity('9');
    const eGCT = await encryptEGCT(identity.publicKey, 100n);

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [eGCT.c1[0], eGCT.c1[1], eGCT.c2[0], eGCT.c2[1]],
        privateKey: identity.formattedKey,
        plaintextBalance: 200n,
      }),
    ).toThrow(EERC_BALANCE_PROOF_MISMATCH_MESSAGE);
  });

  it('normalizes withdraw CheckValue assertion errors into the balance recovery message', () => {
    const err = new Error(
      'Error: Assert Failed. Error in template CheckValue_23 line: 258 Error in template WithdrawCircuit_99 line: 55',
    );

    expect(normalizeEERCBalanceProofError(err).message).toBe(EERC_BALANCE_PROOF_MISMATCH_MESSAGE);
  });

  it('rejects (0,0) sentinel c1 (uninitialized contract balance)', async () => {
    const identity = makeIdentity('a');

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [0n, 0n, 0n, 0n],
        privateKey: identity.formattedKey,
        plaintextBalance: 0n,
      }),
    ).toThrow(EERC_BALANCE_UNINITIALIZED_MESSAGE);
  });

  it('rejects off-curve c1 / c2 with the proof-mismatch message', async () => {
    const identity = makeIdentity('b');
    const eGCT = await encryptEGCT(identity.publicKey, 100n);

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [123n, 456n, eGCT.c2[0], eGCT.c2[1]],
        privateKey: identity.formattedKey,
        plaintextBalance: 100n,
      }),
    ).toThrow(EERC_BALANCE_PROOF_MISMATCH_MESSAGE);
  });

  it('rejects values >= subgroup order before invoking the prover', async () => {
    const identity = makeIdentity('c');
    const eGCT = await encryptEGCT(identity.publicKey, 100n);

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [eGCT.c1[0], eGCT.c1[1], eGCT.c2[0], eGCT.c2[1]],
        privateKey: identity.formattedKey,
        plaintextBalance: SUB_GROUP_ORDER,
      }),
    ).toThrow(EERC_AMOUNT_OUT_OF_RANGE_MESSAGE);
  });

  it('rejects a public key that does not pair with the private key', async () => {
    const identity = makeIdentity('d');
    const wrong = makeIdentity('e');
    const eGCT = await encryptEGCT(identity.publicKey, 100n);

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [eGCT.c1[0], eGCT.c1[1], eGCT.c2[0], eGCT.c2[1]],
        privateKey: identity.formattedKey,
        plaintextBalance: 100n,
        publicKey: [wrong.publicKey[0], wrong.publicKey[1]],
      }),
    ).toThrow(EERC_PRIVATE_KEY_INVALID_MESSAGE);
  });

  it('rejects a zero private key', async () => {
    const identity = makeIdentity('f');
    const eGCT = await encryptEGCT(identity.publicKey, 100n);

    expect(() =>
      assertEERCBalanceWitnessMatchesPlaintext({
        encryptedBalance: [eGCT.c1[0], eGCT.c1[1], eGCT.c2[0], eGCT.c2[1]],
        privateKey: 0n,
        plaintextBalance: 100n,
      }),
    ).toThrow(EERC_PRIVATE_KEY_INVALID_MESSAGE);
  });
});

describe('isEERCBalanceProofAssertion', () => {
  it('matches every spending circuit + sub-template combination', () => {
    const cases = [
      'Assert Failed. Error in template CheckValue_23 line: 258\nError in template WithdrawCircuit_99 line: 55',
      'Assert Failed. Error in template CheckValue_77 line: 258\nError in template TransferCircuit_120 line: 99',
      'Assert Failed. Error in template CheckPCT_98 line: 356\nError in template WithdrawCircuit_99 line: 66',
      'Assert Failed. Error in template BabyCheck_4 line: 82\nError in template CheckValue_23 line: 228\nError in template WithdrawCircuit_99 line: 55',
      'Assert Failed. Error in template CheckPublicKey_5 line: 217\nError in template BurnCircuit_50 line: 30',
    ];
    for (const msg of cases) {
      expect(isEERCBalanceProofAssertion(new Error(msg))).toBe(true);
    }
  });

  it('does not match unrelated errors', () => {
    expect(isEERCBalanceProofAssertion(new Error('Network error: fetch failed'))).toBe(false);
    expect(isEERCBalanceProofAssertion(new Error('Assert Failed. Some random circuit'))).toBe(false);
  });
});

describe('assertEERCIdentityMatchesOnChain', () => {
  it('rejects a cached identity whose public key differs from Registrar', () => {
    const identity = makeIdentity('6');
    const otherIdentity = makeIdentity('7');

    expect(() => assertEERCIdentityMatchesOnChain(identity, otherIdentity.publicKey)).toThrow(
      EERC_IDENTITY_MISMATCH_MESSAGE,
    );
  });
});
