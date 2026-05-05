-- Rename profile social columns to the canonical account fields.
ALTER TABLE "User" RENAME COLUMN "github" TO "github_account";
ALTER TABLE "User" RENAME COLUMN "social_media" TO "additional_social_media";
ALTER TABLE "User" RENAME COLUMN "x_handle" TO "x_account";
ALTER TABLE "User" RENAME COLUMN "linkedin_url" TO "linkedin_account";

-- Move only canonical values out of the catch-all array. Anything that is
-- malformed, label-style, duplicate, or conflicts with an existing dedicated
-- value stays in additional_social_media so no production profile data is lost.
WITH parsed_socials AS (
  SELECT
    u.id,
    entry.value AS raw_value,
    BTRIM(entry.value) AS value,
    entry.ordinality,
    CASE
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?github[.]com/[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?/?$'
        THEN 'github'
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?(x|twitter)[.]com/[A-Za-z0-9_]{1,15}/?$'
        THEN 'x'
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?linkedin[.]com/(in|pub)/[A-Za-z0-9_.%-]+/?$'
        THEN 'linkedin'
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?(t[.]me|telegram[.]me|telegram[.]org)/[A-Za-z][A-Za-z0-9_]{4,31}/?$'
        THEN 'telegram'
      ELSE NULL
    END AS platform,
    CASE
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?github[.]com/[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?/?$'
        THEN BTRIM(entry.value)
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?(x|twitter)[.]com/[A-Za-z0-9_]{1,15}/?$'
        THEN BTRIM(entry.value)
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?linkedin[.]com/(in|pub)/[A-Za-z0-9_.%-]+/?$'
        THEN BTRIM(entry.value)
      WHEN BTRIM(entry.value) ~* '^https?://(www[.])?(t[.]me|telegram[.]me|telegram[.]org)/[A-Za-z][A-Za-z0-9_]{4,31}/?$'
        THEN REGEXP_REPLACE(BTRIM(entry.value), '^https?://(www[.])?(t[.]me|telegram[.]me|telegram[.]org)/([A-Za-z][A-Za-z0-9_]{4,31})/?$', E'\\4', 'i')
      ELSE NULL
    END AS normalized_value
  FROM "User" u
  LEFT JOIN LATERAL UNNEST(COALESCE(u."additional_social_media", ARRAY[]::TEXT[]))
    WITH ORDINALITY AS entry(value, ordinality) ON TRUE
  WHERE entry.value IS NOT NULL
    AND BTRIM(entry.value) <> ''
),
ranked_socials AS (
  SELECT
    parsed_socials.*,
    CASE
      WHEN parsed_socials.platform IS NOT NULL
        THEN ROW_NUMBER() OVER (
          PARTITION BY parsed_socials.id, parsed_socials.platform
          ORDER BY parsed_socials.ordinality
        )
      ELSE NULL
    END AS platform_rank
  FROM parsed_socials
),
chosen_socials AS (
  SELECT
    u.id,
    (
      ARRAY_AGG(r.normalized_value ORDER BY r.ordinality)
      FILTER (WHERE r.platform = 'github')
    )[1] AS github_account,
    (
      ARRAY_AGG(r.normalized_value ORDER BY r.ordinality)
      FILTER (WHERE r.platform = 'x')
    )[1] AS x_account,
    (
      ARRAY_AGG(r.normalized_value ORDER BY r.ordinality)
      FILTER (WHERE r.platform = 'linkedin')
    )[1] AS linkedin_account,
    (
      ARRAY_AGG(r.normalized_value ORDER BY r.ordinality)
      FILTER (WHERE r.platform = 'telegram')
    )[1] AS telegram_user
  FROM "User" u
  LEFT JOIN ranked_socials r ON r.id = u.id
  GROUP BY u.id
),
remaining_socials AS (
  SELECT
    u.id,
    COALESCE(
      ARRAY_AGG(r.raw_value ORDER BY r.ordinality)
      FILTER (
        WHERE r.id IS NOT NULL
          AND (
            r.platform IS NULL
            OR (
              r.platform = 'github'
              AND (NULLIF(BTRIM(u."github_account"), '') IS NOT NULL OR r.platform_rank > 1)
            )
            OR (
              r.platform = 'x'
              AND (NULLIF(BTRIM(u."x_account"), '') IS NOT NULL OR r.platform_rank > 1)
            )
            OR (
              r.platform = 'linkedin'
              AND (NULLIF(BTRIM(u."linkedin_account"), '') IS NOT NULL OR r.platform_rank > 1)
            )
            OR (
              r.platform = 'telegram'
              AND (NULLIF(BTRIM(u."telegram_user"), '') IS NOT NULL OR r.platform_rank > 1)
            )
          )
      ),
      ARRAY[]::TEXT[]
    ) AS additional_social_media
  FROM "User" u
  LEFT JOIN ranked_socials r ON r.id = u.id
  GROUP BY u.id
)
UPDATE "User" u
SET
  "github_account" = COALESCE(NULLIF(BTRIM(u."github_account"), ''), chosen_socials.github_account),
  "x_account" = COALESCE(NULLIF(BTRIM(u."x_account"), ''), chosen_socials.x_account),
  "linkedin_account" = COALESCE(NULLIF(BTRIM(u."linkedin_account"), ''), chosen_socials.linkedin_account),
  "telegram_user" = COALESCE(NULLIF(BTRIM(u."telegram_user"), ''), chosen_socials.telegram_user),
  "additional_social_media" = remaining_socials.additional_social_media
FROM chosen_socials
JOIN remaining_socials ON remaining_socials.id = chosen_socials.id
WHERE u.id = chosen_socials.id;

UPDATE "User"
SET "additional_social_media" = ARRAY[]::TEXT[]
WHERE "additional_social_media" IS NULL;

ALTER TABLE "User" ALTER COLUMN "additional_social_media" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ALTER COLUMN "additional_social_media" SET NOT NULL;
