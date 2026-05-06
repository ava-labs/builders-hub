import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  validateEERCBalance,
  type EERCPCT,
  type RawEERCBalance,
  type RawEERCAmountPCT,
} from '@/lib/eerc/balanceValidation';
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

describe('assertEERCIdentityMatchesOnChain', () => {
  it('rejects a cached identity whose public key differs from Registrar', () => {
    const identity = makeIdentity('6');
    const otherIdentity = makeIdentity('7');

    expect(() => assertEERCIdentityMatchesOnChain(identity, otherIdentity.publicKey)).toThrow(
      EERC_IDENTITY_MISMATCH_MESSAGE,
    );
  });
});
