import { prisma } from "@/prisma/prisma";
import { listReferralLinksForUser } from "./referrals";
import {
  ACTIVE_GRANT_TARGETS,
  BUILDER_HUB_SIGNUP_TARGET,
  type ReferralTargetPreset,
} from "@/lib/referrals/targets";

export interface MonthlySignupPoint {
  month: string;
  signups: number;
  cumulative: number;
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
  monthlySignups: MonthlySignupPoint[];
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

const REFERRAL_TEAM_LABELS: Record<string, string> = {
  devrel: "DevRel",
  "team1-india": "Team1 India",
  "team1-latam": "Team1 LatAm",
  "team1-vietnam": "Team1 Vietnam",
  "team1-korea": "Team1 Korea",
  "team1-china": "Team1 China",
  "team1-france": "Team1 France",
};

function formatTeamLabel(teamId: string): string {
  return REFERRAL_TEAM_LABELS[teamId] ?? teamId;
}

function getReferrerTeamLabel(teamId: string | null): string {
  return teamId ? formatTeamLabel(teamId) : "Community";
}

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
      GROUP BY owner."id", owner."name", owner."email", owner."team_id"
      ORDER BY "totalReferrals" DESC
      LIMIT 20
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
    monthlySignups,
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
