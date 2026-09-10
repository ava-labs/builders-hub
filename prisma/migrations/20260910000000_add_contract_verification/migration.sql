-- CreateTable
CREATE TABLE "VerifiedContract" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "match" TEXT NOT NULL,
    "name" TEXT,
    "compiler_version" TEXT,
    "language" TEXT NOT NULL DEFAULT 'Solidity',
    "abi" JSONB,
    "metadata" JSONB,
    "std_json_blob_url" TEXT,
    "constructor_arguments" TEXT,
    "verified_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationJob" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "match" TEXT,
    "error_code" TEXT,
    "error" TEXT,
    "contract_name" TEXT,
    "compiler_version" TEXT,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "VerificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedContract_chain_id_address_key" ON "VerifiedContract"("chain_id", "address");

-- CreateIndex
CREATE INDEX "VerifiedContract_chain_id_idx" ON "VerifiedContract"("chain_id");

-- CreateIndex
CREATE INDEX "VerificationJob_chain_id_address_idx" ON "VerificationJob"("chain_id", "address");

-- CreateIndex
CREATE INDEX "VerificationJob_payload_hash_idx" ON "VerificationJob"("payload_hash");

-- CreateIndex
CREATE INDEX "VerificationJob_created_at_idx" ON "VerificationJob"("created_at");
