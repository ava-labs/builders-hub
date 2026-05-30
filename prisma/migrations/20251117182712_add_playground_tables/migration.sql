-- CreateTable
CREATE TABLE IF NOT EXISTS "Playground" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "charts" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Playground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlaygroundFavorite" (
    "id" TEXT NOT NULL,
    "playground_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaygroundFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Playground_user_id_idx" ON "Playground"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Playground_is_public_idx" ON "Playground"("is_public");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Playground_created_at_idx" ON "Playground"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlaygroundFavorite_playground_id_idx" ON "PlaygroundFavorite"("playground_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlaygroundFavorite_user_id_idx" ON "PlaygroundFavorite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlaygroundFavorite_playground_id_user_id_key" ON "PlaygroundFavorite"("playground_id", "user_id");

-- AddForeignKey
ALTER TABLE "Playground" ADD CONSTRAINT IF NOT EXISTS "Playground_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaygroundFavorite" ADD CONSTRAINT IF NOT EXISTS "PlaygroundFavorite_playground_id_fkey" FOREIGN KEY ("playground_id") REFERENCES "Playground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaygroundFavorite" ADD CONSTRAINT IF NOT EXISTS "PlaygroundFavorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
