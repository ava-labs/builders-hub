import { prisma } from "@/prisma/prisma";
import { listReferralLinksForUser } from "./referrals";
import {
  ACTIVE_GRANT_TARGETS,
  BUILDER_HUB_SIGNUP_TARGET,
  type ReferralTargetPreset,
} from "@/lib/referrals/targets";
import { runHogQL } from "@/lib/posthog-query";
import { REFERRAL_TEAM_LABELS } from "@/lib/referrals/team-labels";

export interface MonthlySignupPoint {
  month: string;
  signups: number;
  cumulative: number;
}

export interface MonthlyVisitPoint {
  month: string;
  visitors: number;
}

export interface ReferrerSignupPoint {
  referrerId: string;
  referrer: string;
  signups: number;
}

export interface EventParticipantPoint {
  eventId: string;
  event: string;
  participants: number;
  projects: number;
}

export interface TopReferrerRow {
  referrerId: string;
  referrer: string;
  teamId: string | null;
  team: string;
  country: string | null;
  builderHubSignups: number;
  eventRegistrations: number;
  hackathonRegistrations: number;
  grantApplications: number;
  totalReferrals: number;
}

export interface TopTeamReferrerRow {
  teamId: string;
  team: string;
  builderHubSignups: number;
  eventRegistrations: number;
  hackathonRegistrations: number;
  grantApplications: number;
  totalReferrals: number;
}

export interface BuilderInsightsData {
  totalAccounts: number;
  userGeneratedReferralImpact: number;
  latest30DaySignups: number;
  previous30DaySignups: number;
  rollingSignupDeltaPercent: number;
  latest30DayVisits: number;
  previous30DayVisits: number;
  rollingVisitsDeltaPercent: number;
  consoleUsers30d: number;
  consoleUsersDeltaPercent: number;
  totalHackathonSubmissions: number;
  topCountry30d: { country: string; countryCode: string | null; sharePct: number } | null;
  returningVisitorPct30d: number;
  returningVisitorDeltaPercent: number;
  monthlySignups: MonthlySignupPoint[];
  monthlyVisits: MonthlyVisitPoint[];
  monthlyConsoleUsers: MonthlyVisitPoint[];
  signupsByReferrer: ReferrerSignupPoint[];
  eventParticipants: EventParticipantPoint[];
  topReferrers: TopReferrerRow[];
  topTeamReferrers: TopTeamReferrerRow[];
  referralTargets: ReferralTargetPreset[];
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function formatMonth(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 7);
}

function getEventStatus(startDate: Date, endDate: Date): string {
  const now = Date.now();
  if (startDate.getTime() <= now && endDate.getTime() >= now) return "Active";
  return "Upcoming";
}

function formatTeamLabel(teamId: string): string {
  return REFERRAL_TEAM_LABELS[teamId] ?? teamId;
}

function getReferrerTeamLabel(teamId: string | null): string {
  return teamId ? formatTeamLabel(teamId) : "Community";
}

const POSTHOG_BUILDER_HUB_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

const HOGQL_HOST_FILTER = "properties.$host IN ('build.avax.network', 'www.build.avax.network')";

const ROLLING_VISITS_HOGQL = `
  SELECT
    countDistinctIf(distinct_id, timestamp >= now() - INTERVAL 30 DAY) AS latest,
    countDistinctIf(
      distinct_id,
      timestamp >= now() - INTERVAL 60 DAY
        AND timestamp < now() - INTERVAL 30 DAY
    ) AS previous
  FROM events
  WHERE event = '$pageview'
    AND ${HOGQL_HOST_FILTER}
    AND timestamp >= now() - INTERVAL 60 DAY
`.trim();

const MONTHLY_VISITS_HOGQL = `
  SELECT
    toStartOfMonth(timestamp) AS month,
    count(DISTINCT distinct_id) AS visitors
  FROM events
  WHERE event = '$pageview'
    AND ${HOGQL_HOST_FILTER}
    AND timestamp >= now() - INTERVAL 12 MONTH
  GROUP BY month
  ORDER BY month ASC
`.trim();

const MONTHLY_CONSOLE_USERS_HOGQL = `
  SELECT
    toStartOfMonth(timestamp) AS month,
    count(DISTINCT distinct_id) AS users
  FROM events
  WHERE event = '$pageview'
    AND ${HOGQL_HOST_FILTER}
    AND startsWith(properties.$pathname, '/console')
    AND timestamp >= now() - INTERVAL 12 MONTH
  GROUP BY month
  ORDER BY month ASC
`.trim();

const CONSOLE_USERS_ROLLING_HOGQL = `
  SELECT
    countDistinctIf(distinct_id, timestamp >= now() - INTERVAL 30 DAY) AS latest,
    countDistinctIf(
      distinct_id,
      timestamp >= now() - INTERVAL 60 DAY
        AND timestamp < now() - INTERVAL 30 DAY
    ) AS previous
  FROM events
  WHERE event = '$pageview'
    AND ${HOGQL_HOST_FILTER}
    AND startsWith(properties.$pathname, '/console')
    AND timestamp >= now() - INTERVAL 60 DAY
`.trim();

const TOP_COUNTRY_30D_HOGQL = `
  SELECT
    properties.$geoip_country_name AS country,
    properties.$geoip_country_code AS country_code,
    count(DISTINCT distinct_id) AS visitors
  FROM events
  WHERE event = '$pageview'
    AND ${HOGQL_HOST_FILTER}
    AND timestamp >= now() - INTERVAL 30 DAY
    AND notEmpty(properties.$geoip_country_name)
  GROUP BY country, country_code
  ORDER BY visitors DESC
  LIMIT 1
`.trim();

const RETURNING_VISITORS_HOGQL = `
  SELECT
    countDistinctIf(distinct_id, timestamp >= now() - INTERVAL 30 DAY) AS total_current,
    countDistinctIf(
      distinct_id,
      timestamp >= now() - INTERVAL 60 DAY
        AND timestamp < now() - INTERVAL 30 DAY
    ) AS total_previous,
    countDistinctIf(
      distinct_id,
      timestamp >= now() - INTERVAL 30 DAY
        AND distinct_id IN (
          SELECT DISTINCT distinct_id
          FROM events
          WHERE event = '$pageview'
            AND ${HOGQL_HOST_FILTER}
            AND timestamp < now() - INTERVAL 30 DAY
        )
    ) AS returning_current,
    countDistinctIf(
      distinct_id,
      timestamp >= now() - INTERVAL 60 DAY
        AND timestamp < now() - INTERVAL 30 DAY
        AND distinct_id IN (
          SELECT DISTINCT distinct_id
          FROM events
          WHERE event = '$pageview'
            AND ${HOGQL_HOST_FILTER}
            AND timestamp < now() - INTERVAL 60 DAY
        )
    ) AS returning_previous
  FROM events
  WHERE event = '$pageview'
    AND ${HOGQL_HOST_FILTER}
    AND timestamp >= now() - INTERVAL 60 DAY
`.trim();

export async function getBuilderInsightsData(currentUserId: string): Promise<BuilderInsightsData> {
  const [
    totalAccounts,
    monthlyRows,
    rollingSignupRows,
    referrerRows,
    eventParticipantRows,
    userGeneratedRows,
    activeEventRows,
    topReferrerRows,
    topTeamReferrerRows,
    rollingVisitsRows,
    monthlyVisitsRows,
    consoleUsersRows,
    monthlyConsoleUsersRows,
    totalHackathonSubmissions,
    topCountryRows,
    returningVisitorsRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.$queryRaw<Array<{ month: Date; signups: bigint }>>`
      SELECT date_trunc('month', "created_at")::date AS "month", COUNT(*)::bigint AS "signups"
      FROM "User"
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ latest30Days: bigint; previous30Days: bigint }>>`
      SELECT
        COUNT(*) FILTER (
          WHERE "created_at" >= NOW() - INTERVAL '30 days'
        )::bigint AS "latest30Days",
        COUNT(*) FILTER (
          WHERE "created_at" < NOW() - INTERVAL '30 days'
            AND "created_at" >= NOW() - INTERVAL '60 days'
        )::bigint AS "previous30Days"
      FROM "User"
    `,
    prisma.$queryRaw<Array<{ referrerId: string; referrer: string | null; signups: bigint }>>`
      SELECT owner."id" AS "referrerId",
             COALESCE(NULLIF(owner."name", ''), owner."email", 'Unknown') AS "referrer",
             COUNT(*)::bigint AS "signups"
      FROM "ReferralAttribution" attribution
      INNER JOIN "User" owner ON owner."id" = attribution."user_id_referrer"
      WHERE attribution."target_type" = 'bh_signup'
      GROUP BY owner."id", owner."name", owner."email"
      ORDER BY "signups" DESC
      LIMIT 20
    `,
    prisma.$queryRaw<
      Array<{ eventId: string; event: string; participants: bigint; projects: bigint }>
    >`
      WITH event_participants AS (
        SELECT h."id" AS "eventId",
               h."title" AS "event",
               h."start_date" AS "startDate",
               COUNT(DISTINCT u."id")::bigint AS "participants",
               COUNT(DISTINCT p."id")::bigint AS "projects"
        FROM "Hackathon" h
        INNER JOIN "Project" p ON p."hackaton_id" = h."id"
        INNER JOIN "Member" m ON m."project_id" = p."id"
        INNER JOIN "User" u ON u."id" = m."user_id"
          OR (m."user_id" IS NULL AND m."email" IS NOT NULL AND LOWER(u."email") = LOWER(m."email"))
        GROUP BY h."id", h."title", h."start_date"
        HAVING COUNT(DISTINCT u."id") > 0
      ),
      latest_events AS (
        SELECT *
        FROM event_participants
        ORDER BY "startDate" DESC
        LIMIT 25
      )
      SELECT "eventId", "event", "participants", "projects"
      FROM latest_events
      ORDER BY "startDate" ASC
    `,
    prisma.$queryRaw<Array<{ referrals: bigint }>>`
      SELECT COUNT(*)::bigint AS "referrals"
      FROM "ReferralAttribution" attribution
      WHERE attribution."user_id_referrer" = ${currentUserId}
    `,
    prisma.hackathon.findMany({
      where: {
        end_date: { gte: new Date() },
        OR: [{ is_public: true }, { is_public: null }],
      },
      select: {
        id: true,
        title: true,
        start_date: true,
        end_date: true,
      },
      orderBy: [{ start_date: "asc" }],
      take: 25,
    }),
    prisma.$queryRaw<
      Array<{
        referrerId: string;
        referrer: string | null;
        teamId: string | null;
        country: string | null;
        builderHubSignups: bigint;
        eventRegistrations: bigint;
        hackathonRegistrations: bigint;
        grantApplications: bigint;
        totalReferrals: bigint;
      }>
    >`
      SELECT owner."id" AS "referrerId",
             COALESCE(NULLIF(owner."name", ''), owner."email", 'Unknown') AS "referrer",
             owner."team_id" AS "teamId",
             owner."country" AS "country",
             COUNT(*) FILTER (WHERE attribution."target_type" = 'bh_signup')::bigint AS "builderHubSignups",
             COUNT(*) FILTER (
               WHERE attribution."target_type" = 'hackathon_registration'
                 AND COALESCE(hackathon."event", 'hackathon') <> 'hackathon'
             )::bigint AS "eventRegistrations",
             COUNT(*) FILTER (
               WHERE attribution."target_type" = 'build_games_application'
                  OR (
                    attribution."target_type" = 'hackathon_registration'
                    AND COALESCE(hackathon."event", 'hackathon') = 'hackathon'
                  )
             )::bigint AS "hackathonRegistrations",
             COUNT(*) FILTER (WHERE attribution."target_type" = 'grant_application')::bigint AS "grantApplications",
             COUNT(*)::bigint AS "totalReferrals"
      FROM "ReferralAttribution" attribution
      INNER JOIN "User" owner ON owner."id" = attribution."user_id_referrer"
      LEFT JOIN "Hackathon" hackathon ON hackathon."id" = attribution."target_id"
      GROUP BY owner."id", owner."name", owner."email", owner."team_id", owner."country"
      ORDER BY "totalReferrals" DESC
      LIMIT 100
    `,
    prisma.$queryRaw<
      Array<{
        teamId: string;
        builderHubSignups: bigint;
        eventRegistrations: bigint;
        hackathonRegistrations: bigint;
        grantApplications: bigint;
        totalReferrals: bigint;
      }>
    >`
      SELECT attribution."team_id_referrer" AS "teamId",
             COUNT(*) FILTER (WHERE attribution."target_type" = 'bh_signup')::bigint AS "builderHubSignups",
             COUNT(*) FILTER (
               WHERE attribution."target_type" = 'hackathon_registration'
                 AND COALESCE(hackathon."event", 'hackathon') <> 'hackathon'
             )::bigint AS "eventRegistrations",
             COUNT(*) FILTER (
               WHERE attribution."target_type" = 'build_games_application'
                  OR (
                    attribution."target_type" = 'hackathon_registration'
                    AND COALESCE(hackathon."event", 'hackathon') = 'hackathon'
                  )
             )::bigint AS "hackathonRegistrations",
             COUNT(*) FILTER (WHERE attribution."target_type" = 'grant_application')::bigint AS "grantApplications",
             COUNT(*)::bigint AS "totalReferrals"
      FROM "ReferralAttribution" attribution
      LEFT JOIN "Hackathon" hackathon ON hackathon."id" = attribution."target_id"
      WHERE attribution."team_id_referrer" IS NOT NULL
      GROUP BY attribution."team_id_referrer"
      ORDER BY "totalReferrals" DESC
      LIMIT 20
    `,
    runHogQL<{ latest: number | null; previous: number | null }>({
      projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
      query: ROLLING_VISITS_HOGQL,
    }),
    runHogQL<{ month: string; visitors: number | null }>({
      projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
      query: MONTHLY_VISITS_HOGQL,
    }),
    runHogQL<{ latest: number | null; previous: number | null }>({
      projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
      query: CONSOLE_USERS_ROLLING_HOGQL,
    }),
    runHogQL<{ month: string; users: number | null }>({
      projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
      query: MONTHLY_CONSOLE_USERS_HOGQL,
    }),
    prisma.project.count({ where: { hackaton_id: { not: null } } }),
    runHogQL<{ country: string | null; country_code: string | null; visitors: number | null }>({
      projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
      query: TOP_COUNTRY_30D_HOGQL,
    }),
    runHogQL<{
      total_current: number | null;
      total_previous: number | null;
      returning_current: number | null;
      returning_previous: number | null;
    }>({
      projectId: POSTHOG_BUILDER_HUB_PROJECT_ID,
      query: RETURNING_VISITORS_HOGQL,
    }),
  ]);

  let cumulative = 0;
  const monthlySignups = monthlyRows.map((row) => {
    const signups = toNumber(row.signups);
    cumulative += signups;
    return {
      month: formatMonth(row.month),
      signups,
      cumulative,
    };
  });

  const eventParticipants = eventParticipantRows.map((row) => ({
    eventId: row.eventId,
    event: row.event,
    participants: toNumber(row.participants),
    projects: toNumber(row.projects),
  }));

  const userGeneratedReferralImpact = toNumber(userGeneratedRows[0]?.referrals);
  const latest30DaySignups = toNumber(rollingSignupRows[0]?.latest30Days);
  const previous30DaySignups = toNumber(rollingSignupRows[0]?.previous30Days);
  const rollingSignupDeltaPercent =
    previous30DaySignups === 0
      ? latest30DaySignups > 0
        ? 100
        : 0
      : ((latest30DaySignups - previous30DaySignups) / previous30DaySignups) * 100;

  const latest30DayVisits = Number(rollingVisitsRows[0]?.latest ?? 0);
  const previous30DayVisits = Number(rollingVisitsRows[0]?.previous ?? 0);
  const rollingVisitsDeltaPercent =
    previous30DayVisits === 0
      ? latest30DayVisits > 0
        ? 100
        : 0
      : ((latest30DayVisits - previous30DayVisits) / previous30DayVisits) * 100;

  const monthlyVisits: MonthlyVisitPoint[] = monthlyVisitsRows.map((row) => ({
    month: formatMonth(row.month),
    visitors: Number(row.visitors ?? 0),
  }));

  const monthlyConsoleUsers: MonthlyVisitPoint[] = monthlyConsoleUsersRows.map((row) => ({
    month: formatMonth(row.month),
    visitors: Number(row.users ?? 0),
  }));

  const consoleUsers30d = Number(consoleUsersRows[0]?.latest ?? 0);
  const previousConsoleUsers30d = Number(consoleUsersRows[0]?.previous ?? 0);
  const consoleUsersDeltaPercent =
    previousConsoleUsers30d === 0
      ? consoleUsers30d > 0
        ? 100
        : 0
      : ((consoleUsers30d - previousConsoleUsers30d) / previousConsoleUsers30d) * 100;

  const topCountryRow = topCountryRows[0];
  const topCountryVisitors = Number(topCountryRow?.visitors ?? 0);
  const topCountry30d =
    topCountryRow?.country && latest30DayVisits > 0
      ? {
          country: topCountryRow.country,
          countryCode: topCountryRow.country_code ?? null,
          sharePct: (topCountryVisitors / latest30DayVisits) * 100,
        }
      : null;

  const returningRow = returningVisitorsRows[0];
  const totalCurrent = Number(returningRow?.total_current ?? 0);
  const totalPrevious = Number(returningRow?.total_previous ?? 0);
  const returningCurrent = Number(returningRow?.returning_current ?? 0);
  const returningPrevious = Number(returningRow?.returning_previous ?? 0);
  const returningVisitorPct30d = totalCurrent > 0 ? (returningCurrent / totalCurrent) * 100 : 0;
  const returningVisitorPctPrevious30d =
    totalPrevious > 0 ? (returningPrevious / totalPrevious) * 100 : 0;
  const returningVisitorDeltaPercent =
    returningVisitorPctPrevious30d === 0
      ? returningVisitorPct30d > 0
        ? 100
        : 0
      : ((returningVisitorPct30d - returningVisitorPctPrevious30d) /
          returningVisitorPctPrevious30d) *
        100;

  const activeEventTargets: ReferralTargetPreset[] = activeEventRows.map((event) => {
    return {
      key: `event-${event.id}`,
      group: "event",
      label: event.title,
      detail: `${getEventStatus(event.start_date, event.end_date)} event`,
      targetType: "hackathon_registration",
      targetId: event.id,
      destinationUrl: `/events/registration-form?event=${event.id}`,
    };
  });

  return {
    totalAccounts,
    userGeneratedReferralImpact,
    latest30DaySignups,
    previous30DaySignups,
    rollingSignupDeltaPercent,
    latest30DayVisits,
    previous30DayVisits,
    rollingVisitsDeltaPercent,
    consoleUsers30d,
    consoleUsersDeltaPercent,
    totalHackathonSubmissions,
    topCountry30d,
    returningVisitorPct30d,
    returningVisitorDeltaPercent,
    monthlySignups,
    monthlyVisits,
    monthlyConsoleUsers,
    signupsByReferrer: referrerRows.map((row) => ({
      referrerId: row.referrerId,
      referrer: row.referrer ?? "Unknown",
      signups: toNumber(row.signups),
    })),
    eventParticipants,
    topReferrers: topReferrerRows.map((row) => ({
      referrerId: row.referrerId,
      referrer: row.referrer ?? "Unknown",
      teamId: row.teamId ?? null,
      team: getReferrerTeamLabel(row.teamId ?? null),
      country: row.country ?? null,
      builderHubSignups: toNumber(row.builderHubSignups),
      eventRegistrations: toNumber(row.eventRegistrations),
      hackathonRegistrations: toNumber(row.hackathonRegistrations),
      grantApplications: toNumber(row.grantApplications),
      totalReferrals: toNumber(row.totalReferrals),
    })),
    topTeamReferrers: topTeamReferrerRows.map((row) => ({
      teamId: row.teamId,
      team: formatTeamLabel(row.teamId),
      builderHubSignups: toNumber(row.builderHubSignups),
      eventRegistrations: toNumber(row.eventRegistrations),
      hackathonRegistrations: toNumber(row.hackathonRegistrations),
      grantApplications: toNumber(row.grantApplications),
      totalReferrals: toNumber(row.totalReferrals),
    })),
    referralTargets: [
      BUILDER_HUB_SIGNUP_TARGET,
      ...activeEventTargets,
      ...ACTIVE_GRANT_TARGETS,
    ],
  };
}

export async function getBuilderInsightsReferralLinks(userId: string) {
  return listReferralLinksForUser(userId);
}
