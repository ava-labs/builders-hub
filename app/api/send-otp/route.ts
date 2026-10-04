import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/server/services/login';
import { normalizeEmail } from '@/lib/utils';

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
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Must match the verify side (authOptions), which looks up the token
    // with normalizeEmail: lowercase alone misses stray whitespace.
    const result = await sendOTP(normalizeEmail(email));

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
