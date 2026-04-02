-- CreateTable
CREATE TABLE "OAuthCode" (
    "code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "OAuthCode_expires_at_idx" ON "OAuthCode"("expires_at");

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
