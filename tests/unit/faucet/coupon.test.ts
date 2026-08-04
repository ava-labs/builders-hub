import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock('@/prisma/prisma', () => ({
  prisma: { faucetCoupon: { findUnique: findUniqueMock } },
}));

import { findValidCoupon } from '@/lib/faucet/coupon';

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe('findValidCoupon', () => {
  it('requires a non-empty code and does not hit the database', async () => {
    const result = await findValidCoupon('   ');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/required/i);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('trims the code before lookup', async () => {
    findUniqueMock.mockResolvedValue(null);
    await findValidCoupon('  HELICON-DEVNET  ');
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { code: 'HELICON-DEVNET' } });
  });

  it('rejects an unknown code', async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await findValidCoupon('NOPE');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/invalid/i);
  });

  it('rejects an inactive (disabled) coupon', async () => {
    findUniqueMock.mockResolvedValue({ id: 'c1', code: 'X', active: false, expires_at: null });
    const result = await findValidCoupon('X');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/invalid/i);
  });

  it('rejects an expired coupon', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'c1',
      code: 'X',
      active: true,
      expires_at: new Date(Date.now() - 60_000),
    });
    const result = await findValidCoupon('X');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/expired/i);
  });

  it('accepts an active coupon with no expiry', async () => {
    findUniqueMock.mockResolvedValue({ id: 'c1', code: 'X', active: true, expires_at: null });
    const result = await findValidCoupon('X');
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.couponId).toBe('c1');
  });

  it('accepts an active coupon that expires in the future', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'c2',
      code: 'Y',
      active: true,
      expires_at: new Date(Date.now() + 3_600_000),
    });
    const result = await findValidCoupon('Y');
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.couponId).toBe('c2');
  });
});
