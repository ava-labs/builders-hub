-- Add composite index on (user_id, expires_at) to optimise the JWT callback
-- query: WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
CREATE INDEX "UserRole_user_id_expires_at_idx" ON "UserRole"("user_id", "expires_at");
