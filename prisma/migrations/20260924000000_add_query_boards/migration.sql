-- CreateTable
CREATE TABLE "QueryBoard" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tiles" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "QueryBoard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueryBoard_user_id_scope_idx" ON "QueryBoard"("user_id", "scope");

-- AddForeignKey
ALTER TABLE "QueryBoard" ADD CONSTRAINT "QueryBoard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
