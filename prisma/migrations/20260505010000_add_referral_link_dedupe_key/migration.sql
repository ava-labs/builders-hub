ALTER TABLE "ReferralLink" ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "ReferralLink_dedupe_key_key" ON "ReferralLink"("dedupe_key");
