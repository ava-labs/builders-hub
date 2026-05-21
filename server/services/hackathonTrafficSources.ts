import { runHogQL } from "@/lib/posthog-query";

const POSTHOG_BUILDER_HUB_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

const HOGQL_HOST_FILTER =
  "properties.$host IN ('build.avax.network', 'www.build.avax.network')";

/**
 * HogQL expression that buckets every pageview into a single `source` string.
 *
 * Channel-mix only — no handle/page extraction. X (t.co) and LinkedIn strip
 * the originating tweet/post from the Referer header, so organic social can
 * only be attributed at the channel level. UTM-tagged links keep full
 * granularity via the first branch (use utm_content for the poster handle).
 *
 * Priority: explicit UTM (excluding PostHog's '$direct' sentinel) →
 * sign-in/OAuth redirects → broad channel → bare domain → "Direct".
 */
const SOURCE_BUCKET_EXPR = `
  multiIf(
    notEmpty(properties.utm_source) AND properties.utm_source != '$direct',
      concat(properties.utm_source, ' / ', coalesce(properties.utm_campaign, '(no campaign)')),
    properties.$referring_domain IN (
      'accounts.google.com', 'login.microsoftonline.com', 'github.com'
    ),
      'Sign-in redirect',
    properties.$referring_domain IN ('x.com', 'twitter.com', 't.co'),
      'X (untagged)',
    properties.$referring_domain = 'linkedin.com'
      OR endsWith(properties.$referring_domain, '.linkedin.com'),
      'LinkedIn (untagged)',
    properties.$referring_domain IN ('youtube.com', 'www.youtube.com', 'youtu.be'),
      'YouTube',
    properties.$referring_domain IN ('discord.com', 'discord.gg'),
      'Discord',
    endsWith(properties.$referring_domain, 't.me'),
      'Telegram',
    properties.$referring_domain IN ('build.avax.network', 'www.build.avax.network'),
      'BuildersHub (internal)',
    notEmpty(properties.$referring_domain),
      properties.$referring_domain,
    'Direct'
  )
`.trim();

export interface HackathonTrafficSource {
  source: string;
  visitors: number;
  reachedRegister: number;
}

interface RawRow {
  source: string;
  visitors: number | string | null;
  reachedRegister: number | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value) || 0;
}

/**
 * UUIDs only. Hackathon ids in this codebase are uuid v4 (see prisma/schema.prisma),
 * so we restrict to that shape rather than escape-quoting. Anything else returns
 * an empty result rather than risk a query injection through PostHog.
 */
function isSafeHackathonId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export interface TopTrafficSourcesOptions {
  /** Lookback window in days. Default 90. */
  days?: number;
  /** Number of source buckets to return. Default 3. */
  limit?: number;
}

interface BatchRow extends RawRow {
  hackathon_id: string | null;
}

/**
 * Batched variant — top-N traffic sources for a list of hackathons in a single
 * HogQL query. Used by the Builder Insights event-history view where we'd
 * otherwise make one HTTP roundtrip per row. Returns a map keyed by
 * hackathonId; events missing from the result are returned as empty arrays.
 */
export async function getTopHackathonTrafficSourcesBatch(
  hackathonIds: string[],
  { days = 90, limit = 3 }: TopTrafficSourcesOptions = {},
): Promise<Map<string, HackathonTrafficSource[]>> {
  const safeIds = Array.from(new Set(hackathonIds.filter(isSafeHackathonId)));
  const result = new Map<string, HackathonTrafficSource[]>();
  for (const id of safeIds) result.set(id, []);
  if (safeIds.length === 0) return result;

  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const idList = safeIds.map((id) => `'${id}'`).join(", ");

  // `LIMIT N BY column` is ClickHouse syntax: keep the first N rows per group
  // after ORDER BY. Gives top-N per hackathon in one query.
  const query = `
    SELECT
      coalesce(
        nullIf(properties.hackathon_id, ''),
        extract(properties.$pathname, '^/hackathons/([a-fA-F0-9-]{36})')
      ) AS hackathon_id,
      ${SOURCE_BUCKET_EXPR} AS source,
      count(DISTINCT distinct_id) AS visitors,
      countIf(properties.$pathname LIKE '%/registration-form%') AS reachedRegister
    FROM events
    WHERE event = '$pageview'
      AND ${HOGQL_HOST_FILTER}
      AND timestamp >= now() - INTERVAL ${safeDays} DAY
      AND coalesce(
        nullIf(properties.hackathon_id, ''),
        extract(properties.$pathname, '^/hackathons/([a-fA-F0-9-]{36})')
      ) IN (${idList})
    GROUP BY hackathon_id, source
    ORDER BY hackathon_id, visitors DESC
    LIMIT ${safeLimit} BY hackathon_id
  `.trim();

  const rows = await runHogQL<BatchRow>({
    projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
    query,
  });

  for (const row of rows) {
    if (!row.hackathon_id) continue;
    const bucket = result.get(row.hackathon_id);
    if (!bucket) continue;
    bucket.push({
      source: row.source ?? "Direct",
      visitors: toNumber(row.visitors),
      reachedRegister: toNumber(row.reachedRegister),
    });
  }

  return result;
}
