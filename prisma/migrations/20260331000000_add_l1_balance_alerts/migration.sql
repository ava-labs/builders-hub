-- Add L1 balance alert fields
ALTER TABLE "ValidatorAlert" ADD COLUMN "subnet_id" TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE "ValidatorAlert" ADD COLUMN "balance_alert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ValidatorAlert" ADD COLUMN "balance_threshold" DOUBLE PRECISION NOT NULL DEFAULT 5000000000;

-- Drop old unique constraint and create new one including subnet_id
ALTER TABLE "ValidatorAlert" DROP CONSTRAINT "ValidatorAlert_user_id_node_id_key";
CREATE UNIQUE INDEX "ValidatorAlert_user_id_node_id_subnet_id_key" ON "ValidatorAlert"("user_id", "node_id", "subnet_id");

-- Add subnet_id index
CREATE INDEX "ValidatorAlert_subnet_id_idx" ON "ValidatorAlert"("subnet_id");
