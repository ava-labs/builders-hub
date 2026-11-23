-- Daily per-account caps on Quick L1 deployments and managed testnet nodes:
-- one row per attempt sent to the upstream service. Additive only.
CREATE TABLE "ProvisionAttempt" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisionAttempt_pkey" PRIMARY KEY ("id")
);

-- The caps count one user's rows of one kind in the last 24 hours.
CREATE INDEX "ProvisionAttempt_user_id_kind_created_at_idx" ON "ProvisionAttempt"("user_id", "kind", "created_at");
