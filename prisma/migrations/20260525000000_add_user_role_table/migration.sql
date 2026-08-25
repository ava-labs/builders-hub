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

-- Cleanup: remove rows whose role is not defined in ROLE_PERMISSIONS.
-- Unknown roles are silently ignored by getPermissionsFromRoles (returns []),
-- so they grant no access but pollute the table and can cause confusion.
--
-- Valid roles (must stay in sync with lib/auth/rolePermissions.ts):
--   superadmin, devrel, team1-admin, hackathonCreator, showcase, judge,
--   badge_admin, notify_event, builder_insights,
--   Team1-Leader, Team1-member, T1-Technical
DELETE FROM "UserRole"
WHERE role NOT IN (
    'superadmin',
    'devrel',
    'team1-admin',
    'hackathonCreator',
    'showcase',
    'judge',
    'badge_admin',
    'notify_event',
    'builder_insights',
    'Team1-Leader',
    'Team1-member',
    'T1-Technical'
);
