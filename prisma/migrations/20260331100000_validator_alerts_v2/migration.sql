-- Validator Alerts v2: days-based balance thresholds + security checks
ALTER TABLE "ValidatorAlert" ADD COLUMN "balance_threshold_days" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "ValidatorAlert" ADD COLUMN "security_alert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ValidatorAlert" ADD COLUMN "last_known_ip" TEXT;

CREATE INDEX "ValidatorAlert_security_alert_idx" ON "ValidatorAlert"("security_alert");
