# Builder Hub migration notes

Scope: decisions and known state recorded while doing the Build Games
stage-progression migration and the parallel Builder Hub cleanup work on
the `test-buildgames-migration` branch. Kept next to the Prisma schema
because every decision below is tied to a model in `schema.prisma`.

## `FormData` for Build Games: current reality

The fork-DB audit found that `FormData` is no longer behaving like a
flexible multi-program carrier. It is already effectively a repeated
Build Games submission schema stored as JSON:

- 1065 rows, all with `origin = "build_games"`
- every row has a single top-level key: `build_games`
- before this migration every row had `current_stage = 0` and
  `final_verdict = null`
- a core set of fields is present in 100% or near-100% of rows

| Field                         | Coverage     |
| ----------------------------- | ------------ |
| `architecture_overview`       | 1065 / 1065  |
| `current_solutions`           | 1065 / 1065  |
| `existing_achievements`       | 1065 / 1065  |
| `existing_project_plan`       | 1065 / 1065  |
| `moscow_framework`            | 1065 / 1065  |
| `onchain_trigger`             | 1065 / 1065  |
| `problem_statement`           | 1065 / 1065  |
| `proposed_solution`           | 1065 / 1065  |
| `user_journey`                | 1065 / 1065  |
| `user_persona`                | 1065 / 1065  |
| `game_*` fields (18)          | 1063 / 1065  |
| `stage1_result`               |  994 / 1065  |
| `stages`                      |  382 / 1065  |
| `milestones`                  |  370 / 1065  |
| `summary`, `support_needed`   |   53 / 1065  |

### Direction

- keep the immediate stage migration on the existing `FormData` +
  `form_data.build_games` path (already shipped in commit `4539e61d`)
- do not deepen reliance on opaque JSON access patterns outside the
  read paths that already exist
- the near-100% fields above are the obvious candidates to become typed
  columns on a future `BuildGamesSubmission` table, with `stages`,
  `milestones`, `summary`, and `support_needed` either kept in JSON or
  promoted to their own rows once the product shape stabilises
- any new Build Games field added by product should be added as a typed
  column unless it is genuinely hackathon-specific and short-lived

The goal of that later work is not to rebuild Build Games from scratch.
It is to stop treating `FormData` as an unquestioned permanent shape
now that the data has told us what it actually is.

## `Prize` table: removed

The fork-DB audit confirmed the table is empty, and while reads were
live in several places (Showcase sections, project service, Excel
export) every one of them was walking over empty arrays and producing
no user-visible output. Carrying the model forward only preserved dead
schema and dead UI.

Removed in this stream:

- `prisma/schema.prisma` — `Prize` model deleted, `Project.prizes`
  relation removed
- `prisma/migrations/20260421130000_drop_prize_table/` — drops the
  `Prize_project_id_fkey` constraint and the `Prize` table
- `server/services/projects.ts` — `include: { prizes: true }` removed
  from `getFilteredProjects` and `getProject`; commented-out
  `prizes: { create: ... }` blocks deleted from `createProject` /
  `updateProject`
- `server/services/exportShowcase.ts` — prize column removed from the
  Excel export; `ProjectExport.prizes` field removed
- `types/showcase.ts` — `prizes: ProjectPrize[]` removed from `Project`,
  `ProjectPrize` type deleted
- `components/showcase/sections/Prizes.tsx` — deleted
- `components/showcase/ProjectOverview.tsx` — `<Prizes />` render line
  and the import removed
- `components/showcase/sections/Info.tsx` — trophy-badge block that
  gated on `project.prizes.length > 1` removed

If public prize display comes back later, it should come back as a
deliberate product decision with its own schema, not as a revived empty
table.

## `Retro9000ReturningApplication`: removed

Audit summary: write-only table. One writer (`POST /api/retro9000-returning`),
zero readers anywhere in the app, form lived at
`/grants/retro9000returning`. HubSpot is the real CRM via the parallel
`POST /api/retro9000` route, so dropping the Prisma path does not lose
data capture.

Removed in this stream:

- `prisma/schema.prisma` — `Retro9000ReturningApplication` model
  deleted
- `prisma/migrations/20260421140000_drop_retro9000_returning_application/`
  — drops the table (indexes are dropped with it; no FKs pointed at
  this table)
- `app/api/retro9000-returning/route.ts` — deleted (sole
  `prisma.retro9000ReturningApplication.upsert` caller)
- `app/(home)/grants/retro9000returning/page.tsx` — deleted
- `types/retro9000ReturningForm.ts` — deleted (only the form page
  referenced it)

Out of scope and intentionally untouched:

- `app/api/retro9000/route.ts` — the HubSpot-only submission route is
  a separate flow and keeps working
- `components/evaluate/event-configs.ts` — Retro9000 evaluation config
  does not query the returning-application table
- external links in `components/navigation/*` point at the public
  `avax.network` Retro9000 site, not the deleted internal form

## `User` profile: typed and mandatory `x_handle` / `linkedin_url`

Twitter/X and LinkedIn handles were only represented inside the
untyped `social_media: String[]` array. GitHub and Telegram already
have their own typed columns (`github`, `telegram_user`), so promoting
these two to typed columns matches existing precedent and makes later
BH -> BI Builder sync less ambiguous.

Landed in this migration stream:

- `prisma/schema.prisma` — `User.x_handle` and `User.linkedin_url`,
  both nullable `String?` at the DB level (existing rows are null until
  users fill them in)
- `prisma/migrations/20260421120000_add_user_x_handle_and_linkedin_url/` —
  additive migration, two `ALTER TABLE` statements
- `types/extended-profile.ts` — `ExtendedProfile.x_handle` and
  `ExtendedProfile.linkedin_url`
- `server/services/profile/profile.service.ts` — read the fields in
  `getExtendedProfile`, pass them through in `updateExtendedProfile`,
  include them in the HubSpot sync call
- `server/services/hubspotUserData.ts` — new `x_handle` and
  `linkedin_url` entries on `UserDataForHubSpot` and the property map
  so they land as typed HubSpot properties instead of being merged into
  the generic `contact_othersocials` bucket
- `components/profile/components/hooks/useProfileForm.ts` — both fields
  are `z.string().min(1, ...)` in the zod schema (mandatory on the
  user-facing ProfileTab), included in form defaults, load, submit, and
  reset paths
- `components/profile/components/profile.tsx` — `X (Twitter) *` and
  `LinkedIn *` inputs next to `GitHub`, with the `*` marker signalling
  the mandatory requirement
- `lib/auth/authOptions.ts` and `server/services/submitProject.ts` —
  shim-stage `User` construction updated to include the new nullable
  fields so the full `User` type remains satisfiable

Enforcement lives at two levels so users cannot skip past it:

1. `components/login/BasicProfileSetup.tsx` — the onboarding modal
   that fires after Terms for new users now has `x_handle` and
   `linkedin_url` as `z.string().min(1, ...)`; both the "Save and
   close" and "Complete Profile" buttons route through
   `form.handleSubmit`, so neither can proceed until the fields are
   filled.
2. `components/login/LoginModalWrapper.tsx` — an authenticated-mount
   effect fetches `/api/profile/extended/[id]` and reopens
   `BasicProfileSetup` if `x_handle` or `linkedin_url` is still null.
   This catches three cases the first-time-user flow misses: users
   who dismissed the modal via ESC / overlay, users who predate the
   requirement, and users created via the older auth path that did
   not route through the basic-setup flow.

The two user-creation paths (`server/services/auth.ts` OAuth upsert
and `app/api/user/create-after-terms/route.ts` credentials flow)
intentionally keep creating rows with null `x_handle` and
`linkedin_url`. That is the only practical shape: OAuth does not
expose Twitter or LinkedIn, and credentials flow only has an email
and an OTP. The enforcement layer above closes the gap by forcing
the modal open until the fields are filled.

ProfileTab (`components/profile/components/profile.tsx`) independently
blocks `Save` until both fields are filled, so the full profile
editor stays consistent with the basic-setup modal.

Still intentionally deferred:

- parsing existing `social_media` entries to pre-populate `x_handle`
  and `linkedin_url`
- removing the `social_media` array entirely (not safe until the typed
  fields are populated)
- server-side validation on the profile update endpoint (would break
  legitimate partial updates like country-only edits; the UI is the
  enforcement surface)
- the legacy `components/profile/ProfileForm.tsx` is still behind the
  `new-profile-ui` feature flag (default `true`), so almost every user
  hits the new ProfileTab; the legacy form was left alone because it
  is on its way out
