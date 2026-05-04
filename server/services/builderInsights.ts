import { prisma } from "@/prisma/prisma";
import { listReferralLinksForUser } from "./referrals";

const BUILD_GAMES_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export interface MonthlySignupPoint {
  month: string;
  signups: number;
  cumulative: number;
}

export interface ReferrerSignupPoint {
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

export interface BuilderInsightsData {
  totalAccounts: number;
  buildGamesParticipants: number;
  monthlySignups: MonthlySignupPoint[];
  signupsByReferrer: ReferrerSignupPoint[];
  eventParticipants: EventParticipantPoint[];
  topReferrers: TopReferrerRow[];
  signupSources: SignupSourcePoint[];
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function formatMonth(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 7);
}

export async function getBuilderInsightsData(): Promise<BuilderInsightsData> {
  const [
    totalAccounts,
    monthlyRows,
    referrerRows,
    eventParticipantRows,
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
    prisma.$queryRaw<Array<{ referrer: string | null; signups: bigint }>>`
      SELECT COALESCE(NULLIF(owner."name", ''), owner."email", 'Unknown') AS "referrer",
             COUNT(*)::bigint AS "signups"
      FROM "ReferralAttribution" attribution
      LEFT JOIN "User" owner ON owner."id" = attribution."referrer_user_id"
      WHERE attribution."conversion_type" = 'bh_signup'
        AND attribution."source" = 'referral'
      GROUP BY 1
      ORDER BY "signups" DESC
      LIMIT 20
    `,
    prisma.$queryRaw<
      Array<{ eventId: string; event: string; participants: bigint; projects: bigint }>
    >`
      SELECT h."id" AS "eventId",
             h."title" AS "event",
             COUNT(DISTINCT u."id")::bigint AS "participants",
             COUNT(DISTINCT p."id")::bigint AS "projects"
      FROM "Hackathon" h
      INNER JOIN "Project" p ON p."hackaton_id" = h."id"
      INNER JOIN "Member" m ON m."project_id" = p."id"
      INNER JOIN "User" u ON u."id" = m."user_id"
        OR (m."user_id" IS NULL AND m."email" IS NOT NULL AND LOWER(u."email") = LOWER(m."email"))
      GROUP BY h."id", h."title", h."start_date"
      HAVING COUNT(DISTINCT u."id") > 0
      ORDER BY "participants" DESC, h."start_date" DESC
      LIMIT 25
    `,
    prisma.$queryRaw<
      Array<{
        referrer: string | null;
        bhSignups: bigint;
        hackathonRegistrations: bigint;
        buildGamesApplications: bigint;
        grantApplications: bigint;
        totalConversions: bigint;
      }>
    >`
      SELECT COALESCE(NULLIF(owner."name", ''), owner."email", 'Unknown') AS "referrer",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'bh_signup')::bigint AS "bhSignups",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'hackathon_registration')::bigint AS "hackathonRegistrations",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'build_games_application')::bigint AS "buildGamesApplications",
             COUNT(*) FILTER (WHERE attribution."conversion_type" = 'grant_application')::bigint AS "grantApplications",
             COUNT(*)::bigint AS "totalConversions"
      FROM "ReferralAttribution" attribution
      INNER JOIN "User" owner ON owner."id" = attribution."referrer_user_id"
      WHERE attribution."source" = 'referral'
      GROUP BY 1
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

  const buildGamesParticipants =
    eventParticipants.find((event) => event.eventId === BUILD_GAMES_HACKATHON_ID)?.participants ?? 0;

  const attributedSignupTotal = signupSourceRows.reduce(
    (sum, row) => sum + toNumber(row.signups),
    0
  );
  const historicalUnattributed = Math.max(totalAccounts - attributedSignupTotal, 0);

  return {
    totalAccounts,
    buildGamesParticipants,
    monthlySignups,
    signupsByReferrer: referrerRows.map((row) => ({
      referrer: row.referrer ?? "Unknown",
      signups: toNumber(row.signups),
    })),
    eventParticipants,
    topReferrers: topReferrerRows.map((row) => ({
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
  };
}

export async function getBuilderInsightsReferralLinks(userId: string) {
  return listReferralLinksForUser(userId);
}
