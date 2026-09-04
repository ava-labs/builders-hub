-- CreateTable: UserRole
-- Replaces the flat custom_attributes TEXT[] with a normalized role table.
-- Roles are read at login time and placed in session.user.custom_attributes
-- by the jwt() callback in authOptions.ts.

CREATE TABLE "UserRole" (
    "id"         TEXT         NOT NULL,
    "user_id"    TEXT         NOT NULL,
    "role"       TEXT         NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "granted_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "UserRole_user_id_role_key" ON "UserRole"("user_id", "role");
CREATE INDEX "UserRole_user_id_expires_at_idx" ON "UserRole"("user_id", "expires_at");
CREATE INDEX "UserRole_user_id_idx"    ON "UserRole"("user_id");
CREATE INDEX "UserRole_expires_at_idx" ON "UserRole"("expires_at");

-- Foreign key
ALTER TABLE "UserRole"
    ADD CONSTRAINT "UserRole_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: migrate existing roles from User.custom_attributes → UserRole
-- Uses gen_random_uuid() (available in PostgreSQL ≥ 13 / pgcrypto).
-- ON CONFLICT DO NOTHING is idempotent, safe to re-run.
INSERT INTO "UserRole" (id, user_id, role, created_at, updated_at)
SELECT
    gen_random_uuid()::TEXT,
    u.id,
    attr.role,
    NOW(),
    NOW()
FROM "User" u
CROSS JOIN LATERAL unnest(u.custom_attributes) AS attr(role)
WHERE u.custom_attributes IS NOT NULL
  AND array_length(u.custom_attributes, 1) > 0
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Normalise role names to lower snake_case.
--
-- Role names are data: they live in this TEXT column and are matched in SQL, so
-- they follow the database's convention, not TypeScript's. Two families were
-- out of line — the Team1 roles used "-", and hackathonCreator was camelCase.
--
-- Target set (must stay in sync with lib/auth/rolePermissions.ts):
--   hackathon_creator   → create events, enter the event editor
--   team1               → read access to the gated Team1 Academy area
--   team1_admin         → event / resource / speaker management (scoped to own)
--   team1_event_admin   → read access to own events (scoped)
--   team1_lead          → builder insights + Team1 Academy
--
-- Everything below is remapped BEFORE the cleanup DELETE removes the old rows.
-- Sources are the tags actually observed in production (see 20260505000000)
-- plus the hyphenated names this branch introduced.
--
-- INSERT-then-DELETE rather than UPDATE: a user may already hold the target
-- role, and UPDATE would violate the (user_id, role) unique index. As with the
-- backfill above, ON CONFLICT DO NOTHING also tolerates duplicate rows produced
-- within a single command (e.g. a user holding both T1-Technical and
-- Team1-member, which both map to team1), so this is safe to re-run.
INSERT INTO "UserRole" (id, user_id, role, granted_by, created_at, updated_at)
SELECT gen_random_uuid()::TEXT, ur.user_id, m.new_role, ur.granted_by, NOW(), NOW()
FROM "UserRole" ur
JOIN (VALUES
    -- camelCase → snake_case
    ('hackathonCreator',  'hackathon_creator'),
    -- hyphen → underscore (all three exist in production)
    ('team1-admin',       'team1_admin'),
    ('team1-event-admin', 'team1_event_admin'),
    ('team1-lead',        'team1_lead'),
    -- legacy leader tags
    ('Team1-Leader',      'team1_lead'),
    ('team1-leader',      'team1_lead'),
    -- legacy member / technical tags collapse to plain team1
    ('Team1-member',      'team1'),
    ('team1-member',      'team1'),
    ('T1-Technical',      'team1'),
    ('t1-technical',      'team1')
) AS m(old_role, new_role) ON ur.role = m.old_role
ON CONFLICT (user_id, role) DO NOTHING;

-- Cleanup: remove rows whose role is not defined in ROLE_PERMISSIONS.
-- Unknown roles are silently ignored by getPermissionsFromRoles (returns []),
-- so they grant no access but pollute the table and can cause confusion.
--
-- Valid roles (must stay in sync with lib/auth/rolePermissions.ts):
--   devrel, hackathon_creator, showcase, badge_admin,
--   notify_all, notify_event, builder_insights,
--   team1, team1_admin, team1_event_admin, team1_lead
--
-- The previous "role NOT LIKE 'team1%'" escape hatch is deliberately GONE.
-- It existed because hasTeam1AcademyAccess() granted Academy access by role
-- NAME PREFIX, which made unknown team1* tags load-bearing. Academy access is
-- now an ordinary permission (academy:team1) held by the explicit roles above,
-- so the prefix carries no meaning and keeping the clause would preserve
-- exactly the legacy rows (team1-admin, team1-leader, team1-member, …) that
-- the consolidation block above just folded into the underscore names.
DELETE FROM "UserRole"
WHERE role NOT IN (
    'devrel',
    'hackathon_creator',
    'showcase',
    'badge_admin',
    'notify_all',
    'notify_event',
    'builder_insights',
    'team1',
    'team1_admin',
    'team1_event_admin',
    'team1_lead'
);
