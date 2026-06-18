-- Coupon-code access for the Devnet faucet.
-- A coupon lifts the @avalabs.org gate for external users; the existing per-user
-- and per-address rate limits still apply. FaucetClaim.coupon_id records which
-- coupon authorized an external claim (null for internal @avalabs.org claims).

CREATE TABLE "FaucetCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(3),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FaucetCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FaucetCoupon_code_key" ON "FaucetCoupon"("code");

ALTER TABLE "FaucetClaim" ADD COLUMN "coupon_id" TEXT;

CREATE INDEX "FaucetClaim_coupon_id_idx" ON "FaucetClaim"("coupon_id");

ALTER TABLE "FaucetClaim" ADD CONSTRAINT "FaucetClaim_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "FaucetCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
