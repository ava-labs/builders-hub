# Plan — Top Traffic Sources per Hackathon (PostHog-driven)

**Branch:** `feat/builder-insights-improved-utm`
**Owner of execution:** PostHog-connected agent (this doc is the brief)
**BH-side scope:** ~30 lines of code; everything else lives in PostHog.

---

## Goal

For every hackathon, show the **top 3 traffic sources** that brought registrants/visitors to the event page, surfaced on the event history page (`/hackathons/[id]` admin/devrel view).

Granularity goal:
- Hard campaigns (paid/intentional) → bucketed by `utm_source` + `utm_campaign`
- Organic social → bucketed by **specific account** (e.g. `@avalancheavax` on X, not just "twitter.com")
- Owned-property navigation → bucketed as "BuildersHub banner" / "BuildersHub homepage"
- Direct / unknown → bucketed as "Direct"

**Out of scope (already shipped):** the hard-UTM referral-code flow (`utm_source=referral&utm_medium=user&utm_content=<handle>`) used for user-to-user referral links. That logic lives in `hooks/useTrackNewUser.ts` + `ReferralAttribution` table and must not be touched.

---

## Why PostHog (not BH DB)

PostHog already auto-captures the data we need on every `$pageview`:
- `properties.utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`
- `properties.$referrer` (full URL the visitor came from — e.g. `https://x.com/avalancheavax/status/123…`)
- `properties.$referring_domain` (e.g. `x.com`, `twitter.com`, `linkedin.com`)
- `properties.$initial_referrer` / `properties.$initial_referring_domain` (first touch on the session)
- `properties.$pathname` / `properties.$host`

We already have a HogQL pipeline in this repo (`lib/posthog-query.ts` + `server/services/builderInsights.ts`) that powers the Builder Insights dashboard. We can extend it with a single new query function and surface results in the existing event-history admin view.

**No new BH tables, no migrations, no schema changes.**

---

## Existing primitives we'll reuse

| Concern | File | What it gives us |
| --- | --- | --- |
| Run HogQL from the server | `lib/posthog-query.ts` (`runHogQL`) | Typed query → rows, swallows errors, returns `[]` on failure so the page still renders |
| Env wiring | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` (already in prod env) | No new secrets needed |
| Host filter pattern | `HOGQL_HOST_FILTER` in `builderInsights.ts` | Reuse to scope queries to `build.avax.network` |
| Auto-captured props | PostHog SDK already initialised in `app/providers.js` | UTM + `$referrer` already collected — no new client code needed for organic traffic |

---

## Step 1 — Minimal BH-side enrichment (≈30 LOC)

Hackathon pages today live at `/hackathons/[id]`. The `id` is in the path, so PostHog *can* filter by `$pathname` alone, but the UX is much cleaner if we register two extra properties on hackathon pageviews:

- `hackathon_id` (string, the DB id)
- `hackathon_slug` (string, the human-readable slug for dashboard labels)

**Where to add it:**
- `app/(home)/hackathons/[id]/page.tsx` — server component that already resolves the hackathon. Pass `id` + `slug` to a small client component (e.g. `<HackathonPageviewTag id={…} slug={…} />`) that calls `posthog.register({ hackathon_id, hackathon_slug })` once on mount. Use `register` (sticky on the session), not `capture` — this attaches the property to every event the visitor fires while on the page, including the auto-`$pageview`.
- Same treatment on `/hackathons/registration-form` if the URL carries a `?hackathon_id` (or wherever the registration page resolves which hackathon it belongs to).

That's the entire BH-side delta.

---

## Step 2 — PostHog: bucketing logic for "source"

**Channel-mix only.** X (t.co) and LinkedIn strip the originating tweet/post
from the Referer header, so organic social can only be attributed at the
channel level. UTM-tagged links keep full granularity via the first branch
(use `utm_content` for the poster handle).

```sql
multiIf(
  -- 1. Explicit UTM campaign wins — gives per-poster granularity via utm_content
  notEmpty(properties.utm_source),
    concat(properties.utm_source, ' / ', coalesce(properties.utm_campaign, '(no campaign)')),

  -- 2. Organic social — channel only, no handle extraction
  properties.$referring_domain IN ('x.com', 'twitter.com', 't.co'),
    'X (untagged)',

  properties.$referring_domain = 'linkedin.com' OR properties.$referring_domain LIKE '%.linkedin.com',
    'LinkedIn (untagged)',

  properties.$referring_domain IN ('youtube.com', 'www.youtube.com', 'youtu.be'),
    'YouTube',

  properties.$referring_domain IN ('discord.com', 'discord.gg'),
    'Discord',

  properties.$referring_domain LIKE '%t.me',
    'Telegram',

  -- 3. Internal navigation
  properties.$referring_domain IN ('build.avax.network', 'www.build.avax.network'),
    'BuildersHub (internal)',

  -- 4. Other known referrers — keep the domain
  notEmpty(properties.$referring_domain),
    properties.$referring_domain,

  -- 5. No referrer at all
  'Direct'
)
```

Per-poster granularity (Insight A sub-breakdown): when `utm_source` is set,
group by `utm_content` to get the per-team-member leaderboard.

---

## Step 3 — PostHog: Insights to build

Build three Insights in the **BuildersHub** project (id `88909`, dashboard `1545918`). Save each one and capture the **short_id** so we can either embed or query them.

### Insight A — "Top 3 traffic sources per hackathon (last 90d)"

```sql
SELECT
  properties.hackathon_slug AS hackathon,
  /* bucketing expression from Step 2 */  AS source_bucket,
  count(DISTINCT distinct_id) AS visitors,
  countIf(event = '$pageview' AND properties.$pathname LIKE '%/registration-form%') AS reached_register_step
FROM events
WHERE event = '$pageview'
  AND properties.$host IN ('build.avax.network', 'www.build.avax.network')
  AND notEmpty(properties.hackathon_slug)
  AND timestamp >= now() - INTERVAL 90 DAY
GROUP BY hackathon, source_bucket
ORDER BY hackathon, visitors DESC
```

### Insight B — Per-hackathon drill-down (used by the BH page)

Same query as A, but takes `{hackathon_id}` as a HogQL parameter and `LIMIT 3` after `ORDER BY visitors DESC`. The BH page calls this one.

### Insight C — Dashboard tile

Add to dashboard `1545918`: stacked bar chart of `source_bucket` per `hackathon_slug` for the last 30d. This is the at-a-glance DevRel view.

---

## Step 4 — BH-side query + UI

Add to `server/services/builderInsights.ts` (or a new file `server/services/hackathonTrafficSources.ts`):

```ts
export interface HackathonTrafficSource {
  source: string;
  visitors: number;
  reachedRegister: number;
}

export async function getTopHackathonTrafficSources(
  hackathonId: string,
): Promise<HackathonTrafficSource[]> {
  return runHogQL<HackathonTrafficSource>({
    projectId: process.env.POSTHOG_PROJECT_ID,
    query: `
      SELECT
        ${SOURCE_BUCKET_EXPR} AS source,
        count(DISTINCT distinct_id) AS visitors,
        countIf(properties.$pathname LIKE '%/registration-form%') AS reachedRegister
      FROM events
      WHERE event = '$pageview'
        AND properties.$host IN ('build.avax.network', 'www.build.avax.network')
        AND properties.hackathon_id = '${hackathonId.replace(/'/g, "''")}'
        AND timestamp >= now() - INTERVAL 90 DAY
      GROUP BY source
      ORDER BY visitors DESC
      LIMIT 3
    `,
  });
}
```

Render under the existing admin/devrel panel for a hackathon (`app/(home)/hackathons/[id]/admin-panel/page.tsx`) as a small "Top traffic sources" card with three rows: source label, visitor count, % that hit the registration step.

---

## Step 5 — Validation

1. Deploy Step 1 (property enrichment) to staging.
2. Verify in PostHog **Activity** that `$pageview` events from a hackathon page now carry `hackathon_id` + `hackathon_slug`.
3. Run Insight A in PostHog. Confirm:
   - At least one row per active hackathon
   - X.com referrers show actual handles (test by sharing a staging link from a tweet)
   - LinkedIn referrers show the company/post slug
   - Internal banner clicks bucket under `BuildersHub / <path>`
4. Wire the BH-side card. Smoke-test on `/hackathons/<id>/admin-panel` as a devrel user.
5. Backfill check: PostHog already has 90d of `$pageview` history with `$referrer` captured, so even hackathons without the new `hackathon_id` property can be matched by `properties.$pathname LIKE '/hackathons/<id>%'` as a fallback. Add an `OR` branch to the WHERE clause for that fallback so old data still attributes.

---

## Open questions for the PostHog agent

1. ~~Is `extract(...)` available?~~ ✅ Confirmed working — but no longer needed since we dropped handle extraction.
2. ~~Is `$referrer_pathname` materialised?~~ ❌ Not materialised in project 88909. Also no longer needed.
3. Should "BuildersHub (internal)" be split further (homepage hero vs. nav menu vs. sidebar)? Deferred — needs a `posthog.capture('banner_clicked', { cta_location })` hook on the homepage banner. Separate PR.
4. Time-window toggle: ship v1 with a fixed 90d window. Toggle can come later.

## UTM convention for outbound shares

Lock these in so the dashboard groups consistently:

| Field          | Values                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| `utm_source`   | `x` / `linkedin` / `telegram` / `discord` / `youtube` / `newsletter`         |
| `utm_medium`   | `social` / `dm` / `email` / `talk`                                           |
| `utm_campaign` | `<hackathon-slug>` — always the slug, never freeform                         |
| `utm_content`  | poster handle (lowercase, no `@`) — e.g. `nicolas-arnedo`, `owen-w`          |

Per-poster leaderboard falls out for free: in Insight A, when `utm_source` is
set, sub-group by `utm_content`.

---

## What we are explicitly NOT doing

- Not touching `ReferralAttribution` / `ReferralLink` tables or the `useTrackNewUser` flow.
- Not adding new Prisma columns or migrations.
- Not building a per-user dashboard view for source tracking (admin-only for v1).
- Not adding click-time instrumentation on the homepage banner (deferred — see open Q 3).

---

## Commit boundary

This branch should land as **two PRs**:

1. **BH-side** (`feat/builder-insights-improved-utm`): the `hackathon_id` / `hackathon_slug` property registration + the `getTopHackathonTrafficSources` service + the admin-panel card.
2. **PostHog-side** (no code in this repo): the saved Insights + dashboard tile, owned by the PostHog agent.

The two ship independently. The BH PR fails gracefully (empty card) if PostHog hasn't been configured yet, matching the existing `runHogQL` contract.
