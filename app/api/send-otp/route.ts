import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/server/services/login';
import { rateLimit } from '@/lib/rateLimit';

function getClientIp(req: NextRequest): string {
  const headers = req.headers;
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIP = xForwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

  return 'unknown';
}

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    await sendOTP(email.toLowerCase());

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

// Per-IP: max 5 requests per 15 minutes
const ipLimited = rateLimit(handler, {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  identifier: async (req: NextRequest) => `otp:ip:${getClientIp(req)}`,
});

// Per-email: max 1 request per 60 seconds
export const POST = rateLimit(ipLimited, {
  windowMs: 60 * 1000,
  maxRequests: 1,
  identifier: async (req: NextRequest) => {
    const body = await req.clone().json();
    const email = body.email?.toLowerCase();
    if (!email) return `otp:email:unknown`;
    return `otp:email:${email}`;
  },
});
