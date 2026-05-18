import { prisma } from "@/prisma/prisma";
import {
  createReferralLink,
  listReferralLinksForUser,
  getActiveReferralTargets,
  buildReferralUrl,
} from "@/server/services/referrals";
import { getAllBadges } from "@/server/services/badge";
import { getRewardBoard } from "@/server/services/rewardBoard";
import type { Badge, UserBadge, Requirement } from "@/types/badge";
import type { ReferralTargetPreset } from "@/lib/referrals/targets";
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
  group: "console" | "blockchain" | "avalanche-l1" | "entrepreneur" | "hackathon" | "unknown";
  tier: string | null;
  isUnlocked: boolean;
  isSecret: boolean;
  awardedAt: string | null;
  requirements: Requirement[];
}

/**
 * Returns every displayable badge with the user's unlock status overlaid.
 * This keeps the legacy achievements information architecture: Console
 * badges are grouped by tier, academy badges by academy track, and locked
 * badges remain visible.
 */
export async function getUserBadgesForProfile(
  userId: string,
): Promise<ProfileBadgeSummary[]> {
  if (!userId) return [];
  const [badges, userBadges] = await Promise.all([
    getAllBadges(),
    getRewardBoard(userId),
  ]);

  return badges
    .map((badge) => resolveProfileBadge(badge, userBadges))
    .filter((badge) => badge.group !== "hackathon" && badge.group !== "unknown")
    .sort((a, b) => {
      const groupDelta = groupOrder(a.group) - groupOrder(b.group);
      if (groupDelta !== 0) return groupDelta;
      const tierDelta = Number(a.tier ?? 0) - Number(b.tier ?? 0);
      if (tierDelta !== 0) return tierDelta;
      return badgeCourseOrder(a.badgeId) - badgeCourseOrder(b.badgeId);
    });
}

function resolveProfileBadge(
  badge: Badge,
  userBadges: UserBadge[],
): ProfileBadgeSummary {
  const userBadge = userBadges.find((ub) => ub.badge_id === badge.id);
  const requirements = userBadge?.requirements ?? badge.requirements ?? [];
  const allRequirementsCompleted =
    requirements.length > 0 &&
    requirements.every((requirement) => requirement.unlocked === true);
  const hasNoRequirements = requirements.length === 0;

  return {
    id: badge.id,
    badgeId: badge.id,
    name: badge.name,
    description: badge.description,
    imagePath: badge.image_path,
    category: badge.category,
    group: getBadgeGroup(badge),
    tier: getConsoleTier(badge),
    isUnlocked: userBadge ? hasNoRequirements || allRequirementsCompleted : false,
    isSecret: getConsoleTier(badge) === "4",
    awardedAt: userBadge?.awarded_at?.toISOString() ?? null,
    requirements,
  };
}

function getBadgeGroup(badge: Badge): ProfileBadgeSummary["group"] {
  const id = badge.id.toLowerCase();
  if (id.includes("console")) return "console";
  if (id.includes("blockchainacademy")) return "blockchain";
  if (id.includes("entrepreneuracademy")) return "entrepreneur";
  if (id.includes("avalanchel1academy")) return "avalanche-l1";
  if (id.includes("hackathon")) return "hackathon";
  return "unknown";
}

function getConsoleTier(badge: Badge): string | null {
  if (getBadgeGroup(badge) !== "console") return null;
  const match = badge.id.toLowerCase().match(/(\d+)tier/);
  return match ? match[1] : "0";
}

function badgeCourseOrder(id: string): number {
  const match = id.match(/-(\d+)/);
  return match ? Number(match[1]) : 999;
}

function groupOrder(group: ProfileBadgeSummary["group"]): number {
  switch (group) {
    case "console":
      return 0;
    case "blockchain":
      return 1;
    case "avalanche-l1":
      return 2;
    case "entrepreneur":
      return 3;
    case "hackathon":
      return 4;
    case "unknown":
      return 5;
  }
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

/**
 * Ensures the user has a referral link for every currently-active target
 * (BH signup + every active event + every active grant). Idempotent: re-
 * uses any existing matching link rather than minting a new code.
 *
 * Short-circuits when the user already has every active target — that's
 * the steady-state case after first load, so the typical hot path is one
 * cheap query against the indexed `owner_user_id` column.
 *
 * Mints sequentially when needed (not in parallel) to avoid saturating
 * the Prisma connection pool — `createReferralLink` itself can issue
 * up to ~16 DB round-trips per call, and the summary endpoint already
 * runs many queries in parallel.
 */
export async function ensureActiveReferralLinks(userId: string): Promise<void> {
  if (!userId) return;
  const groups = await getActiveReferralTargets();
  const all: ReferralTargetPreset[] = [
    ...groups.signup,
    ...groups.event,
    ...groups.grant,
  ];
  if (all.length === 0) return;

  const existing = await prisma.referralLink.findMany({
    where: { owner_user_id: userId, disabled_at: null },
    select: { target_type: true, target_id: true },
  });
  const has = new Set(existing.map((l) => `${l.target_type}|${l.target_id ?? ""}`));
  const missing = all.filter(
    (t) => !has.has(`${t.targetType}|${t.targetId ?? ""}`),
  );
  if (missing.length === 0) return;

  for (const t of missing) {
    try {
      await createReferralLink({
        ownerUserId: userId,
        targetType: t.targetType,
        targetId: t.targetId,
        destinationUrl: t.destinationUrl,
      });
    } catch (err) {
      console.error(
        `[ensureActiveReferralLinks] mint failed for ${t.key}:`,
        err,
      );
    }
  }
}

/**
 * Total count of users on the platform — used by the notifications form
 * to show an honest reach number for the "All builders" audience.
 */
export async function getTotalBuilderCount(): Promise<number> {
  return prisma.user.count();
}

export interface ProfileReferralLink {
  id: string;
  code: string;
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
  shareUrl: string;
  signups: number;
  createdAt: string;
}

/**
 * Returns the user's existing referral links with per-link attribution counts.
 * Stats query is one grouped count keyed by `referral_link_id` so it scales
 * with the number of links (typically <10 per user).
 */
export async function getUserReferralLinks(
  userId: string,
  origin: string,
): Promise<ProfileReferralLink[]> {
  if (!userId) return [];
  const links = await listReferralLinksForUser(userId);
  if (links.length === 0) return [];

  const linkIds = links.map((l) => l.id);
  const counts = await prisma.referralAttribution.groupBy({
    by: ["referral_link_id"],
    where: { referral_link_id: { in: linkIds } },
    _count: { _all: true },
  });
  const byId = new Map<string, number>();
  for (const row of counts) {
    if (row.referral_link_id) byId.set(row.referral_link_id, row._count._all);
  }

  return links.map((l) => ({
    id: l.id,
    code: l.code,
    targetType: l.target_type,
    targetId: l.target_id,
    destinationUrl: l.destination_url,
    shareUrl: buildReferralUrl(origin, l.destination_url, l.code),
    signups: byId.get(l.id) ?? 0,
    createdAt: l.created_at.toISOString(),
  }));
}

export interface ProfileReferralTarget {
  key: string;
  group: "signup" | "event" | "grant";
  label: string;
  detail: string;
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
  /** Lucide-style icon key our UI can render. */
  icon: "rocket" | "trophy" | "code" | "gift";
}

const TARGET_ICON_BY_GROUP: Record<
  "signup" | "event" | "grant",
  ProfileReferralTarget["icon"]
> = {
  signup: "rocket",
  event: "trophy",
  grant: "gift",
};

/**
 * Flattens the existing target catalog (signup + event + grant groups) into
 * a single ordered list with a UI-friendly icon picked from the group.
 */
export async function getReferralTargetCatalog(): Promise<ProfileReferralTarget[]> {
  const groups = await getActiveReferralTargets();
  const all: ReferralTargetPreset[] = [
    ...groups.signup,
    ...groups.event,
    ...groups.grant,
  ];
  return all.map((t) => ({
    key: t.key,
    group: t.group,
    label: t.label,
    detail: t.detail,
    targetType: t.targetType,
    targetId: t.targetId,
    destinationUrl: t.destinationUrl,
    icon: TARGET_ICON_BY_GROUP[t.group],
  }));
}
