-- Rename the tables
ALTER TABLE "Playground" RENAME TO "StatsPlayground";
ALTER TABLE "PlaygroundFavorite" RENAME TO "StatsPlaygroundFavorite";

-- Rename Primary Keys
ALTER TABLE "StatsPlayground" RENAME CONSTRAINT "Playground_pkey" TO "StatsPlayground_pkey";
ALTER TABLE "StatsPlaygroundFavorite" RENAME CONSTRAINT "PlaygroundFavorite_pkey" TO "StatsPlaygroundFavorite_pkey";

-- Rename Indexes
ALTER INDEX "Playground_user_id_idx" RENAME TO "StatsPlayground_user_id_idx";
ALTER INDEX "Playground_is_public_idx" RENAME TO "StatsPlayground_is_public_idx";
ALTER INDEX "Playground_created_at_idx" RENAME TO "StatsPlayground_created_at_idx";
ALTER INDEX "PlaygroundFavorite_playground_id_idx" RENAME TO "StatsPlaygroundFavorite_playground_id_idx";
ALTER INDEX "PlaygroundFavorite_user_id_idx" RENAME TO "StatsPlaygroundFavorite_user_id_idx";
ALTER INDEX "PlaygroundFavorite_playground_id_user_id_key" RENAME TO "StatsPlaygroundFavorite_playground_id_user_id_key";

-- Rename Foreign Keys
ALTER TABLE "StatsPlayground" RENAME CONSTRAINT "Playground_user_id_fkey" TO "StatsPlayground_user_id_fkey";
ALTER TABLE "StatsPlaygroundFavorite" RENAME CONSTRAINT "PlaygroundFavorite_playground_id_fkey" TO "StatsPlaygroundFavorite_playground_id_fkey";
ALTER TABLE "StatsPlaygroundFavorite" RENAME CONSTRAINT "PlaygroundFavorite_user_id_fkey" TO "StatsPlaygroundFavorite_user_id_fkey";
