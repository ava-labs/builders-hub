-- The Access Restriction course was split into two certificates
-- (access-restriction-fundamentals / access-restriction-advanced), but the
-- badges still required course_id "access-restriction", so badge assignment
-- and certificate generation failed. Point the existing badges at the two new
-- course ids and migrate pre-split completions. All statements are idempotent.

-- 1) Access Restriction badge: require both course halves
INSERT INTO "Badge" (id, name, description, image_path, category, requirements)
VALUES (
  '1avalancheL1Academy-9access-restriction',
  'Access Restriction',
  'Completed the Access Restriction course',
  'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Access_Restriction_Badge.png',
  'academy',
  ARRAY[
    '{"id":"access-restriction-fundamentals","type":"course","points":100,"unlocked":false,"course_id":"access-restriction-fundamentals","hackathon":null,"description":"Complete the Access Restriction Fundamentals section"}'::jsonb,
    '{"id":"access-restriction-advanced","type":"course","points":100,"unlocked":false,"course_id":"access-restriction-advanced","hackathon":null,"description":"Complete the Access Restriction Advanced section"}'::jsonb
  ]
)
ON CONFLICT (id) DO UPDATE SET requirements = EXCLUDED.requirements;

-- 2) Graduate badge: replace the legacy access-restriction requirement with the two new ones
UPDATE "Badge"
SET requirements =
  (SELECT array_agg(r) FROM unnest(requirements) AS r
   WHERE r->>'course_id' <> 'access-restriction')
  || ARRAY[
    '{"id":"access-restriction-fundamentals","type":"course","points":100,"unlocked":false,"course_id":"access-restriction-fundamentals","hackathon":null,"description":"Complete the Access Restriction Fundamentals section"}'::jsonb,
    '{"id":"access-restriction-advanced","type":"course","points":100,"unlocked":false,"course_id":"access-restriction-advanced","hackathon":null,"description":"Complete the Access Restriction Advanced section"}'::jsonb
  ]
WHERE id = '1avalancheL1Academy-10academy-full-completion'
  AND EXISTS (SELECT 1 FROM unnest(requirements) r
              WHERE r->>'course_id' = 'access-restriction');

-- 3) Grandfather pre-split completions: rewrite legacy evidence entries
UPDATE "UserBadge"
SET evidence =
  COALESCE(
    (SELECT jsonb_agg(e) FROM jsonb_array_elements(evidence) e
     WHERE e->>'course_id' <> 'access-restriction'),
    '[]'::jsonb)
  || '[
    {"id":"access-restriction-fundamentals","type":"course","points":100,"unlocked":false,"course_id":"access-restriction-fundamentals","hackathon":null,"description":"Complete the Access Restriction Fundamentals section"},
    {"id":"access-restriction-advanced","type":"course","points":100,"unlocked":false,"course_id":"access-restriction-advanced","hackathon":null,"description":"Complete the Access Restriction Advanced section"}
  ]'::jsonb
WHERE badge_id IN ('1avalancheL1Academy-9access-restriction',
                   '1avalancheL1Academy-10academy-full-completion')
  AND evidence @> '[{"course_id":"access-restriction"}]';
