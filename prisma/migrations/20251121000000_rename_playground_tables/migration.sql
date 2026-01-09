-- Rename the tables (only if old names exist and new ones don't)
DO $$
BEGIN
  IF to_regclass('public."Playground"') IS NOT NULL
     AND to_regclass('public."StatsPlayground"') IS NULL THEN
    EXECUTE 'ALTER TABLE "Playground" RENAME TO "StatsPlayground"';
  END IF;

  IF to_regclass('public."PlaygroundFavorite"') IS NOT NULL
     AND to_regclass('public."StatsPlaygroundFavorite"') IS NULL THEN
    EXECUTE 'ALTER TABLE "PlaygroundFavorite" RENAME TO "StatsPlaygroundFavorite"';
  END IF;
END $$;

-- Rename Primary Keys (only if they exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'StatsPlayground' AND c.conname = 'Playground_pkey'
  ) THEN
    EXECUTE 'ALTER TABLE "StatsPlayground" RENAME CONSTRAINT "Playground_pkey" TO "StatsPlayground_pkey"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'StatsPlaygroundFavorite' AND c.conname = 'PlaygroundFavorite_pkey'
  ) THEN
    EXECUTE 'ALTER TABLE "StatsPlaygroundFavorite" RENAME CONSTRAINT "PlaygroundFavorite_pkey" TO "StatsPlaygroundFavorite_pkey"';
  END IF;
END $$;

-- Rename Indexes (only if they exist)
DO $$
BEGIN
  IF to_regclass('public."Playground_user_id_idx"') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "Playground_user_id_idx" RENAME TO "StatsPlayground_user_id_idx"';
  END IF;

  IF to_regclass('public."Playground_is_public_idx"') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "Playground_is_public_idx" RENAME TO "StatsPlayground_is_public_idx"';
  END IF;

  IF to_regclass('public."Playground_created_at_idx"') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "Playground_created_at_idx" RENAME TO "StatsPlayground_created_at_idx"';
  END IF;

  IF to_regclass('public."PlaygroundFavorite_playground_id_idx"') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "PlaygroundFavorite_playground_id_idx" RENAME TO "StatsPlaygroundFavorite_playground_id_idx"';
  END IF;

  IF to_regclass('public."PlaygroundFavorite_user_id_idx"') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "PlaygroundFavorite_user_id_idx" RENAME TO "StatsPlaygroundFavorite_user_id_idx"';
  END IF;

  IF to_regclass('public."PlaygroundFavorite_playground_id_user_id_key"') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "PlaygroundFavorite_playground_id_user_id_key" RENAME TO "StatsPlaygroundFavorite_playground_id_user_id_key"';
  END IF;
END $$;

-- Rename Foreign Keys (only if they exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'StatsPlayground' AND c.conname = 'Playground_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "StatsPlayground" RENAME CONSTRAINT "Playground_user_id_fkey" TO "StatsPlayground_user_id_fkey"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'StatsPlaygroundFavorite' AND c.conname = 'PlaygroundFavorite_playground_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "StatsPlaygroundFavorite" RENAME CONSTRAINT "PlaygroundFavorite_playground_id_fkey" TO "StatsPlaygroundFavorite_playground_id_fkey"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'StatsPlaygroundFavorite' AND c.conname = 'PlaygroundFavorite_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "StatsPlaygroundFavorite" RENAME CONSTRAINT "PlaygroundFavorite_user_id_fkey" TO "StatsPlaygroundFavorite_user_id_fkey"';
  END IF;
END $$;
