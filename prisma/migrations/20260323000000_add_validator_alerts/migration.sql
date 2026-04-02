-- CreateTable
CREATE TABLE "ValidatorAlert" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "label" TEXT,
    "uptime_alert" BOOLEAN NOT NULL DEFAULT true,
    "uptime_threshold" DOUBLE PRECISION NOT NULL DEFAULT 95,
    "version_alert" BOOLEAN NOT NULL DEFAULT true,
    "expiry_alert" BOOLEAN NOT NULL DEFAULT true,
    "expiry_days" INTEGER NOT NULL DEFAULT 7,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ValidatorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidatorAlertLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "validator_alert_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidatorAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValidatorAlert_user_id_node_id_key" ON "ValidatorAlert"("user_id", "node_id");

-- CreateIndex
CREATE INDEX "ValidatorAlert_user_id_idx" ON "ValidatorAlert"("user_id");

-- CreateIndex
CREATE INDEX "ValidatorAlert_node_id_idx" ON "ValidatorAlert"("node_id");

-- CreateIndex
CREATE INDEX "ValidatorAlert_active_idx" ON "ValidatorAlert"("active");

-- CreateIndex
CREATE INDEX "ValidatorAlertLog_validator_alert_id_idx" ON "ValidatorAlertLog"("validator_alert_id");

-- CreateIndex
CREATE INDEX "ValidatorAlertLog_sent_at_idx" ON "ValidatorAlertLog"("sent_at");

-- AddForeignKey
ALTER TABLE "ValidatorAlert" ADD CONSTRAINT "ValidatorAlert_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidatorAlertLog" ADD CONSTRAINT "ValidatorAlertLog_validator_alert_id_fkey" FOREIGN KEY ("validator_alert_id") REFERENCES "ValidatorAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
