import { describe, expect, it } from 'vitest';
import { parseEERCRequest } from '@/lib/eerc/client';

describe('parseEERCRequest', () => {
  const token = '0x0000000000000000000000000000000000000001';

  it('accepts the operations an app may ask for', () => {
    expect(parseEERCRequest({ op: 'transfer', token, to: token, amount: '1000' })).toEqual({
      op: 'transfer',
      token,
      to: token,
      amount: '1000',
      erc20: undefined,
    });
    expect(parseEERCRequest({ op: 'register', token })).toEqual({ op: 'register', token });
  });

  it("never lets a frame name a Registrar, so a registration is always the app's own token's", () => {
    expect(parseEERCRequest({ op: 'register', token, registrar: token })).toEqual({ op: 'register', token });
  });

  it('refuses unknown operations and malformed fields', () => {
    expect(() => parseEERCRequest({ op: 'revealKey', token })).toThrow(/Unsupported/);
    expect(() => parseEERCRequest({ op: 'transfer', token, to: token })).toThrow(/amount/);
    expect(() => parseEERCRequest({ op: 'balance', token: { x: 1 } })).toThrow(/token/);
    expect(() => parseEERCRequest(null)).toThrow(/Unsupported/);
  });
});
