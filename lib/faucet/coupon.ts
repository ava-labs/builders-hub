import { prisma } from '@/prisma/prisma';

export type CouponCheck =
  | { valid: true; couponId: string }
  | { valid: false; reason: string };

/**
 * Look up a faucet coupon code and decide whether it currently grants access.
 *
 * A coupon is valid when it exists, is active (not manually disabled), and has
 * not passed its optional expiry. Coupons carry no usage budget — they only
 * lift the @avalabs.org gate on the devnet faucet; the existing per-user and
 * per-address rate limits still apply on top.
 */
export async function findValidCoupon(rawCode: string): Promise<CouponCheck> {
  const code = rawCode.trim();
  if (!code) return { valid: false, reason: 'A coupon code is required.' };

  const coupon = await prisma.faucetCoupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { valid: false, reason: 'Invalid coupon code.' };
  if (coupon.expires_at && coupon.expires_at <= new Date()) {
    return { valid: false, reason: 'This coupon code has expired.' };
  }

  return { valid: true, couponId: coupon.id };
}
