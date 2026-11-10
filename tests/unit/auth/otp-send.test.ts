import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { verificationTokens } from './fake-verification-tokens';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('@/prisma/prisma', async () => {
  const { verificationTokens } = await import('./fake-verification-tokens');
  return { prisma: verificationTokens.prisma };
});
vi.mock('@/server/services/mail', () => ({ sendMail }));

import { sendOTP } from '@/server/services/login';
import { POST } from '@/app/api/send-otp/route';

const EMAIL = 'builder@example.com';
const MINUTE = 60 * 1000;

const liveCodes = (email = EMAIL) => verificationTokens.rows.filter((row) => row.identifier === email);
const mailedCode = (call: number) => /code is: (\d{6})/.exec(sendMail.mock.calls[call][3])![1];

function post(body: string, contentType = 'application/json') {
  return POST(
    new NextRequest('https://build.avax.network/api/send-otp', {
      method: 'POST',
      body,
      headers: { 'content-type': contentType },
    }),
  );
}

beforeEach(() => {
  verificationTokens.reset();
  sendMail.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('OTP mail limits', () => {
  it('mails a new code', async () => {
    expect(await sendOTP(EMAIL)).toEqual({ status: 'sent' });
    expect(liveCodes()).toHaveLength(1);
    expect(mailedCode(0)).toBe(liveCodes()[0].token);
  });

  it('mails nothing for a second request within a minute', async () => {
    await sendOTP(EMAIL);
    vi.advanceTimersByTime(30 * 1000);

    expect(await sendOTP(EMAIL)).toEqual({ status: 'recent' });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('mails the same live code again after a minute, so the code being typed stays valid', async () => {
    await sendOTP(EMAIL);
    const first = liveCodes()[0].token;
    vi.advanceTimersByTime(MINUTE + 1000);

    expect(await sendOTP(EMAIL)).toEqual({ status: 'sent' });
    expect(liveCodes()).toEqual([{ identifier: EMAIL, token: first, expires: new Date(Date.now() + 3 * MINUTE) }]);
    expect(mailedCode(1)).toBe(first);
  });

  it('mails a new code once the old one has expired', async () => {
    await sendOTP(EMAIL);
    vi.advanceTimersByTime(3 * MINUTE + 1000);

    await sendOTP(EMAIL);
    expect(liveCodes()).toHaveLength(1);
    expect(liveCodes()[0].expires.getTime()).toBe(Date.now() + 3 * MINUTE);
    expect(mailedCode(1)).toBe(liveCodes()[0].token);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('mails an address at most five times in 15 minutes', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await sendOTP(EMAIL)).status).toBe('sent');
      vi.advanceTimersByTime(MINUTE + 1000);
    }

    const refused = await sendOTP(EMAIL);
    expect(refused.status).toBe('limited');
    expect(refused).toMatchObject({ retryAfterSeconds: expect.any(Number) });
    expect(sendMail).toHaveBeenCalledTimes(5);

    vi.advanceTimersByTime(15 * MINUTE);
    expect((await sendOTP(EMAIL)).status).toBe('sent');
  });

  it('puts no cap on many addresses from one client, as at a hackathon venue', async () => {
    for (let i = 0; i < 50; i++) {
      expect((await sendOTP(`builder${i}@example.com`)).status).toBe('sent');
    }
  });

  it('sweeps rows that expired over an hour ago', async () => {
    const old = { identifier: 'otp-send:gone@example.com', token: 'old', expires: new Date(Date.now() - 61 * MINUTE) };
    const recent = { identifier: 'otp-send:back@example.com', token: 'recent', expires: new Date(Date.now() - 30 * MINUTE) };
    verificationTokens.rows.push(old, recent);

    await sendOTP(EMAIL);
    expect(verificationTokens.rows).not.toContainEqual(old);
    expect(verificationTokens.rows).toContainEqual(recent);
  });

  it('mails once when requests for one address arrive in parallel', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => sendOTP(EMAIL)));

    expect(results.filter((r) => r.status === 'sent')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'recent')).toHaveLength(9);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('undoes a send that failed to mail: no code, no cooldown, no use of the cap', async () => {
    sendMail.mockRejectedValueOnce(new Error('SendGrid down'));
    await expect(sendOTP(EMAIL)).rejects.toThrow('SendGrid down');
    expect(verificationTokens.rows).toEqual([]);

    expect(await sendOTP(EMAIL)).toEqual({ status: 'sent' });
  });
});

describe('POST /api/send-otp', () => {
  it('refuses a body that is not JSON, as a cross-site form sends', async () => {
    const response = await post(JSON.stringify({ email: EMAIL }), 'text/plain');

    expect(response.status).toBe(415);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('answers 429 with Retry-After when the address is over its limit', async () => {
    for (let i = 0; i < 5; i++) {
      await sendOTP(EMAIL);
      vi.advanceTimersByTime(MINUTE + 1000);
    }

    const response = await post(JSON.stringify({ email: EMAIL }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await response.json()).error).toMatch(/^Too many codes requested\. Try again in \d+ minutes?\.$/);
  });
});
