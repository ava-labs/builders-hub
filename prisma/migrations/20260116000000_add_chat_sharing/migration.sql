-- Add sharing fields to ChatConversation table
ALTER TABLE "ChatConversation" ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatConversation" ADD COLUMN "share_token" TEXT;
ALTER TABLE "ChatConversation" ADD COLUMN "shared_at" TIMESTAMPTZ(3);
ALTER TABLE "ChatConversation" ADD COLUMN "share_expires_at" TIMESTAMPTZ(3);
ALTER TABLE "ChatConversation" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

-- Create unique index on share_token for fast lookups
CREATE UNIQUE INDEX "ChatConversation_share_token_key" ON "ChatConversation"("share_token");

-- Create index on is_shared for filtering shared conversations
CREATE INDEX "ChatConversation_share_token_idx" ON "ChatConversation"("share_token");
CREATE INDEX "ChatConversation_is_shared_idx" ON "ChatConversation"("is_shared");
