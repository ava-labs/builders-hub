import { prisma } from "@/prisma/prisma";
import { createReferralLink } from "@/server/services/referrals";
import type { Prisma } from "@prisma/client";

/**
 * Profile summary helpers — read-only aggregations the redesigned profile
 * page surfaces in its sidebar widgets and tab counters.
 *
 * All reads are scoped to a single `userId` (the session-derived id from the
 * API route). Nothing here should be called with an unverified id.
 */

export interface ProfileProjectSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isWinner: boolean;
  hackathonId: string | null;
  hackathonTitle: string | null;
  logoUrl: string | null;
  demoLink: string | null;
  githubRepository: string | null;
  role: string;
}

const projectMembershipInclude = {
  hackathon: { select: { id: true, title: true } },
  members: {
    select: { user_id: true, role: true, status: true },
  },
} satisfies Prisma.ProjectInclude;

/**
 * Returns the projects the user is a confirmed member of, sorted by most
 * recent first. Pulls the role from the matching Member row so the UI can
 * show "Founder", "Lead", etc.
 */
export async function getUserProjects(
  userId: string,
): Promise<ProfileProjectSummary[]> {
  if (!userId) return [];

  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: {
          user_id: userId,
          status: "Confirmed",
        },
      },
    },
    include: projectMembershipInclude,
    orderBy: { updated_at: "desc" },
    take: 24,
  });

  return projects.map((project) => {
    const membership = project.members.find((m) => m.user_id === userId);
    const tags =
      project.tracks && project.tracks.length > 0
        ? project.tracks
        : project.tags ?? [];
    return {
      id: project.id,
      name: project.project_name,
      description: project.short_description,
      tags,
      isWinner: project.is_winner ?? false,
      hackathonId: project.hackathon?.id ?? null,
      hackathonTitle: project.hackathon?.title ?? null,
      logoUrl: project.logo_url || null,
      demoLink: project.demo_link || null,
      githubRepository: project.github_repository || null,
      role: membership?.role ?? "Member",
    };
  });
}

export interface ProfileBadgeSummary {
  id: string;
  badgeId: string;
  name: string;
  description: string;
  imagePath: string;
  category: string;
  awardedAt: string;
}

/**
 * Returns the user's awarded badges (status=1, "approved"). One row per
 * UserBadge, with the joined Badge metadata flattened so the UI doesn't
 * have to deal with the relation shape.
 */
export async function getUserBadgesForProfile(
  userId: string,
): Promise<ProfileBadgeSummary[]> {
  if (!userId) return [];
  const rows = await prisma.userBadge.findMany({
    where: { user_id: userId, status: 1 },
    include: { badge: true },
    orderBy: { awarded_at: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    badgeId: r.badge_id,
    name: r.badge.name,
    description: r.badge.description,
    imagePath: r.badge.image_path,
    category: r.badge.category,
    awardedAt: r.awarded_at.toISOString(),
  }));
}

export interface ProfileEngagementFlags {
  hasProject: boolean;
  hasHackathonParticipation: boolean;
  hasUsedConsole: boolean;
}

/**
 * Quick presence checks for the profile-completion bar. Three indexed
 * counts; safe to run on every page load.
 */
export async function getProfileEngagement(
  userId: string,
): Promise<ProfileEngagementFlags> {
  if (!userId) {
    return {
      hasProject: false,
      hasHackathonParticipation: false,
      hasUsedConsole: false,
    };
  }

  const [projectMemberships, hackathonMemberships, consoleBadgeCount] =
    await Promise.all([
      prisma.member.count({
        where: { user_id: userId, status: "Confirmed" },
      }),
      prisma.member.count({
        where: {
          user_id: userId,
          status: "Confirmed",
          project: { hackaton_id: { not: null } },
        },
      }),
      prisma.userBadge.count({
        where: {
          user_id: userId,
          status: 1,
          badge: { category: "console" },
        },
      }),
    ]);

  return {
    hasProject: projectMemberships > 0,
    hasHackathonParticipation: hackathonMemberships > 0,
    hasUsedConsole: consoleBadgeCount > 0,
  };
}

/**
 * Number of attributions where the user was the referrer. Matches the
 * Builder Insights definition (`SELECT COUNT(*) FROM ReferralAttribution
 * WHERE user_id_referrer = ?`) — so the count surfaced in the profile is
 * consistent with what BI shows internally.
 */
export async function getUserReferralCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const count = await prisma.referralAttribution.count({
    where: { user_id_referrer: userId },
  });
  return count;
}

/**
 * Returns the user's `bh_signup` referral code, creating one on the fly if
 * they don't have one yet. Idempotent — `createReferralLink` re-uses an
 * existing matching link rather than minting a new code, so this is safe to
 * call on every profile load.
 */
export async function getOrCreateBhSignupReferralCode(
  userId: string,
): Promise<string> {
  const link = await createReferralLink({
    ownerUserId: userId,
    targetType: "bh_signup",
  });
  return link.code;
}
