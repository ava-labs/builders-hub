/*
  Warnings:

  - You are about to drop the column `points` on the `Badge` table. All the data in the column will be lost.
  - You are about to drop the column `requirements_snapshot` on the `UserBadge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Badge" DROP COLUMN "points";

-- AlterTable
ALTER TABLE "UserBadge" DROP COLUMN "requirements_snapshot";

/*
-- CreateTable
CREATE TABLE "NodeRegistration" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subnet_id" TEXT NOT NULL,
    "blockchain_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_index" INTEGER,
    "public_key" TEXT NOT NULL,
    "proof_of_possession" TEXT NOT NULL,
    "rpc_url" TEXT NOT NULL,
    "chain_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NodeRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NodeRegistration_user_id_idx" ON "NodeRegistration"("user_id");

-- CreateIndex
CREATE INDEX "NodeRegistration_status_idx" ON "NodeRegistration"("status");

-- CreateIndex
CREATE INDEX "NodeRegistration_subnet_id_idx" ON "NodeRegistration"("subnet_id");

-- CreateIndex
CREATE UNIQUE INDEX "NodeRegistration_user_id_subnet_id_node_index_key" ON "NodeRegistration"("user_id", "subnet_id", "node_index");

-- AddForeignKey
ALTER TABLE "NodeRegistration" ADD CONSTRAINT "NodeRegistration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
*/