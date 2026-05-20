# SPEEDRUN (team1-india) — implementation plan

Goal: deliver the SPEEDRUN spec with the smallest possible delta to the existing schema, event creation, and judging surfaces. Reuse existing components first; add new ones only when reuse hurts more than it helps.

> **Decisions locked in** (from review):
> 1. `team_name` is **server-derived as `project_name` on read** — no separate input, no schema column.
> 2. API keys are **per-hackathon** (revoking access to event A doesn't kill event B). PR #4203 does *not* fix this — it only adds project-visibility tiers on the existing endpoint and still relies on the single env-var key. Per-hackathon `ApiKey` table is still ours to build.
> 3. Referral links keep the **current opaque 5-char codes** generated against `user_id` + `team_id`. No format changes; no changes to `createReferralLink` or the resolver.
> 4. **Build on top of PR #4203**, don't fight it. PR #4203 adds `Project.visibility` (`private` / `semi-public` / `public`) and filters `/api/events/[id]/projects` accordingly. We extend that endpoint instead of creating a new `/api/v1/projects`.

---

## 0. Schema changes (what / why / reusable?)

Every schema change is justified for **future hackathons**, not just SPEEDRUN. Anything SPEEDRUN-specific goes into `Hackathon.content` JSON (no Prisma migration).

### Inside `Hackathon.content` JSON — no migration

These extend the existing `IDataContent` shape (`app/events/edit/initials.ts`). Editor surface: `components/hackathons/admin-panel/sections/General.tsx`.

| Field | Type | Why reusable |
|---|---|---|
| `submission_open` | ISO date | Current schema only has `submission_deadline`. Every hackathon benefits from an explicit open window instead of "always open until close". |
| `tech_stack_options` | `string[]` | Admin-defined stack tokens per event. Future events will want their own list (AI/ML event vs DeFi event). |
| `team_size_max` | `number` (default unbounded) | Many hackathons cap team size. SPEEDRUN uses 2; others will use 4/5. |
| `registration_mode` | `"full" \| "simple"` (default `"full"`) | SPEEDRUN wants a slimmed registration; the existing full form stays unchanged for legacy events. |
| `team_partner_enabled` | `boolean` | Turns on the Solo/Duo Partner picker block (independent of `registration_mode` so other events can opt in). |

### Prisma migration (one focused migration, three additions)

| Model.Field | Type | Why reusable |
|---|---|---|
| `Project.stack` | `String[] @default([])` | Spec needs a discrete multi-select stack filter; existing `tech_stack` is free-form `String?` and can't be filtered. Every gallery/explore feature in the future will want this. |
| `Member.visibility` | `Json? @default("{}")` | Per-member contact-visibility toggles for the public gallery (country/email/telegram/x/github). Orthogonal to `Project.visibility` from PR #4203 (project-level tier). JSON over five booleans so future fields (LinkedIn, Discord) don't need another migration. |
| `ApiKey` (new model) | `id`, `label`, `hashed_key`, `prefix`, `hackathon_id` (FK), `created_by` (FK→User), `created_at`, `revoked_at?`, `last_used_at?` | Partner keys with revocation, scoped per-hackathon. Replaces the single env-var `HACKATHON_PROJECTS_API_KEY` while keeping the env var as a fallback so PR #4203's test plan continues to pass. |

### Explicitly NOT changed

- `Project.team_name` — **dropped** from the migration. `team_name` is derived as `project_name` server-side on read.
- `User` model — `country`, `x_account`, `github_account`, `telegram_account` already exist; the spec's "pull user data from BuilderHub" maps to the existing `/api/profile/extended/[userId]` flow.
- `RegisterForm` — no new columns. Country lives on `User`.
- `ReferralAttribution` — unchanged. The existing flow already captures hard signups (`?ref=<code>` and manual "who referred you" picks). UTM-source tracking stays in PostHog; we don't duplicate it in our DB.
- `Project.is_winner` — already exists; reuse for the "Won" funnel column.
- `Project.visibility` — being added by PR #4203, not us. We consume it.
- `Hackathon` core columns (start_date/end_date/timezone) — unchanged.

---

## 1. Components — reuse vs new

### Reuse / modify (no new files)

| File | What changes |
|---|---|
| `components/hackathons/registration-form/RegistrationForm.tsx` | Branch on `hackathon.content.registration_mode`. In `"simple"` mode skip Step3 entirely and skip the founder/student/employee/web3-proficiency blocks. Add country-locked behavior (read-only after first save). |
| `components/hackathons/registration-form/RegisterFormStep1.tsx` | Add `x_account` field; surface `github_account` as required in simple mode (currently optional via `github_portfolio`). All four social fields prefill from `/api/profile/extended/[userId]` (already wired). |
| `components/hackathons/project-submission/components/SubmissionStep1.tsx` | Add `stack` multi-select fed by `hackathon.content.tech_stack_options` + free-text "other"; tighten `short_description` zod max to 280. (PR #4203 already adds the Visibility section here for project-level tiers — leave that intact.) |
| `components/hackathons/project-submission/components/MediaUploader.tsx` | Enforce 5 images / 5MB each / JPG\|PNG\|WebP only (currently more permissive). |
| `components/hackathons/project-submission/components/Members.tsx` | Append a "Visibility" cell with five toggles (country/email/telegram/x/github) per member, bound to `member.visibility` JSON. Each member edits only their own row. |
| `components/hackathons/project-submission/SubmissionWrapperSecure.tsx` | Pre-open: render existing `Count-down.tsx` and disable the form; post-close: render read-only view. Pull window from `content.submission_open`/`submission_deadline`. |
| `components/hackathons/admin-panel/sections/General.tsx` | Surface the new content fields (`submission_open`, `team_size_max`, `tech_stack_options`, `registration_mode`, `team_partner_enabled`). |
| `components/showcase/ShowCaseCard.tsx` | Accept a `mode: "internal" \| "public"` prop. In `"public"` mode: no role gate, show stack/country/team_type filters + sort dropdown, hide export. Card already renders screenshot/name/tracks/short_description; add stack badges and an opted-in member-contact section. Team name on the card is just `project_name`. |
| `components/referrals/ReferralLinkGenerator.tsx` | Reuse as-is on the participant dashboard. URL stays `?ref=<code>`. |
| `hooks/use-utm-preservation.ts` | **No changes.** Existing UTM preservation across OAuth keeps PostHog wired; we do not write UTMs into our DB. |
| `server/services/projects.ts` | Extend `GetProjectOptions` with `stack`, `country`, `team_type`, `sort`, `cursor`, `limit`. Add a `scope: "public" \| "internal"` mode that strips hidden contact fields per `Member.visibility`. Read `team_name` as `project_name` (derived in the mapping layer). |
| `server/services/referrals.ts` | **No changes** — `?ref=<code>` and manual referrer picks already produce hard-signup attribution rows. |
| `app/api/register-form/route.ts` | Enforce `team_size_max`; reject country edits when the user already has any `RegisterForm` row (server-side country lock); auto-create a `Member`-equivalent placeholder row for the invited teammate (status `Pending Confirmation`). |
| `app/api/profile/extended/[userId]/route.ts` | Reject `country` updates when the user has any RegisterForm — country lock is global, not per-event, per spec ("locked after registration"). |
| `lib/auth/permissions.ts` | `verifyHackathonProjectsApiKey` becomes async and accepts a `hackathonId`. First checks the new `ApiKey` table (hashed compare, scoped to `hackathon_id`, updates `last_used_at`); falls back to the env var so PR #4203's test plan still works. |
| `app/api/events/[id]/projects/route.ts` | Extend the external-scope branch (PR #4203's filtered output) with SPEEDRUN filters: `country`, `stack`, `team_type`, `sort`, `cursor`, `limit`. Honor `Member.visibility` when emitting member contact fields (returns `null` for hidden fields, per spec). |
| `app/(home)/showcase/page.tsx` | Existing internal showcase stays gated. A new public route reuses the same component — see new files below. |

### Lazy teammate auto-conversion (no cron)

Spec: "If the teammate hasn't confirmed by the time registration closes, the team auto-converts to Solo." Implementation: lazy. When the submission form loads (or any team-read happens after `registration_deadline`), if the teammate's `Member.status === "Pending Confirmation"`, mark it `Removed` and proceed solo. Avoids a scheduled job. Justified: every other path through the team is already a write boundary.

### New components / files (each justified)

| New file | Why a new file is needed |
|---|---|
| `components/hackathons/registration-form/TeamPartnerInput.tsx` | The existing `Members` component is project-scoped — it expects a `project_id` and talks to `/api/project/[id]/members`. Registration happens before a project exists, so we can't reuse it directly. This sub-component handles the Solo/Duo toggle + teammate handle/email lookup. ~100 lines. |
| `components/hackathons/admin-panel/sections/ReferralFunnel.tsx` | No existing UI aggregates Source × (Registered/Submitted/Won). Aggregation runs over `ReferralAttribution` joined with `RegisterForm`/`Project`. |
| `components/hackathons/admin-panel/sections/ApiKeyManager.tsx` | No existing UI manages API keys. Lists, creates (one-time secret display), revokes. |
| `app/(home)/hackathons/[id]/gallery/page.tsx` | Public route, no auth required. Renders `<ShowCaseCard mode="public" />`. Separate from `/showcase` because that route is permission-gated and we don't want to weaken its guards. |
| `app/(home)/hackathons/[id]/admin-panel/referrals/page.tsx` | Hosts `ReferralFunnel`. |
| `app/(home)/hackathons/[id]/admin-panel/api-keys/page.tsx` | Hosts `ApiKeyManager`. |
| `app/api/admin/api-keys/route.ts` (+ `[id]/route.ts`) | CRUD for the new `ApiKey` table; admin-only, scoped per-hackathon. |
| `app/api/admin/referral-funnel/route.ts` | Returns the funnel matrix for the admin UI; filters by event + date range. |
| `prisma/migrations/<ts>_speedrun/migration.sql` | Single migration: `Project.stack`, `Member.visibility`, `ApiKey` model. |

### Components / endpoints explicitly NOT being built

- **No new `/api/v1/projects` route.** We extend `/api/events/[id]/projects` (PR #4203 already shapes the external response). Per-hackathon endpoint + per-hackathon API keys is a clean mapping.
- **No new `team_name` column.** Derived from `project_name` on read.
- **No new "team" model.** SPEEDRUN's team is an existing `Project` row with 1-2 `Member` rows (status `Pending Confirmation` → `Confirmed`). The `User.team_id` field is unrelated (Builder Hub team membership) and stays untouched.
- **No new judging surface.** Winners use `Project.is_winner` (already wired into `/api/projects/[id]/winner` and the existing judge tooling).
- **No new tracks model.** Tracks come from `Hackathon.content.tracks` (already an admin-editable list).
- **No UTM writes to our DB.** PostHog already covers source/medium/campaign analysis.

---

## 2. Implementation order

### Phase 1 — Registration + Submission + Referral tracking

- [ ] **1.1 Schema migration** — add `Project.stack`, `Member.visibility`, `ApiKey` model. Schema-only with `IF EXISTS` guards (per `feedback_data_ops_outside_repo.md`). Sequence after PR #4203's migration so `Project.visibility` is already in place.
- [ ] **1.2 Admin content fields** — extend `IDataContent` typing + `General.tsx` editor with `submission_open`, `team_size_max`, `tech_stack_options`, `registration_mode`, `team_partner_enabled`. Defaults preserve current behavior for existing events.
- [ ] **1.3 Registration form** — branch on `registration_mode`, add X handle field, country-locked behavior. Build `TeamPartnerInput.tsx`.
- [ ] **1.4 Register-form API** — enforce `team_size_max`, country lock, create pending-teammate Member rows. Referral attribution already wired.
- [ ] **1.5 Profile API** — reject country update when user has any `RegisterForm` row.
- [ ] **1.6 Submission form** — stack multi-select, 280-char limit, MediaUploader constraints, lazy teammate auto-conversion to solo, per-member visibility toggles in `Members.tsx`. Coexist with PR #4203's project-visibility section.
- [ ] **1.7 Submission window enforcement** — countdown before open, locked read-only after close in `SubmissionWrapperSecure`.
- [ ] **1.8 Admin referral funnel** — `ReferralFunnel.tsx` + `/api/admin/referral-funnel`. Rows = referring users (resolved from `ReferralAttribution.referral_link_id` → owner user, or `user_id_referrer` for manual picks). Stages: Registered (RegisterForm exists for the event), Submitted (Project exists with `hackaton_id` matching, member rows confirmed), Won (`Project.is_winner = true`).

### Phase 2 — Gallery + API

- [ ] **2.1 Public gallery route** — `app/(home)/hackathons/[id]/gallery/page.tsx`, no auth.
- [ ] **2.2 `ShowCaseCard` public mode** — `mode` prop, new filters (track/stack/country/team_type), sort dropdown, stack badges on cards, opted-in contact section.
- [ ] **2.3 `getFilteredProjects` extension** — `stack`, `country`, `team_type`, `sort`, `cursor`, `limit`, `scope: "public" | "internal"` (strips hidden fields).
- [ ] **2.4 `ApiKey` admin UI** — `ApiKeyManager.tsx` + `/api/admin/api-keys` routes. Show secret exactly once on creation; store hash + prefix.
- [ ] **2.5 `/api/events/[id]/projects` extensions** — add SPEEDRUN query params, cursor pagination, per-member visibility honoring. Bearer auth via `verifyHackathonProjectsApiKey` now hits the `ApiKey` table (env-var fallback intact).

---

## 3. Open questions

_(All resolved as of latest review — none remaining.)_

---

## 4. Review (filled in after implementation)

_TBD_
