import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import { mockAuthSession, resetAuthMocks } from '@/tests/api/helpers/mock-session';

vi.mock('@/lib/auth/authSession');

vi.mock('@/server/services/login', () => ({
  sendOTP: vi.fn().mockResolvedValue(undefined),
}));

// Mock the rate-limit module used by withApi
const mockCheckPrismaRateLimit = vi.fn();
const mockGetRateLimitIdentifier = vi.fn();
vi.mock('@/lib/api/rate-limit', () => ({
  checkPrismaRateLimit: (...args: unknown[]) => mockCheckPrismaRateLimit(...args),
  getRateLimitIdentifier: (...args: unknown[]) => mockGetRateLimitIdentifier(...args),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('POST /api/send-otp', () => {
  beforeEach(() => {
    mockAuthSession(null);
    mockGetRateLimitIdentifier.mockReturnValue('127.0.0.1');
    // Default: under the rate limit
    mockCheckPrismaRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: new Date(Date.now() + 3_600_000),
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '4',
        'X-RateLimit-Reset': String(Math.floor((Date.now() + 3_600_000) / 1000)),
      },
    });
  });

  afterEach(() => {
    resetAuthMocks();
  });

  it('sends OTP for a valid email', async () => {
    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: { email: 'dev@example.com' },
      url: 'http://localhost:3000/api/send-otp',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.message).toBe('OTP sent correctly');
  });

  it('lowercases the email before sending', async () => {
    const { sendOTP } = await import('@/server/services/login');
    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: { email: 'DEV@Example.COM' },
      url: 'http://localhost:3000/api/send-otp',
    });

    await callHandler(POST, req);
    expect(sendOTP).toHaveBeenCalledWith('dev@example.com');
  });

  it('rejects missing email', async () => {
    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: {},
      url: 'http://localhost:3000/api/send-otp',
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects invalid email format', async () => {
    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: { email: 'not-an-email' },
      url: 'http://localhost:3000/api/send-otp',
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects invalid JSON body', async () => {
    const { POST } = await import('@/app/api/send-otp/route');
    const req = new (await import('next/server')).NextRequest(
      'http://localhost:3000/api/send-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      },
    );

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('enforces rate limiting (5 per hour per IP)', async () => {
    const resetAt = new Date(Date.now() + 3_600_000);
    mockCheckPrismaRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt,
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(resetAt.getTime() / 1000)),
      },
    });

    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: { email: 'dev@example.com' },
      url: 'http://localhost:3000/api/send-otp',
    });

    const result = await callHandler(POST, req);
    expectError(result, 429, 'RATE_LIMITED');
  });

  it('includes rate limit headers on success', async () => {
    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: { email: 'dev@example.com' },
      url: 'http://localhost:3000/api/send-otp',
    });

    const result = await callHandler(POST, req);
    expect(result.status).toBe(200);
    expect(result.headers.get('x-ratelimit-limit')).toBe('5');
  });

  it('returns 500 envelope when sendOTP throws', async () => {
    const { sendOTP } = await import('@/server/services/login');
    (sendOTP as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('SMTP down'),
    );

    const { POST } = await import('@/app/api/send-otp/route');
    const req = createMockRequest('POST', {
      body: { email: 'dev@example.com' },
      url: 'http://localhost:3000/api/send-otp',
    });

    const result = await callHandler(POST, req);
    expectError(result, 500, 'INTERNAL_ERROR');
    // Must NOT leak stack trace
    expect(result.body.error.message).not.toContain('SMTP');
  });
});
