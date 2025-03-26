import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/server/services/login';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    await sendOTP(email);

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
