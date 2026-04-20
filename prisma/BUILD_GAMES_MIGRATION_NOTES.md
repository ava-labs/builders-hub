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

## `Retro9000ReturningApplication`: being removed in a follow-up commit

Audit summary: write-only table. One writer (`POST /api/retro9000-returning`),
zero readers anywhere in the app, form lives at
`/grants/retro9000returning`. HubSpot is the real CRM via the parallel
`POST /api/retro9000` route, so dropping the Prisma path does not lose
data capture.

This entry will be updated with the exact commit reference once the
removal lands. Planned removal covers:

1. `prisma/schema.prisma` — drop the model
2. new migration — `DROP TABLE "Retro9000ReturningApplication"`
3. `app/api/retro9000-returning/route.ts` — delete the route
4. `app/(home)/grants/retro9000returning/page.tsx` — delete the form
5. any link/nav references that pointed at the internal form

The `/api/retro9000` HubSpot-only route stays untouched.

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

Rollout nuance: existing users whose `x_handle` or `linkedin_url` are
null will be prompted by the form on their next profile edit. The
server accepts updates without the fields (so legacy callers do not
break), but the ProfileTab form will block `Save` until both are
filled. This gives us a natural backfill path without writing a
one-shot migration over existing `social_media` URLs.

Still intentionally deferred:

- parsing existing `social_media` entries to pre-populate `x_handle`
  and `linkedin_url`
- removing the `social_media` array entirely (not safe until the typed
  fields are populated)
- the legacy `components/profile/ProfileForm.tsx` is still behind the
  `new-profile-ui` feature flag (default `true`), so almost every user
  hits the new ProfileTab; the legacy form was left alone because it
  is on its way out
