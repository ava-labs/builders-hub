BEGIN;

-- 1) Crear columna temporal JSONB
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS wallet_new JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Migrar cada dirección de wallet a objeto { address: "..."}
UPDATE "User"
SET wallet_new = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('address', addr))
    FROM unnest(wallet) AS addr
  ),
  '[]'::jsonb
)
WHERE wallet IS NOT NULL;

-- 3) Reemplazar columna antigua
ALTER TABLE "User" DROP COLUMN wallet;
ALTER TABLE "User" RENAME COLUMN wallet_new TO wallet;

COMMIT;