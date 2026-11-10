import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verificationTokens } from './fake-verification-tokens';

vi.mock('@/prisma/prisma', async () => {
  const { verificationTokens } = await import('./fake-verification-tokens');
  return { prisma: verificationTokens.prisma };
});

import { AuthOptions, verifyOTP } from '@/lib/auth/authOptions';

const EMAIL = 'builder@example.com';
const MINUTE = 60 * 1000;

function seedCode(token: string, email = EMAIL) {
  verificationTokens.rows.push({ identifier: email, token, expires: new Date(Date.now() + 3 * MINUTE) });
}

function liveCodes(email = EMAIL) {
  return verificationTokens.rows.filter((row) => row.identifier === email);
}

async function guessWrong(times: number) {
  for (let i = 0; i < times; i++) await verifyOTP(EMAIL, String(100000 + i));
}

const authorize = (credentials: Record<string, unknown>) => {
  const provider = AuthOptions.providers.find((p) => p.id === 'credentials') as unknown as {
    options: { authorize: (c: Record<string, unknown>) => Promise<unknown> };
  };
  return provider.options.authorize(credentials);
};

beforeEach(() => {
  verificationTokens.reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('email OTP attempt limit', () => {
  it('accepts the live code and clears earlier failures', async () => {
    seedCode('424242');
    await guessWrong(2);

    expect(await verifyOTP(EMAIL, '424242')).toEqual({ isValid: true });
    expect(verificationTokens.rows).toEqual([]);
  });

  it('refuses even the right code after five wrong codes in 15 minutes, and burns it', async () => {
    seedCode('424242');
    await guessWrong(5);

    expect(await verifyOTP(EMAIL, '424242')).toEqual({ isValid: false, reason: 'TOO_MANY_ATTEMPTS' });
    expect(liveCodes()).toEqual([]);
  });

  it('keeps counting when a new code is sent', async () => {
    seedCode('111111');
    await guessWrong(5);
    verificationTokens.rows.splice(verificationTokens.rows.findIndex((row) => row.identifier === EMAIL), 1);
    seedCode('424242');

    expect((await verifyOTP(EMAIL, '424242')).reason).toBe('TOO_MANY_ATTEMPTS');
  });

  it('allows five more tries after 15 minutes, and at most 20 a day', async () => {
    for (let window = 0; window < 4; window++) {
      seedCode(`11111${window}`);
      await guessWrong(5);
      vi.advanceTimersByTime(15 * MINUTE + 1000);
    }
    seedCode('424242');
    expect((await verifyOTP(EMAIL, '424242')).reason).toBe('TOO_MANY_ATTEMPTS');

    vi.advanceTimersByTime(24 * 60 * MINUTE);
    seedCode('424243');
    expect(await verifyOTP(EMAIL, '424243')).toEqual({ isValid: true });
  });

  it('does not count guesses while no code is live, so they cannot lock the owner out', async () => {
    await guessWrong(20);
    seedCode('424242');

    expect(await verifyOTP(EMAIL, '424242')).toEqual({ isValid: true });
  });

  it('checks at most five guesses when they arrive in parallel', async () => {
    seedCode('424242');
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => verifyOTP(EMAIL, String(200000 + i))),
    );
    const checked = results.filter((r) => r.reason === 'NOT_FOUND').length;
    const failures = verificationTokens.rows.filter((row) => row.identifier === `otp-attempt:${EMAIL}`).length;

    expect(checked).toBeGreaterThan(0);
    expect(checked).toBeLessThanOrEqual(5);
    expect(failures).toBe(checked);
    expect(results.every((r) => ['NOT_FOUND', 'BUSY', 'TOO_MANY_ATTEMPTS'].includes(r.reason!))).toBe(true);
  });

  it('keeps database error text out of the sign-in error', async () => {
    const lookup = vi
      .spyOn(verificationTokens.prisma.verificationToken, 'findFirst')
      .mockRejectedValueOnce(new Error('Invalid prisma.verificationToken.findFirst() at /var/task/.next/server/chunks/1.js'));
    seedCode('424242');

    await expect(authorize({ email: EMAIL, otp: '424242' })).rejects.toThrow(/^Error verifying OTP Code$/);
    lookup.mockRestore();
  });

  it('keeps one email’s failures away from another email', async () => {
    seedCode('424242', 'other@example.com');
    await guessWrong(5);

    expect(await verifyOTP('other@example.com', '424242')).toEqual({ isValid: true });
  });

  it.each([{ not: 'x' }, { gte: '0' }, '12345', '1234567', 'abcdef', ['424242']])(
    'refuses the OTP value %j before any lookup',
    async (otp) => {
      seedCode('424242');
      const lookup = vi.spyOn(verificationTokens.prisma.verificationToken, 'findFirst');

      await expect(authorize({ email: EMAIL, otp })).rejects.toThrow('INVALID');
      expect(lookup).not.toHaveBeenCalled();
      expect(verificationTokens.rows).toHaveLength(1);
      lookup.mockRestore();
    },
  );
});
