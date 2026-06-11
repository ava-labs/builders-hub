-- Track wallet ownership proof challenges and one-time consumption.

CREATE TABLE "WalletOwnershipProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attemptedAt" TIMESTAMPTZ(3),
    "usedAt" TIMESTAMPTZ(3),
    "signature" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletOwnershipProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletOwnershipProof_nonce_key" ON "WalletOwnershipProof"("nonce");
CREATE INDEX "WalletOwnershipProof_userId_idx" ON "WalletOwnershipProof"("userId");
CREATE INDEX "WalletOwnershipProof_walletAddress_idx" ON "WalletOwnershipProof"("walletAddress");
CREATE INDEX "WalletOwnershipProof_expiresAt_idx" ON "WalletOwnershipProof"("expiresAt");
CREATE INDEX "WalletOwnershipProof_userId_walletAddress_attemptedAt_idx" ON "WalletOwnershipProof"("userId", "walletAddress", "attemptedAt");

ALTER TABLE "WalletOwnershipProof"
ADD CONSTRAINT "WalletOwnershipProof_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
