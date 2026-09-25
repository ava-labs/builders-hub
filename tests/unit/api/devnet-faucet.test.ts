import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/authSession', () => ({
  getAuthSession: vi.fn(),
}));

vi.mock('@/lib/faucet/coupon', () => ({
  findValidCoupon: vi.fn(),
}));

vi.mock('@/lib/faucet/rateLimit', () => ({
  checkAndReserveFaucetClaim: vi.fn(),
  completeFaucetClaim: vi.fn(),
  cancelFaucetClaim: vi.fn(),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createWalletClient: vi.fn().mockReturnValue({
      sendTransaction: vi.fn().mockResolvedValue('0x-test-tx-hash'),
    }),
    createPublicClient: vi.fn().mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(BigInt(10 * 10 ** 18)),
      getTransactionCount: vi.fn().mockResolvedValue(1),
    }),
    http: vi.fn(),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({ address: '0x1234567890123456789012345678901234567890' }),
}));

describe('GET /api/devnet-faucet', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FAUCET_C_CHAIN_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.FAUCET_C_CHAIN_ADDRESS = '0x1234567890123456789012345678901234567890';
  });

  function createMockRequest(url: string) {
    return new NextRequest(new URL(url, 'http://localhost'));
  }

  it('should return 401 if not authenticated', async () => {
    const { GET } = await import('@/app/api/devnet-faucet/route');
    const { getAuthSession } = await import('@/lib/auth/authSession');
    
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const req = createMockRequest('http://localhost/api/devnet-faucet?address=0xabcd1234abcd1234abcd1234abcd1234abcd1234');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return 400 if address is missing', async () => {
    const { GET } = await import('@/app/api/devnet-faucet/route');
    const { getAuthSession } = await import('@/lib/auth/authSession');

    vi.mocked(getAuthSession).mockResolvedValue({
      user: { id: 'ava-user', email: 'test@avalabs.org' }
    } as any);
    const req = createMockRequest('http://localhost/api/devnet-faucet');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 200 and tx hash on success for AvaLabs user', async () => {
    const { GET } = await import('@/app/api/devnet-faucet/route');
    const { getAuthSession } = await import('@/lib/auth/authSession');

    vi.mocked(getAuthSession).mockResolvedValue({
      user: { id: 'ava-user', email: 'test@avalabs.org' }
    } as any);
    
    const req = createMockRequest('http://localhost/api/devnet-faucet?address=0xabcd1234abcd1234abcd1234abcd1234abcd1234');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.txHash).toBe('0x-test-tx-hash');
  });

  it('should return 403 if non-AvaLabs user has invalid coupon', async () => {
    const { GET } = await import('@/app/api/devnet-faucet/route');
    const { getAuthSession } = await import('@/lib/auth/authSession');
    const { findValidCoupon } = await import('@/lib/faucet/coupon');

    vi.mocked(getAuthSession).mockResolvedValue({
      user: { id: 'other-user', email: 'test@example.com' }
    } as any);
    vi.mocked(findValidCoupon).mockResolvedValue({ valid: false, reason: 'Invalid coupon' });

    const req = createMockRequest('http://localhost/api/devnet-faucet?address=0xabcd1234abcd1234abcd1234abcd1234abcd1234&coupon=bad-coupon');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
