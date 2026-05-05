-- Builder Hub accounts are expected to have an email address.
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "destination_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(3),

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "referral_link_id" TEXT,
    "referrer_user_id" TEXT,
    "converted_user_id" TEXT,
    "converted_email" TEXT,
    "conversion_type" TEXT NOT NULL,
    "conversion_resource_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "landing_path" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE UNIQUE INDEX "ReferralAttribution_dedupe_key_key" ON "ReferralAttribution"("dedupe_key");
CREATE INDEX "ReferralLink_owner_user_id_idx" ON "ReferralLink"("owner_user_id");
CREATE INDEX "ReferralLink_target_type_idx" ON "ReferralLink"("target_type");
CREATE INDEX "ReferralLink_created_at_idx" ON "ReferralLink"("created_at");

CREATE INDEX "ReferralAttribution_referral_link_id_idx" ON "ReferralAttribution"("referral_link_id");
CREATE INDEX "ReferralAttribution_referrer_user_id_idx" ON "ReferralAttribution"("referrer_user_id");
CREATE INDEX "ReferralAttribution_converted_user_id_idx" ON "ReferralAttribution"("converted_user_id");
CREATE INDEX "ReferralAttribution_converted_email_idx" ON "ReferralAttribution"("converted_email");
CREATE INDEX "ReferralAttribution_conversion_type_idx" ON "ReferralAttribution"("conversion_type");
CREATE INDEX "ReferralAttribution_source_idx" ON "ReferralAttribution"("source");
CREATE INDEX "ReferralAttribution_created_at_idx" ON "ReferralAttribution"("created_at");

ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_converted_user_id_fkey" FOREIGN KEY ("converted_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
