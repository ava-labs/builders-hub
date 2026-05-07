-- Backfill ReferralAttribution rows from RegisterForm.utm values that map
-- unambiguously to Team1-LatAm (team-only) or to a known DevRel referrer.
--
-- Captures attribution that the main referral migration left behind because it
-- only read RegisterForm.referrer_handle. The utm column itself is preserved
-- (analytics still need it). Idempotent: ON CONFLICT (attribution_key) DO
-- NOTHING + a NOT EXISTS guard against the keys produced by
-- 20260505000000_add_builder_insights_referrals.

-- Tier A — Team1-LatAm team-only attributions.
-- Maps every Team1 utm value (regional and generic) to team1-latam.
WITH legacy_utm_team_codes("legacy_utm", "team_id") AS (
  VALUES
    ('t1',                    'team1-latam'),
    ('team1',                 'team1-latam'),
    ('bootcamp-team1',        'team1-latam'),
    ('t1-latam',              'team1-latam'),
    ('team1-medellin-as',     'team1-latam'),
    ('team1-argentina-as',    'team1-latam'),
    ('team1-peru',            'team1-latam'),
    ('team1-latam-instagram', 'team1-latam'),
    ('team1-latam-x',         'team1-latam')
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
  'legacy-utm-team-attribution-hackathon-' || MD5(rf."id"),
  'legacy-utm-team|hackathon_registration|' || codes."team_id" || '|' || rf."id",
  NULL,
  ru."id",
  NULL,
  codes."team_id",
  'hackathon_registration',
  rf."hackathon_id",
  '/events/registration-form?event=' || rf."hackathon_id",
  rf."created_at"
FROM "RegisterForm" rf
INNER JOIN legacy_utm_team_codes codes
  ON LOWER(TRIM(codes."legacy_utm")) = LOWER(TRIM(rf."utm"))
LEFT JOIN "User" ru
  ON LOWER(ru."email") = LOWER(rf."email")
WHERE rf."utm" IS NOT NULL
  AND TRIM(rf."utm") <> ''
  -- Skip rows already attributed by the main migration (any team or per-user key).
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralAttribution" e
    WHERE e."attribution_key" IN (
      'legacy|hackathon_registration|' || rf."id",
      'legacy-team|hackathon_registration|team1-india|'   || rf."id",
      'legacy-team|hackathon_registration|team1-latam|'   || rf."id",
      'legacy-team|hackathon_registration|team1-vietnam|' || rf."id",
      'legacy-team|hackathon_registration|team1-korea|'   || rf."id",
      'legacy-team|hackathon_registration|team1-china|'   || rf."id",
      'legacy-team|hackathon_registration|team1-france|'  || rf."id"
    )
  )
ON CONFLICT ("attribution_key") DO NOTHING;

-- Tier B — t1-as: per-user attribution to alejandro.soto@avalabs.org (devrel).
-- Resolved at apply time via email lookup so the migration does not hardcode a
-- user id; if the row is missing the migration is a no-op for these 4 rows.
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
  'legacy-utm-handle-attribution-hackathon-' || MD5(rf."id"),
  'legacy-utm-handle|hackathon_registration|' || rf."id",
  NULL,
  ru."id",
  alejandro."id",
  alejandro."team_id",
  'hackathon_registration',
  rf."hackathon_id",
  '/events/registration-form?event=' || rf."hackathon_id",
  rf."created_at"
FROM "RegisterForm" rf
INNER JOIN "User" alejandro
  ON LOWER(alejandro."email") = 'alejandro.soto@avalabs.org'
LEFT JOIN "User" ru
  ON LOWER(ru."email") = LOWER(rf."email")
WHERE LOWER(TRIM(rf."utm")) = 't1-as'
  -- Drop self-referrals (cannot refer yourself).
  AND (ru."id" IS NULL OR ru."id" <> alejandro."id")
  -- Skip rows already attributed by the main migration or by Tier A above.
  AND NOT EXISTS (
    SELECT 1 FROM "ReferralAttribution" e
    WHERE e."attribution_key" IN (
      'legacy|hackathon_registration|'                  || rf."id",
      'legacy-team|hackathon_registration|team1-latam|' || rf."id",
      'legacy-utm-team|hackathon_registration|team1-latam|' || rf."id"
    )
  )
ON CONFLICT ("attribution_key") DO NOTHING;
