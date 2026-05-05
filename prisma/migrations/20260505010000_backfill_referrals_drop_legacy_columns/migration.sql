CREATE TABLE IF NOT EXISTS "ReferralBackfillUnresolved" (
  "id" TEXT NOT NULL,
  "source_table" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "legacy_code" TEXT,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReferralBackfillUnresolved_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralBackfillUnresolved_source_table_idx" ON "ReferralBackfillUnresolved"("source_table");
CREATE INDEX IF NOT EXISTS "ReferralBackfillUnresolved_created_at_idx" ON "ReferralBackfillUnresolved"("created_at");

-- Backfill legacy event referral codes into the normalized referral tables.
WITH legacy_event_codes AS (
  SELECT DISTINCT TRIM("referrer_handle") AS "code"
  FROM "RegisterForm"
  WHERE "referrer_handle" IS NOT NULL
    AND TRIM("referrer_handle") <> ''
),
parsed_event_codes AS (
  SELECT
    "code",
    SPLIT_PART("code", '-', 1) AS "first_part",
    SPLIT_PART("code", '-', 2) AS "second_part",
    LOWER(REGEXP_REPLACE("code", '^@', '')) AS "handle_only"
  FROM legacy_event_codes
),
event_candidate_users AS (
  SELECT parsed."code", users."id" AS "owner_user_id"
  FROM parsed_event_codes parsed
  INNER JOIN "User" users
    ON LOWER(LEFT(users."id", 4)) = LOWER(parsed."first_part")
   AND LOWER(RIGHT(users."id", 4)) = LOWER(parsed."second_part")
  WHERE parsed."code" ~* '^[a-z0-9]{4}-[a-z0-9]{4}-.+'

  UNION

  SELECT parsed."code", users."id" AS "owner_user_id"
  FROM parsed_event_codes parsed
  INNER JOIN "User" users
    ON LOWER(COALESCE(users."user_name", '')) = parsed."handle_only"
    OR LOWER(SPLIT_PART(users."email", '@', 1)) = parsed."handle_only"
  WHERE parsed."code" !~* '^[a-z0-9]{4}-[a-z0-9]{4}-.+'
),
resolved_event_codes AS (
  SELECT "code", MIN("owner_user_id") AS "owner_user_id"
  FROM event_candidate_users
  GROUP BY "code"
  HAVING COUNT(DISTINCT "owner_user_id") = 1
)
INSERT INTO "ReferralLink" (
  "id",
  "code",
  "owner_user_id",
  "target_type",
  "target_id",
  "destination_url",
  "created_at"
)
SELECT
  'legacy-referral-link-hackathon-' || MD5("code"),
  "code",
  "owner_user_id",
  'hackathon_registration',
  NULL,
  '/events/registration-form',
  CURRENT_TIMESTAMP
FROM resolved_event_codes
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ReferralAttribution" (
  "id",
  "dedupe_key",
  "referral_link_id",
  "referrer_user_id",
  "converted_user_id",
  "converted_email",
  "conversion_type",
  "conversion_resource_id",
  "source",
  "landing_path",
  "created_at"
)
SELECT
  'legacy-referral-attribution-hackathon-' || MD5(register_form."id"),
  'legacy|hackathon_registration|' || register_form."id",
  referral_link."id",
  referral_link."owner_user_id",
  converted_user."id",
  LOWER(register_form."email"),
  'hackathon_registration',
  register_form."id",
  'referral',
  '/events/registration-form?event=' || register_form."hackathon_id",
  register_form."created_at"
FROM "RegisterForm" register_form
INNER JOIN "ReferralLink" referral_link
  ON referral_link."code" = TRIM(register_form."referrer_handle")
 AND referral_link."target_type" = 'hackathon_registration'
LEFT JOIN "User" converted_user
  ON LOWER(converted_user."email") = LOWER(register_form."email")
WHERE register_form."referrer_handle" IS NOT NULL
  AND TRIM(register_form."referrer_handle") <> ''
ON CONFLICT ("dedupe_key") DO NOTHING;

INSERT INTO "ReferralBackfillUnresolved" (
  "id",
  "source_table",
  "source_id",
  "legacy_code",
  "reason"
)
SELECT
  'legacy-referral-unresolved-hackathon-' || MD5(register_form."id"),
  'RegisterForm',
  register_form."id",
  TRIM(register_form."referrer_handle"),
  'Could not resolve legacy referrer code to one unique user'
FROM "RegisterForm" register_form
LEFT JOIN "ReferralAttribution" attribution
  ON attribution."conversion_type" = 'hackathon_registration'
 AND attribution."conversion_resource_id" = register_form."id"
WHERE register_form."referrer_handle" IS NOT NULL
  AND TRIM(register_form."referrer_handle") <> ''
  AND attribution."id" IS NULL
ON CONFLICT ("id") DO NOTHING;

-- Backfill legacy Build Games referrers where they can be resolved.
WITH legacy_build_games_codes AS (
  SELECT DISTINCT TRIM("referrer_handle") AS "code"
  FROM "BuildGamesApplication"
  WHERE "referrer_handle" IS NOT NULL
    AND TRIM("referrer_handle") <> ''
),
parsed_build_games_codes AS (
  SELECT
    "code",
    SPLIT_PART("code", '-', 1) AS "first_part",
    SPLIT_PART("code", '-', 2) AS "second_part",
    LOWER(REGEXP_REPLACE("code", '^@', '')) AS "handle_only"
  FROM legacy_build_games_codes
),
build_games_candidate_users AS (
  SELECT parsed."code", users."id" AS "owner_user_id"
  FROM parsed_build_games_codes parsed
  INNER JOIN "User" users
    ON LOWER(LEFT(users."id", 4)) = LOWER(parsed."first_part")
   AND LOWER(RIGHT(users."id", 4)) = LOWER(parsed."second_part")
  WHERE parsed."code" ~* '^[a-z0-9]{4}-[a-z0-9]{4}-.+'

  UNION

  SELECT parsed."code", users."id" AS "owner_user_id"
  FROM parsed_build_games_codes parsed
  INNER JOIN "User" users
    ON LOWER(COALESCE(users."user_name", '')) = parsed."handle_only"
    OR LOWER(SPLIT_PART(users."email", '@', 1)) = parsed."handle_only"
  WHERE parsed."code" !~* '^[a-z0-9]{4}-[a-z0-9]{4}-.+'
),
resolved_build_games_codes AS (
  SELECT "code", MIN("owner_user_id") AS "owner_user_id"
  FROM build_games_candidate_users
  GROUP BY "code"
  HAVING COUNT(DISTINCT "owner_user_id") = 1
)
INSERT INTO "ReferralLink" (
  "id",
  "code",
  "owner_user_id",
  "target_type",
  "target_id",
  "destination_url",
  "created_at"
)
SELECT
  'legacy-referral-link-build-games-' || MD5("code"),
  "code",
  "owner_user_id",
  'build_games_application',
  NULL,
  '/build-games/apply',
  CURRENT_TIMESTAMP
FROM resolved_build_games_codes
ON CONFLICT ("code") DO NOTHING;

WITH legacy_build_games_codes AS (
  SELECT DISTINCT TRIM("referrer_handle") AS "code"
  FROM "BuildGamesApplication"
  WHERE "referrer_handle" IS NOT NULL
    AND TRIM("referrer_handle") <> ''
),
parsed_build_games_codes AS (
  SELECT
    "code",
    SPLIT_PART("code", '-', 1) AS "first_part",
    SPLIT_PART("code", '-', 2) AS "second_part",
    LOWER(REGEXP_REPLACE("code", '^@', '')) AS "handle_only"
  FROM legacy_build_games_codes
),
build_games_candidate_users AS (
  SELECT parsed."code", users."id" AS "owner_user_id"
  FROM parsed_build_games_codes parsed
  INNER JOIN "User" users
    ON LOWER(LEFT(users."id", 4)) = LOWER(parsed."first_part")
   AND LOWER(RIGHT(users."id", 4)) = LOWER(parsed."second_part")
  WHERE parsed."code" ~* '^[a-z0-9]{4}-[a-z0-9]{4}-.+'

  UNION

  SELECT parsed."code", users."id" AS "owner_user_id"
  FROM parsed_build_games_codes parsed
  INNER JOIN "User" users
    ON LOWER(COALESCE(users."user_name", '')) = parsed."handle_only"
    OR LOWER(SPLIT_PART(users."email", '@', 1)) = parsed."handle_only"
  WHERE parsed."code" !~* '^[a-z0-9]{4}-[a-z0-9]{4}-.+'
),
resolved_build_games_codes AS (
  SELECT "code", MIN("owner_user_id") AS "owner_user_id"
  FROM build_games_candidate_users
  GROUP BY "code"
  HAVING COUNT(DISTINCT "owner_user_id") = 1
)
INSERT INTO "ReferralAttribution" (
  "id",
  "dedupe_key",
  "referral_link_id",
  "referrer_user_id",
  "converted_user_id",
  "converted_email",
  "conversion_type",
  "conversion_resource_id",
  "source",
  "landing_path",
  "created_at"
)
SELECT
  'legacy-referral-attribution-build-games-' || MD5(build_games."id"),
  'legacy|build_games_application|' || build_games."id",
  referral_link."id",
  resolved."owner_user_id",
  converted_user."id",
  LOWER(build_games."email"),
  'build_games_application',
  build_games."id",
  'referral',
  '/build-games/apply',
  build_games."created_at"
FROM "BuildGamesApplication" build_games
INNER JOIN resolved_build_games_codes resolved
  ON resolved."code" = TRIM(build_games."referrer_handle")
LEFT JOIN "ReferralLink" referral_link
  ON referral_link."code" = resolved."code"
LEFT JOIN "User" converted_user
  ON LOWER(converted_user."email") = LOWER(build_games."email")
WHERE build_games."referrer_handle" IS NOT NULL
  AND TRIM(build_games."referrer_handle") <> ''
ON CONFLICT ("dedupe_key") DO NOTHING;

INSERT INTO "ReferralBackfillUnresolved" (
  "id",
  "source_table",
  "source_id",
  "legacy_code",
  "reason"
)
SELECT
  'legacy-referral-unresolved-build-games-' || MD5(build_games."id"),
  'BuildGamesApplication',
  build_games."id",
  TRIM(build_games."referrer_handle"),
  'Could not resolve legacy referrer code to one unique user'
FROM "BuildGamesApplication" build_games
LEFT JOIN "ReferralAttribution" attribution
  ON attribution."conversion_type" = 'build_games_application'
 AND attribution."conversion_resource_id" = build_games."id"
WHERE build_games."referrer_handle" IS NOT NULL
  AND TRIM(build_games."referrer_handle") <> ''
  AND attribution."id" IS NULL
ON CONFLICT ("id") DO NOTHING;

DROP INDEX IF EXISTS "BuildGamesApplication_referrer_handle_idx";

ALTER TABLE "ReferralAttribution"
  DROP COLUMN IF EXISTS "utm_source",
  DROP COLUMN IF EXISTS "utm_medium",
  DROP COLUMN IF EXISTS "utm_campaign",
  DROP COLUMN IF EXISTS "utm_content",
  DROP COLUMN IF EXISTS "utm_term";

ALTER TABLE "RegisterForm"
  DROP COLUMN IF EXISTS "referrer_handle";

ALTER TABLE "BuildGamesApplication"
  DROP COLUMN IF EXISTS "referrer_name",
  DROP COLUMN IF EXISTS "referrer_handle";
