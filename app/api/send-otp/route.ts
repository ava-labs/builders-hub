import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/server/services/login';
import { normalizeEmail } from '@/lib/utils';

export async function POST(request: NextRequest) {
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
    // with normalizeEmail — lowercase alone misses stray whitespace.
    await sendOTP(normalizeEmail(email));

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
