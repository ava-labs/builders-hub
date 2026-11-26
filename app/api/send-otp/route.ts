import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/server/services/login';
import { normalizeEmail } from '@/lib/utils';
import { isValidEmail } from '@/lib/email';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/json-body';
import { clientBucket } from '@/lib/net/clientIp';
import { consumeQuota } from '@/lib/verification/limits';

// Codes one client address may ask for, over every email address. The count per email address is in sendOTP. The
// number is high enough for a room of people behind one address.
const SENDS_PER_CLIENT = { limit: 120, windowMs: 10 * 60 * 1000 };

// The address format check stays in the handler (isValidEmail).
const bodySchema = z.object({
  email: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // A cross-site form can post text/plain without a CORS preflight, and
  // request.json() parses it anyway. Requiring JSON forces the preflight.
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 }
    );
  }

  try {
    const body = await readJsonBody(request, bodySchema);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Must match the verify side (authOptions), which looks up the token
    // with normalizeEmail: lowercase alone misses stray whitespace.
    const normalizedEmail = normalizeEmail(email);

    // The address becomes the account's identity, and SendGrid reads a
    // name-and-address string such as 'a@b.example <c@d.example>' as a
    // display name plus the address in brackets. Without this check, a code
    // sent to an address the caller owns signs them in under another string.
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 }
      );
    }

    const client = await consumeQuota(`otp-send:${clientBucket(request)}`, SENDS_PER_CLIENT);
    if (!client.allowed) {
      return NextResponse.json(
        { error: 'Too many codes requested from this network. Try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(client.retryAfterSeconds) } }
      );
    }

    const result = await sendOTP(normalizedEmail);

    if (result.status === 'limited') {
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      return NextResponse.json(
        { error: `Too many codes requested. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
      );
    }

    return NextResponse.json(
      { message: 'OTP sent correctly' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Error sending verification code' },
      { status: 500 }
    );
  }
}
