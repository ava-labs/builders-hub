-- Stores Builder Hub's last-known generated/applied upgrade.json per user L1.
-- The managed node filesystem remains the live source for managed nodes.
CREATE TABLE "public"."L1UpgradeSnapshot" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subnet_id" TEXT NOT NULL,
    "blockchain_id" TEXT NOT NULL,
    "chain_name" TEXT,
    "rpc_url" TEXT,
    "upgrade_json" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'builder',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "L1UpgradeSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "L1UpgradeSnapshot_user_id_subnet_id_blockchain_id_key"
ON "public"."L1UpgradeSnapshot"("user_id", "subnet_id", "blockchain_id");

CREATE INDEX "L1UpgradeSnapshot_user_id_idx" ON "public"."L1UpgradeSnapshot"("user_id");
CREATE INDEX "L1UpgradeSnapshot_subnet_id_idx" ON "public"."L1UpgradeSnapshot"("subnet_id");
CREATE INDEX "L1UpgradeSnapshot_blockchain_id_idx" ON "public"."L1UpgradeSnapshot"("blockchain_id");

ALTER TABLE "public"."L1UpgradeSnapshot"
ADD CONSTRAINT "L1UpgradeSnapshot_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
