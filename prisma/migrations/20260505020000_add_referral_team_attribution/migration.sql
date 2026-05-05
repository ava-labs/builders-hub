ALTER TABLE "User" ADD COLUMN "team_id" TEXT;
ALTER TABLE "ReferralLink" ADD COLUMN "team_id" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN "team_id" TEXT;

CREATE INDEX "User_team_id_idx" ON "User"("team_id");
CREATE INDEX "ReferralLink_team_id_idx" ON "ReferralLink"("team_id");
CREATE INDEX "ReferralAttribution_team_id_idx" ON "ReferralAttribution"("team_id");

-- Remove any temporary name-guess backfill rows if this migration is tested on
-- a fork where that experimental pass was applied.
DELETE FROM "ReferralAttribution"
WHERE "id" LIKE 'legacy-referral-attribution-%-name-%';

DELETE FROM "ReferralLink" referral_link
WHERE referral_link."id" LIKE 'legacy-referral-link-name-%'
  AND NOT EXISTS (
    SELECT 1
    FROM "ReferralAttribution" attribution
    WHERE attribution."referral_link_id" = referral_link."id"
  );

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

UPDATE "ReferralLink" referral_link
SET "team_id" = owner."team_id"
FROM "User" owner
WHERE referral_link."owner_user_id" = owner."id"
  AND owner."team_id" IS NOT NULL;

UPDATE "ReferralAttribution" attribution
SET "team_id" = referrer."team_id"
FROM "User" referrer
WHERE attribution."referrer_user_id" = referrer."id"
  AND referrer."team_id" IS NOT NULL;

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
),
mapped_unresolved AS (
  SELECT
    unresolved."source_table",
    unresolved."source_id",
    unresolved."legacy_code",
    team_codes."team_id"
  FROM "ReferralBackfillUnresolved" unresolved
  INNER JOIN legacy_team_codes team_codes
    ON LOWER(TRIM(team_codes."legacy_code")) = LOWER(TRIM(unresolved."legacy_code"))
)
INSERT INTO "ReferralAttribution" (
  "id",
  "dedupe_key",
  "referral_link_id",
  "referrer_user_id",
  "team_id",
  "converted_user_id",
  "converted_email",
  "conversion_type",
  "conversion_resource_id",
  "source",
  "landing_path",
  "created_at"
)
SELECT
  'legacy-team-referral-attribution-hackathon-' || MD5(register_form."id"),
  'legacy-team|hackathon_registration|' || mapped."team_id" || '|' || register_form."id",
  NULL,
  NULL,
  mapped."team_id",
  converted_user."id",
  LOWER(register_form."email"),
  'hackathon_registration',
  register_form."id",
  'referral',
  '/events/registration-form?event=' || register_form."hackathon_id",
  register_form."created_at"
FROM mapped_unresolved mapped
INNER JOIN "RegisterForm" register_form
  ON mapped."source_table" = 'RegisterForm'
 AND register_form."id" = mapped."source_id"
LEFT JOIN "User" converted_user
  ON LOWER(converted_user."email") = LOWER(register_form."email")
ON CONFLICT ("dedupe_key") DO NOTHING;

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
),
mapped_unresolved AS (
  SELECT
    unresolved."source_table",
    unresolved."source_id",
    unresolved."legacy_code",
    team_codes."team_id"
  FROM "ReferralBackfillUnresolved" unresolved
  INNER JOIN legacy_team_codes team_codes
    ON LOWER(TRIM(team_codes."legacy_code")) = LOWER(TRIM(unresolved."legacy_code"))
)
INSERT INTO "ReferralAttribution" (
  "id",
  "dedupe_key",
  "referral_link_id",
  "referrer_user_id",
  "team_id",
  "converted_user_id",
  "converted_email",
  "conversion_type",
  "conversion_resource_id",
  "source",
  "landing_path",
  "created_at"
)
SELECT
  'legacy-team-referral-attribution-build-games-' || MD5(build_games."id"),
  'legacy-team|build_games_application|' || mapped."team_id" || '|' || build_games."id",
  NULL,
  NULL,
  mapped."team_id",
  converted_user."id",
  LOWER(build_games."email"),
  'build_games_application',
  build_games."id",
  'referral',
  '/build-games/apply',
  build_games."created_at"
FROM mapped_unresolved mapped
INNER JOIN "BuildGamesApplication" build_games
  ON mapped."source_table" = 'BuildGamesApplication'
 AND build_games."id" = mapped."source_id"
LEFT JOIN "User" converted_user
  ON LOWER(converted_user."email") = LOWER(build_games."email")
ON CONFLICT ("dedupe_key") DO NOTHING;

DROP TABLE IF EXISTS "ReferralBackfillUnresolved";
