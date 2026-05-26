# Roles and Permissions System

> **Status:** Implemented — May 2026  
> **Replaces:** ad-hoc `custom_attributes.includes("devrel")` checks scattered across route handlers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Roles Table](#roles-table)
3. [Permissions Table](#permissions-table)
4. [Role → Permission Map](#role--permission-map)
5. [Role Expiration (UserRole table)](#role-expiration-userrole-table)
6. [Middleware & Route Manifest](#middleware--route-manifest)
7. [How to Protect a New Route](#how-to-protect-a-new-route)
8. [Admin API (role management)](#admin-api-role-management)
9. [Data Flow](#data-flow)
10. [Limitations & Disclaimers](#limitations--disclaimers)
11. [What Changed](#what-changed)

---

## Architecture Overview

```
Request
  └─► middleware.ts (Next.js edge)
        └─► routeManifest.ts  ← "is this route protected? which resource?"
              └─► JWT token   ← custom_attributes (roles) loaded by NextAuth
                    └─► rolePermissions.ts  ← "does role X grant resource:action?"
                          └─► ✅ pass  /  🔒 401 / 403
```

For routes **not** in the manifest (mixed public/protected), protection is applied
directly in the route handler via `withAuthPermission` or `withAuthResource`.

---

## Roles Table

Roles are strings stored in two places:

| Storage | Purpose | Expiration |
|---|---|---|
| `User.custom_attributes` (PostgreSQL `String[]`) | Legacy roles, permanently assigned | ❌ no |
| `UserRole` table | New roles, managed via admin API | ✅ optional |

At login, the NextAuth JWT callback reads all active `UserRole` rows
(deduplicated) into `token.custom_attributes`, filtering out expired entries.
Legacy values in `User.custom_attributes` were migrated to `UserRole` rows
during the deploy migration and are no longer read by the JWT callback.

### UserRole Table Schema

```prisma
model UserRole {
  id         String    @id @default(cuid())
  user_id    String
  role       String
  expires_at DateTime? // null = permanent
  granted_by String?   // user_id of the granting admin
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, role])
  @@index([user_id])
  @@index([expires_at])
}
```

---

## Permissions Table

Permissions are **not stored in the database**. They are defined in code as
`{ resource, action }` pairs in [`lib/auth/rolePermissions.ts`](../../lib/auth/rolePermissions.ts).

This is intentional: permissions are part of the application's business logic
and should be version-controlled, reviewed in PRs, and deployed with the app.

### Resource Taxonomy

Resources follow a `namespace` or `namespace:subnamespace` convention:

| Resource | What it governs |
|---|---|
| `hackathon` | Hackathon events (create, edit, publish) |
| `showcase` | Showcase entries and admin tools |
| `badge` | Badge assignment and management |
| `resource` | Learning resources |
| `speaker` | Speaker profiles |
| `notification` | Push notifications to users |
| `judge` | Judge assignments per hackathon |
| `user` | User accounts and role management |
| `builder_insights` | Internal analytics dashboard |
| `platform` | Platform-level admin actions (devrel/superadmin only) |
| `*` | Wildcard — matches any resource |

Sub-namespaces (e.g. `badge:nft`) are supported by `checkPermission()` via
prefix matching. A user with `badge:manage` automatically has access to `badge:nft:write`.

### Actions

| Action | Semantics | HTTP methods |
|---|---|---|
| `read` | Safe reads | `GET`, `HEAD` |
| `write` | Mutations | `POST`, `PUT`, `PATCH` |
| `delete` | Removal | `DELETE` |
| `manage` | `read` + `write` + `delete` | any |
| `assign` | Specific delegation action (e.g. assigning judges) | `POST`, `DELETE` |
| `export` | Data export operations | `GET`, `POST` |
| `admin` | Platform-level administration (devrel/superadmin only) | any |
| `*` | Wildcard — all actions (internal use in `checkPermission` only) | any |

---

## Role → Permission Map

Defined in [`lib/auth/rolePermissions.ts`](../../lib/auth/rolePermissions.ts).

| Role | Permissions |
|---|---|
| `superadmin` | `*:manage` (full access), `platform:admin`, `judge:assign` |
| `devrel` | `*:manage` (full access), `platform:admin`, `judge:assign` |
| `team1-admin` | `hackathon:manage`, `resource:manage`, `speaker:manage`, `showcase:read`, `judge:assign` |
| `hackathonCreator` | `hackathon:write`, `hackathon:read`, `resource:read`, `speaker:read`, `showcase:read`, `showcase:export` |
| `showcase` | `showcase:read`, `showcase:write` |
| `judge` | `judge:read`, `badge:write` |
| `badge_admin` | `badge:manage` |
| `notify_event` | `notification:write` |
| `builder_insights` | `builder_insights:read`, `builder_insights:write` |

**To add a new role:** add one entry to `ROLE_PERMISSIONS` in `rolePermissions.ts`.
No other file needs to change.

---

## Role Expiration (UserRole table)

Roles assigned via the `UserRole` table can optionally expire:

```json
{
  "user_id": "clxxxxx",
  "role": "judge",
  "expires_at": "2026-09-01T00:00:00.000Z"
}
```

Expiration is evaluated **at JWT refresh time** (on every login or session
update), not on every individual request. See [Limitations](#limitations--disclaimers)
for implications.

---

## Middleware & Route Manifest

[`middleware.ts`](../../middleware.ts) runs at the Next.js edge for every
request (excluding static files). It reads the route manifest and evaluates
the JWT token.

[`lib/auth/routeManifest.ts`](../../lib/auth/routeManifest.ts) is the single
place to declare which routes are protected and which resource they operate on.

### How matchRoute works

1. Exact pathname match (e.g. `/api/badge`)
2. Wildcard match — longest pattern wins (e.g. `/api/badge/*` before `/api/*`)
3. No match → public route, middleware passes through

### Mixed public/protected routes

Some routes serve public data on `GET` but require a role on `POST`/`PUT`/`DELETE`
(e.g. `GET /api/events` lists public hackathons, but `POST /api/events` requires
`hackathon:write`).

These routes are **not** in the manifest. Protection is applied per-handler using
`withAuthPermission` or `withAuthResource`.

> **Rule of thumb:**
> - Route is protected for **all methods** → add to manifest.
> - Route is protected only for **some methods** → use `withAuthPermission` in handlers.

---

## How to Protect a New Route

### Case A — Fully protected route (add to manifest)

```typescript
// lib/auth/routeManifest.ts
"/api/my-new-feature":   { resource: "my_resource" },
"/api/my-new-feature/*": { resource: "my_resource" },
```

Then add the role → permission mapping:

```typescript
// lib/auth/rolePermissions.ts
my_new_role: [{ resource: "my_resource", action: "read" }],
```

### Case B — Mixed route (handler-level guard)

```typescript
// app/api/my-feature/route.ts
import { withAuthPermission, withAuthResource } from "@/lib/protectedRoute";

// Option 1 — explicit resource + action
export const POST = withAuthPermission(
  { resource: "hackathon", action: "write" },
  async (req, ctx, session) => { ... }
);

// Option 2 — infer action from HTTP method
export const DELETE = withAuthResource(
  "hackathon",
  async (req, ctx, session) => { ... }
);
```

### Case C — Auth-only (any logged-in user)

```typescript
// lib/auth/routeManifest.ts
"/api/my-profile-data": { authOnly: true },
```

---

## Admin API (role management)

Base URL: `GET|POST|DELETE /api/admin/user-roles`

All endpoints require `platform:admin` permission (`superadmin` or `devrel` only).

### GET — List roles for a user

```
GET /api/admin/user-roles?user_id=<id>
```

**Response:**
```json
{
  "user": { "id": "...", "name": "...", "email": "..." },
  "legacy_attributes": ["devrel"],
  "roles": [
    {
      "id": "...",
      "role": "judge",
      "expires_at": "2026-09-01T00:00:00.000Z",
      "active": true,
      "granted_by": "...",
      "created_at": "...",
      "permissions": [
        { "resource": "judge", "action": "read" },
        { "resource": "badge", "action": "write" }
      ]
    }
  ]
}
```

### POST — Assign a role

```
POST /api/admin/user-roles
Content-Type: application/json

{
  "user_id": "clxxxxx",
  "role": "judge",
  "expires_at": "2026-09-01T00:00:00.000Z"  // optional, null = permanent
}
```

- Uses `upsert` — safe to call multiple times to update expiry.
- Returns `400` if the role is not defined in `ROLE_PERMISSIONS`.

### DELETE — Revoke a role

```
DELETE /api/admin/user-roles
Content-Type: application/json

{
  "user_id": "clxxxxx",
  "role": "judge"
}
```

> **Note:** This only removes the `UserRole` row. Roles in `User.custom_attributes`
> (legacy) are not affected by this endpoint. To remove legacy roles, update
> `custom_attributes` directly via the user management UI.

---

## Data Flow

```
1. User logs in (Google / GitHub / OTP)
       │
2. NextAuth jwt() callback fires
       │
3. Loads UserRole rows WHERE expires_at IS NULL
                         OR expires_at > NOW()           [DB read]
       │
4. Maps rows → role strings → token.custom_attributes
       │
5. Session is created → session.user.custom_attributes
       │
6. Request arrives at /api/badge/assign
       │
7. middleware.ts checks routeManifest → { resource: "badge" }
8. Infers action from POST → "write"
9. Checks token: hasPermission(custom_attributes, { resource: "badge", action: "write" })
       │
10. ✅ Passes through to route handler
       │
11. Handler runs business logic (no auth boilerplate needed)
```

---

## Limitations & Disclaimers

### ⚠️ JWT staleness

The JWT is evaluated on **every session refresh**, not on every request. If a role
is revoked via `DELETE /api/admin/user-roles`, the user retains that role in their
active session until the JWT expires (default: 30 days) or the session is forcibly
invalidated.

**Mitigation options:**
- Reduce JWT `maxAge` in `authOptions.ts` for security-sensitive roles.
- Call `session update` from the client after revoking a role.
- For critical operations, add a real-time DB check in the handler using `getUserActiveRoles()`.

### ⚠️ Legacy `custom_attributes` column

`User.custom_attributes` (PostgreSQL `String[]`) still exists in the schema but is
**no longer read by the JWT callback**. Token roles are sourced exclusively from
`UserRole` rows. The column is kept for reference until a data migration moves any
remaining values into `UserRole` rows.

### ⚠️ Mixed public/protected routes

Routes with a public `GET` but protected `POST`/`PUT`/`DELETE` are **not** added
to the route manifest (which cannot differentiate by method at the middleware level).
These routes rely on `withAuthPermission` in the handler. This means the middleware
does not provide a first-pass rejection for those mutating operations — only the
handler does. The manifest should not be used to infer complete protection coverage
for these routes.

### ⚠️ `superadmin` and `devrel` as wildcards

Both `superadmin` and `devrel` have `{ resource: "*", action: "*" }` permissions,
which bypass all resource:action checks. They also carry an explicit
`{ resource: "platform", action: "admin" }` permission used for strictly
platform-level gates (admin panels, final verdict, advance stage, user search
admin scope, showcase export, send-to-all notifications).

Use `platform:admin` — not `*:*` — when the intent is "devrel/superadmin only".
Assign these roles with extreme care.

### ⚠️ No UI for role management yet

The admin API exists but there is no corresponding UI component. Role assignment
must be done via direct API calls (e.g. curl or a REST client) by a `superadmin`
or `devrel` user.

---

## What Changed

| File | Change |
|---|---|
| `lib/auth/rolePermissions.ts` | **New.** Single source of truth: role → permission map, `Resource`/`Action` types, `checkPermission()`, `getPermissionsFromRoles()`, `actionFromMethod()`. |
| `lib/auth/roles.ts` | **Rewritten.** `ROLE_GROUPS` removed. `hasAnyRole` kept for compatibility. New `hasPermission()` delegates to `rolePermissions.ts`. Backward-compat shortcuts (`hasShowcaseRole` etc.) preserved. |
| `lib/auth/routeManifest.ts` | **New.** Declares all fully-protected routes and which resource they require. `matchRoute()` with exact + wildcard resolution. |
| `lib/protectedRoute.ts` | **Updated.** Added `withAuthPermission(required, handler)` and `withAuthResource(resource, handler)`. `withAuthRole` kept for gradual migration. |
| `middleware.ts` / `proxy.ts` | **Updated.** Central middleware now consumes the route manifest. Single auth decision point for all manifest-listed routes. |
| `prisma/schema.prisma` | **Updated.** Added `UserRole` model with `expires_at`. Added `user_roles` relation to `User`. |
| `lib/auth/authOptions.ts` | **Updated.** JWT callback now loads only active `UserRole` rows (filtered by expiry). `User.custom_attributes` is no longer merged. |
| `lib/auth/permissions.ts` | **Deleted.** All helpers (`canAccessEvaluationTools`, `canManageHackathonJudges`, etc.) replaced by `hasPermission()` calls at each callsite. |
| `lib/auth/roles.ts` | **Updated.** `hasAnyRole` removed. `isHackathonJudge` and `canEvaluateHackathon` moved here from `permissions.ts`. |
| `lib/protectedRoute.ts` | **Updated.** `withAuthRole` removed. Only `withAuth`, `withAuthPermission`, and `withAuthResource` remain. |
| `lib/auth/rolePermissions.ts` | **Updated.** Added `platform:admin` to `superadmin` and `devrel`. Added `builder_insights:write` to `builder_insights`. |
| `app/api/badge/console-migrate/route.ts` | **Migrated.** `includes("devrel")` → `hasPermission(..., { resource: "badge", action: "manage" })`. |
| `app/api/badge/assign/route.ts` | **Migrated.** Role includes replaced with `hasPermission(..., { resource: "badge", action: "manage" })`. |
| `app/api/notifications/create/route.ts` | **Migrated.** `includes("devrel")` / `includes("notify_event")` → `hasPermission(..., { resource: "notification", action: "write" })`. |
| `app/api/project/set-winner/route.ts` | **Migrated.** `withAuthRole("badge_admin")` → `withAuthPermission({ resource: "badge", action: "manage" })`. |
| `app/api/projects/[id]/winner/route.ts` | **Migrated.** `withAuthRole("devrel")` → `withAuthPermission({ resource: "hackathon", action: "manage" })`. |
| `app/api/evaluate/route.ts` | **Migrated.** `canAccessEvaluationTools` → `hasPermission(..., { resource: "judge", action: "read" })`. |
| `app/api/evaluate/submissions/route.ts` | **Migrated.** Same as above. |
| `app/api/evaluate/final-verdict/route.ts` | **Migrated.** `includes("devrel")` → `hasPermission(..., { resource: "platform", action: "admin" })`. |
| `app/api/evaluate/advance-stage/route.ts` | **Migrated.** Same as above. |
| `app/api/referrals/route.ts` | **Migrated.** `canGenerateRestrictedReferralLinks` → `builder_insights:write`. `canGenerateReferralLinkForTarget` inlined as direct type check. |
| `app/api/users/search/route.ts` | **Migrated.** `includes("devrel")` → `platform:admin`. |
| `app/api/projects/export/route.ts` | **Migrated.** Triple includes → `hackathon:write`. |
| `app/hackathons/edit/page.tsx` | **Migrated.** All role includes replaced with `hasPermission()`. `isDevrel` uses `platform:admin`. |
| `app/events/edit/page.tsx` | **Migrated.** Same as above. |
| `app/(home)/evaluate/page.tsx` | **Migrated.** `canAccessEvaluationTools` → `judge:read`. `isDevrel` → `platform:admin`. |
| `app/(home)/builder-insights/page.tsx` | **Migrated.** `canAccessBuilderInsights` → `builder_insights:read`. |
| `app/(home)/events/new/page.tsx` | **Migrated.** `includes("devrel")` → `platform:admin`. |
| `app/(home)/events/[id]/admin-panel/page.tsx` | **Migrated.** Same. |
| `app/(home)/hackathons/new/page.tsx` | **Migrated.** Same. |
| `app/(home)/hackathons/[id]/admin-panel/page.tsx` | **Migrated.** Same. |
| `app/(home)/events/[id]/evaluate/page.tsx` | **Migrated.** `canManageHackathonJudges` → `platform:admin`. |
| `app/(home)/events/[id]/admin-panel/judges/page.tsx` | **Migrated.** Same. |
| `components/evaluate/HostNavButtons.tsx` | **Migrated.** Same. |
| `components/login/user-button/UserButton.tsx` | **Migrated.** All role includes replaced with `hasPermission()`. |
| `components/showcase/ShowCaseCard.tsx` | **Migrated.** Local `checkUserPermissions` uses `showcase:read` and `platform:admin`. |
| `components/showcase/ShowcaseProjectAuthWrapper.tsx` | **Migrated.** Uses `hasShowcaseRole` shortcut (delegates to `showcase:read`). |
| `components/hackathons/Hackathons.tsx` | **Migrated.** `isHackathonCreator` uses `hackathon:write`. |
| `components/hackathons/Events.tsx` | **Migrated.** Same. |
| `components/notification/send-notifications-form.tsx` | **Migrated.** "All" audience tab uses `platform:admin`. |
