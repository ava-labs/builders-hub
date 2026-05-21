import { runHogQL } from "@/lib/posthog-query";

const POSTHOG_BUILDER_HUB_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

const HOGQL_HOST_FILTER =
  "properties.$host IN ('build.avax.network', 'www.build.avax.network')";

/**
 * HogQL expression that buckets every pageview into a single `source` string.
 * Priority: explicit UTM → specific social account → other known referrer →
 * BuildersHub internal → bare domain → "Direct".
 */
const SOURCE_BUCKET_EXPR = `
  multiIf(
    notEmpty(properties.utm_source),
      concat(properties.utm_source, ' / ', coalesce(properties.utm_campaign, '(no campaign)')),
    properties.$referring_domain IN ('x.com', 'twitter.com', 't.co'),
      concat('X / ', coalesce(extract(properties.$referrer, 'https?://(?:www\\\\.)?(?:x|twitter)\\\\.com/([^/?#]+)'), '(unknown handle)')),
    properties.$referring_domain = 'linkedin.com'
      OR endsWith(properties.$referring_domain, '.linkedin.com'),
      concat('LinkedIn / ', coalesce(extract(properties.$referrer, 'linkedin\\\\.com/(?:company|in|posts|feed/update)/([^/?#]+)'), '(unknown page)')),
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

/**
 * Top traffic sources for a single hackathon, derived from PostHog `$pageview`
 * events. Returns at most `limit` rows ordered by unique visitors desc.
 *
 * Matches events either by the new sticky `hackathon_id` property OR by URL
 * pattern (`/hackathons/<id>...`), so attribution still works for traffic that
 * arrived before the property-enrichment shipped.
 *
 * Never throws — returns [] on missing config or any error, matching the
 * `runHogQL` contract.
 */
export async function getTopHackathonTrafficSources(
  hackathonId: string,
  { days = 90, limit = 3 }: TopTrafficSourcesOptions = {},
): Promise<HackathonTrafficSource[]> {
  if (!isSafeHackathonId(hackathonId)) return [];

  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));

  const query = `
    SELECT
      ${SOURCE_BUCKET_EXPR} AS source,
      count(DISTINCT distinct_id) AS visitors,
      countIf(properties.$pathname LIKE '%/registration-form%') AS reachedRegister
    FROM events
    WHERE event = '$pageview'
      AND ${HOGQL_HOST_FILTER}
      AND (
        properties.hackathon_id = '${hackathonId}'
        OR properties.$pathname LIKE '/hackathons/${hackathonId}%'
      )
      AND timestamp >= now() - INTERVAL ${safeDays} DAY
    GROUP BY source
    ORDER BY visitors DESC
    LIMIT ${safeLimit}
  `.trim();

  const rows = await runHogQL<RawRow>({
    projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
    query,
  });

  return rows.map((row) => ({
    source: row.source ?? "Direct",
    visitors: toNumber(row.visitors),
    reachedRegister: toNumber(row.reachedRegister),
  }));
}
