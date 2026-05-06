-- Builder Hub accounts are expected to have an email address.
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ADD COLUMN "team_id" TEXT;

CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "destination_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(3),

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "attribution_key" TEXT NOT NULL,
    "referral_link_id" TEXT,
    "user_id" TEXT,
    "user_id_referrer" TEXT,
    "team_id_referrer" TEXT,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "path" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE UNIQUE INDEX "ReferralAttribution_attribution_key_key" ON "ReferralAttribution"("attribution_key");

CREATE INDEX "User_team_id_idx" ON "User"("team_id");
CREATE INDEX "ReferralLink_owner_user_id_idx" ON "ReferralLink"("owner_user_id");
CREATE INDEX "ReferralLink_team_id_idx" ON "ReferralLink"("team_id");
CREATE INDEX "ReferralLink_target_type_idx" ON "ReferralLink"("target_type");
CREATE INDEX "ReferralLink_created_at_idx" ON "ReferralLink"("created_at");

CREATE INDEX "ReferralAttribution_referral_link_id_idx" ON "ReferralAttribution"("referral_link_id");
CREATE INDEX "ReferralAttribution_user_id_idx" ON "ReferralAttribution"("user_id");
CREATE INDEX "ReferralAttribution_user_id_referrer_idx" ON "ReferralAttribution"("user_id_referrer");
CREATE INDEX "ReferralAttribution_team_id_referrer_idx" ON "ReferralAttribution"("team_id_referrer");
CREATE INDEX "ReferralAttribution_target_type_idx" ON "ReferralAttribution"("target_type");
CREATE INDEX "ReferralAttribution_target_id_idx" ON "ReferralAttribution"("target_id");
CREATE INDEX "ReferralAttribution_created_at_idx" ON "ReferralAttribution"("created_at");

ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_user_id_referrer_fkey" FOREIGN KEY ("user_id_referrer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "User"
SET "team_id" = 'devrel'
WHERE LOWER("email") IN (
  'federico.nardelli@avalabs.org',
  'martin.eckardt@avalabs.org',
  'andrea.vargas@avalabs.org',
  'nicolas.arnedo@avalabs.org',
  'meag.fitz@avalabs.org',
  'alejandro.soto@avalabs.org',
  'owen.wahlgren@avalabs.org',
  'ashutosh.tripathi@avalabs.org',
  'ilya.solohin@avalabs.org'
);

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
  "team_id",
  "target_type",
  "target_id",
  "destination_url",
  "created_at"
)
SELECT
  'legacy-referral-link-hackathon-' || MD5(resolved."code"),
  resolved."code",
  resolved."owner_user_id",
  owner."team_id",
  'hackathon_registration',
  NULL,
  '/events/registration-form',
  CURRENT_TIMESTAMP
FROM resolved_event_codes resolved
INNER JOIN "User" owner ON owner."id" = resolved."owner_user_id"
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ReferralAttribution" (
  "id",
  "attribution_key",
  "referral_link_id",
  "user_id",
  "user_id_referrer",
  "team_id_referrer",
  "target_type",
  "target_id",
  "path",
  "created_at"
)
SELECT
  'legacy-referral-attribution-hackathon-' || MD5(register_form."id"),
  'legacy|hackathon_registration|' || register_form."id",
  referral_link."id",
  referred_user."id",
  referral_link."owner_user_id",
  referral_link."team_id",
  'hackathon_registration',
  register_form."hackathon_id",
  '/events/registration-form?event=' || register_form."hackathon_id",
  register_form."created_at"
FROM "RegisterForm" register_form
INNER JOIN "ReferralLink" referral_link
  ON referral_link."code" = TRIM(register_form."referrer_handle")
 AND referral_link."target_type" = 'hackathon_registration'
LEFT JOIN "User" referred_user
  ON LOWER(referred_user."email") = LOWER(register_form."email")
WHERE register_form."referrer_handle" IS NOT NULL
  AND TRIM(register_form."referrer_handle") <> ''
ON CONFLICT ("attribution_key") DO NOTHING;

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
  "team_id",
  "target_type",
  "target_id",
  "destination_url",
  "created_at"
)
SELECT
  'legacy-referral-link-build-games-' || MD5(resolved."code"),
  resolved."code",
  resolved."owner_user_id",
  owner."team_id",
  'build_games_application',
  NULL,
  '/build-games/apply',
  CURRENT_TIMESTAMP
FROM resolved_build_games_codes resolved
INNER JOIN "User" owner ON owner."id" = resolved."owner_user_id"
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ReferralAttribution" (
  "id",
  "attribution_key",
  "referral_link_id",
  "user_id",
  "user_id_referrer",
  "team_id_referrer",
  "target_type",
  "target_id",
  "path",
  "created_at"
)
SELECT
  'legacy-referral-attribution-build-games-' || MD5(build_games."id"),
  'legacy|build_games_application|' || build_games."id",
  referral_link."id",
  referred_user."id",
  referral_link."owner_user_id",
  referral_link."team_id",
  'build_games_application',
  NULL,
  '/build-games/apply',
  build_games."created_at"
FROM "BuildGamesApplication" build_games
INNER JOIN "ReferralLink" referral_link
  ON referral_link."code" = TRIM(build_games."referrer_handle")
 AND referral_link."target_type" = 'build_games_application'
LEFT JOIN "User" referred_user
  ON LOWER(referred_user."email") = LOWER(build_games."email")
WHERE build_games."referrer_handle" IS NOT NULL
  AND TRIM(build_games."referrer_handle") <> ''
ON CONFLICT ("attribution_key") DO NOTHING;

-- Backfill known legacy campaign/team codes as team-only attributions.
WITH legacy_team_codes("legacy_code", "team_id") AS (
  VALUES
    ('avaxteam1', 'team1-india'),
    ('Team1India', 'team1-india'),
    ('Team1India Join TG: https://telegram.me/avaxbuildgames', 'team1-india'),
    ('HackTourIND', 'team1-india'),
    ('Avalanche_In', 'team1-india'),
    ('ACM_DSU', 'team1-india'),
    ('Telugu_Dao', 'team1-india'),
    ('WEB3Madras', 'team1-india'),
    ('hyderabaddao', 'team1-india'),
    ('Team1LatAm', 'team1-latam'),
    ('avalanche_esp', 'team1-latam'),
    ('Avalanche_vn', 'team1-vietnam'),
    ('AvalancheKorea', 'team1-korea'),
    ('Avalanche_CN', 'team1-china'),
    ('avalanche_fr', 'team1-france')
)
INSERT INTO "ReferralAttribution" (
  "id",
  "attribution_key",
  "referral_link_id",
  "user_id",
  "user_id_referrer",
  "team_id_referrer",
  "target_type",
  "target_id",
  "path",
  "created_at"
)
SELECT
  'legacy-team-referral-attribution-hackathon-' || MD5(register_form."id"),
  'legacy-team|hackathon_registration|' || team_codes."team_id" || '|' || register_form."id",
  NULL,
  referred_user."id",
  NULL,
  team_codes."team_id",
  'hackathon_registration',
  register_form."hackathon_id",
  '/events/registration-form?event=' || register_form."hackathon_id",
  register_form."created_at"
FROM "RegisterForm" register_form
INNER JOIN legacy_team_codes team_codes
  ON LOWER(TRIM(team_codes."legacy_code")) = LOWER(TRIM(register_form."referrer_handle"))
LEFT JOIN "User" referred_user
  ON LOWER(referred_user."email") = LOWER(register_form."email")
WHERE register_form."referrer_handle" IS NOT NULL
  AND TRIM(register_form."referrer_handle") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "ReferralAttribution" existing
    WHERE existing."attribution_key" = 'legacy|hackathon_registration|' || register_form."id"
  )
ON CONFLICT ("attribution_key") DO NOTHING;

WITH legacy_team_codes("legacy_code", "team_id") AS (
  VALUES
    ('avaxteam1', 'team1-india'),
    ('Team1India', 'team1-india'),
    ('Team1India Join TG: https://telegram.me/avaxbuildgames', 'team1-india'),
    ('HackTourIND', 'team1-india'),
    ('Avalanche_In', 'team1-india'),
    ('ACM_DSU', 'team1-india'),
    ('Telugu_Dao', 'team1-india'),
    ('WEB3Madras', 'team1-india'),
    ('hyderabaddao', 'team1-india'),
    ('Team1LatAm', 'team1-latam'),
    ('avalanche_esp', 'team1-latam'),
    ('Avalanche_vn', 'team1-vietnam'),
    ('AvalancheKorea', 'team1-korea'),
    ('Avalanche_CN', 'team1-china'),
    ('avalanche_fr', 'team1-france')
)
INSERT INTO "ReferralAttribution" (
  "id",
  "attribution_key",
  "referral_link_id",
  "user_id",
  "user_id_referrer",
  "team_id_referrer",
  "target_type",
  "target_id",
  "path",
  "created_at"
)
SELECT
  'legacy-team-referral-attribution-build-games-' || MD5(build_games."id"),
  'legacy-team|build_games_application|' || team_codes."team_id" || '|' || build_games."id",
  NULL,
  referred_user."id",
  NULL,
  team_codes."team_id",
  'build_games_application',
  NULL,
  '/build-games/apply',
  build_games."created_at"
FROM "BuildGamesApplication" build_games
INNER JOIN legacy_team_codes team_codes
  ON LOWER(TRIM(team_codes."legacy_code")) = LOWER(TRIM(build_games."referrer_handle"))
LEFT JOIN "User" referred_user
  ON LOWER(referred_user."email") = LOWER(build_games."email")
WHERE build_games."referrer_handle" IS NOT NULL
  AND TRIM(build_games."referrer_handle") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "ReferralAttribution" existing
    WHERE existing."attribution_key" = 'legacy|build_games_application|' || build_games."id"
  )
ON CONFLICT ("attribution_key") DO NOTHING;

DROP INDEX IF EXISTS "BuildGamesApplication_referrer_handle_idx";

ALTER TABLE "RegisterForm"
  DROP COLUMN IF EXISTS "referrer_handle";

ALTER TABLE "BuildGamesApplication"
  DROP COLUMN IF EXISTS "referrer_name",
  DROP COLUMN IF EXISTS "referrer_handle";
