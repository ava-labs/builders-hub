import { prisma } from "@/prisma/prisma";
import { listReferralLinksForUser } from "./referrals";
import type { ReferralTargetType } from "@/lib/referrals/constants";

const BUILD_GAMES_HACKATHON_ID =
  process.env.BUILD_GAMES_HACKATHON_ID ?? "249d2911-7931-4aa0-a696-37d8370b79f9";

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
  bhSignups: number;
  hackathonRegistrations: number;
  buildGamesApplications: number;
  grantApplications: number;
  totalConversions: number;
}

export interface SignupSourcePoint {
  source: string;
  signups: number;
}

export interface ReferralTargetPreset {
  key: string;
  group: "signup" | "event" | "grant";
  label: string;
  detail: string;
  targetType: ReferralTargetType;
  targetId: string | null;
  destinationUrl: string;
}

export interface BuilderInsightsData {
  totalAccounts: number;
  userGeneratedBhAndEventSignups: number;
  monthlySignups: MonthlySignupPoint[];
  signupsByReferrer: ReferrerSignupPoint[];
  eventParticipants: EventParticipantPoint[];
  topReferrers: TopReferrerRow[];
  signupSources: SignupSourcePoint[];
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

const ACTIVE_GRANT_TARGETS: ReferralTargetPreset[] = [
  {
    key: "grant-avalanche-research-proposals",
    group: "grant",
    label: "Call for Research Proposals",
    detail: "Active grant application",
    targetType: "grant_application",
    targetId: "avalanche-research-proposals",
    destinationUrl: "/grants/avalanche-research-proposals",
  },
  {
    key: "grant-retro9000-returning",
    group: "grant",
    label: "Retro9000 Returning",
    detail: "Active grant application",
    targetType: "grant_application",
    targetId: "retro9000-returning",
    destinationUrl: "/grants/retro9000returning",
  },
];

export async function getBuilderInsightsData(currentUserId: string): Promise<BuilderInsightsData> {
  const [
    totalAccounts,
    monthlyRows,
    referrerRows,
    eventParticipantRows,
    userGeneratedRows,
    activeEventRows,
    topReferrerRows,
    signupSourceRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.$queryRaw<Array<{ month: Date; signups: bigint }>>`
      SELECT date_trunc('month', "created_at")::date AS "month", COUNT(*)::bigint AS "signups"
      FROM "User"
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ referrerId: string; referrer: string | null; signups: bigint }>>`
      SELECT owner."id" AS "referrerId",
             COALESCE(NULLIF(owner."name", ''), owner."email", 'Unknown') AS "referrer",
             COUNT(*)::bigint AS "signups"
      FROM "ReferralAttribution" attribution
      INNER JOIN "User" owner ON owner."id" = attribution."referrer_user_id"
      WHERE attribution."conversion_type" = 'bh_signup'
        AND attribution."source" = 'referral'
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
    prisma.$queryRaw<Array<{ signups: bigint }>>`
      SELECT COUNT(*)::bigint AS "signups"
      FROM "ReferralAttribution" attribution
      WHERE attribution."source" = 'referral'
        AND attribution."referrer_user_id" = ${currentUserId}
        AND attribution."conversion_type" IN (
          'bh_signup',
          'hackathon_registration',
          'build_games_application'
        )
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
        bhSignups: bigint;
        hackathonRegistrations: bigint;
        buildGamesApplications: bigint;
        grantApplications: bigint;
        totalConversions: bigint;
      }>
    >`
      SELECT owner."id" AS "referrerId",
             COALESCE(NULLIF(owner."name", ''), owner."email", 'Unknown') AS "referrer",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'bh_signup')::bigint AS "bhSignups",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'hackathon_registration')::bigint AS "hackathonRegistrations",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'build_games_application')::bigint AS "buildGamesApplications",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'grant_application')::bigint AS "grantApplications",
             COUNT(*)::bigint AS "totalConversions"
      FROM "ReferralAttribution" attribution
      INNER JOIN "User" owner ON owner."id" = attribution."referrer_user_id"
      WHERE attribution."source" = 'referral'
      GROUP BY owner."id", owner."name", owner."email"
      ORDER BY "totalConversions" DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ source: string; signups: bigint }>>`
      SELECT attribution."source" AS "source",
             COUNT(*)::bigint AS "signups"
      FROM "ReferralAttribution" attribution
      WHERE attribution."conversion_type" = 'bh_signup'
      GROUP BY attribution."source"
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

  const userGeneratedBhAndEventSignups = toNumber(userGeneratedRows[0]?.signups);

  const attributedSignupTotal = signupSourceRows.reduce(
    (sum, row) => sum + toNumber(row.signups),
    0
  );
  const historicalUnattributed = Math.max(totalAccounts - attributedSignupTotal, 0);
  const activeEventTargets: ReferralTargetPreset[] = activeEventRows.map((event) => {
    const isBuildGames = event.id === BUILD_GAMES_HACKATHON_ID;

    return {
      key: `event-${event.id}`,
      group: "event",
      label: event.title,
      detail: `${getEventStatus(event.start_date, event.end_date)} event`,
      targetType: isBuildGames ? "build_games_application" : "hackathon_registration",
      targetId: event.id,
      destinationUrl: isBuildGames
        ? "/build-games/apply"
        : `/events/registration-form?event=${event.id}`,
    };
  });

  return {
    totalAccounts,
    userGeneratedBhAndEventSignups,
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
      bhSignups: toNumber(row.bhSignups),
      hackathonRegistrations: toNumber(row.hackathonRegistrations),
      buildGamesApplications: toNumber(row.buildGamesApplications),
      grantApplications: toNumber(row.grantApplications),
      totalConversions: toNumber(row.totalConversions),
    })),
    signupSources: [
      ...signupSourceRows.map((row) => ({
        source: row.source === "utm" ? "UTM" : row.source === "referral" ? "Referral link" : "Direct",
        signups: toNumber(row.signups),
      })),
      ...(historicalUnattributed > 0
        ? [{ source: "Historical / unattributed", signups: historicalUnattributed }]
        : []),
    ],
    referralTargets: [
      {
        key: "signup-builder-hub",
        group: "signup",
        label: "Builder Hub Sign Up",
        detail: "Active signup link",
        targetType: "bh_signup",
        targetId: null,
        destinationUrl: "/profile",
      },
      ...activeEventTargets,
      ...ACTIVE_GRANT_TARGETS,
    ],
  };
}

export async function getBuilderInsightsReferralLinks(userId: string) {
  return listReferralLinksForUser(userId);
}
