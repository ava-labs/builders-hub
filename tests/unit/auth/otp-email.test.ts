import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { verificationTokens } from './fake-verification-tokens';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('@/prisma/prisma', async () => {
  const { verificationTokens } = await import('./fake-verification-tokens');
  return { prisma: verificationTokens.prisma };
});
vi.mock('@/server/services/mail', () => ({ sendMail }));

import { AuthOptions } from '@/lib/auth/authOptions';
import { POST } from '@/app/api/send-otp/route';

// Each string reads as a name plus a bracketed address to SendGrid, or as a
// list, so the code would go to attacker@evil.example while the session
// identity is the whole string.
const CRAFTED = [
  '<attacker@evil.example<@avalabs.org',
  'victim@corp.example <attacker@evil.example>',
  'victim@corp.example<attacker@evil.example>',
  'victim@corp.example (x) <attacker@evil.example>',
  'victim@corp.example, attacker@evil.example',
  '"staff"@avalabs.org',
  'staff @avalabs.org',
];

function post(email: string) {
  return POST(
    new NextRequest('https://build.avax.network/api/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const authorize = (credentials: Record<string, unknown>) => {
  const provider = AuthOptions.providers.find((p) => p.id === 'credentials') as unknown as {
    options: { authorize: (c: Record<string, unknown>) => Promise<unknown> };
  };
  return provider.options.authorize(credentials);
};

beforeEach(() => {
  verificationTokens.reset();
  sendMail.mockReset();
});

describe('OTP sign-in accepts only a plain email address', () => {
  it.each(CRAFTED)('send-otp refuses %j and mails nothing', async (email) => {
    const response = await post(email);

    expect(response.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
    expect(verificationTokens.rows).toEqual([]);
  });

  it('send-otp still mails a normal address, after normalizing it', async () => {
    const response = await post('  Builder@Example.com ');

    expect(response.status).toBe(200);
    expect(sendMail.mock.calls[0][0]).toBe('builder@example.com');
  });

  it.each(CRAFTED)('sign-in refuses %j even with a live code for it', async (email) => {
    // A code mailed before send-otp checked the address.
    verificationTokens.rows.push({
      identifier: email.toLowerCase().trim(),
      token: '424242',
      expires: new Date(Date.now() + 60 * 1000),
    });

    await expect(authorize({ email, otp: '424242' })).rejects.toThrow('INVALID');
  });
});
