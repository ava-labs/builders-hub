import { prisma } from "@/prisma/prisma";
import {
  createReferralLink,
  listReferralLinksForUser,
  getActiveReferralTargets,
  buildReferralUrl,
  resolveReferralDestination,
} from "@/server/services/referrals";
import { getAllBadges } from "@/server/services/badge";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { getCompletedCourseSlugs } from "@/server/services/userBadge";
import { ACADEMY_COURSES } from "@/components/academy/learning-path-configs/academy.config";
import { certificatesOf, courseOfCertificate } from "@/lib/academy/course-certificates";
import type { Badge, UserBadge, Requirement } from "@/types/badge";
import type { ReferralTargetPreset } from "@/lib/referrals/targets";
import { MINI_GRANT_KEY } from "@/lib/grants/programs";
import type { Prisma } from "@prisma/client";
import { MemberStatus } from "@/types/project";

export interface ProfileProjectSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isWinner: boolean;
  hackathonId: string | null;
  hackathonTitle: string | null;
  origin: string;
  hasMiniGrantApplication: boolean;
  logoUrl: string | null;
  demoLink: string | null;
  githubRepository: string | null;
  role: string;
}

const projectMembershipInclude = {
  hackathon: { select: { id: true, title: true } },
  grant_applications: {
    select: { program_key: true },
  },
  members: {
    select: { user_id: true, role: true, status: true },
  },
} satisfies Prisma.ProjectInclude;

export async function getUserProjects(
  userId: string,
): Promise<ProfileProjectSummary[]> {
  if (!userId) return [];

  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: {
          user_id: userId,
          status: MemberStatus.CONFIRMED,
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
      origin: project.origin,
      hasMiniGrantApplication: project.grant_applications.some(
        (application) => application.program_key === MINI_GRANT_KEY,
      ),
      logoUrl: project.logo_url || null,
      demoLink: project.demo_link || null,
      githubRepository: project.github_repository || null,
      role: membership?.role ?? "Member",
    };
  });
}

export type ProfileBadgeGroup = "academy" | "hackathon";

export interface ProfileBadgeSummary {
  id: string;
  badgeId: string;
  name: string;
  description: string;
  imagePath: string;
  category: string;
  group: ProfileBadgeGroup;
  isUnlocked: boolean;
  awardedAt: string | null;
  requirements: Requirement[];
}

export interface AcademyProgress {
  /** the courses whose certificate the user has */
  completed: number;
  /** the courses of the Academy programme */
  total: number;
}

// The tiers of the Academy grid: course badges in reading order, then the track
// Graduates, then badges that name no course of the programme.
const COURSE_BADGE = 0;
const GRADUATE_BADGE = 1;
const OUTSIDE_BADGE = 2;

/** The tier of an Academy badge and its first course in reading order. */
function academyRank(requirements: Requirement[]): { tier: number; index: number } {
  const courses = new Set<number>();
  for (const requirement of requirements) {
    const course = courseOfCertificate(requirement.course_id);
    if (course) courses.add(ACADEMY_COURSES.indexOf(course));
  }
  if (courses.size === 0) return { tier: OUTSIDE_BADGE, index: 0 };
  return { tier: courses.size === 1 ? COURSE_BADGE : GRADUATE_BADGE, index: Math.min(...courses) };
}

/** The profile shows Academy and hackathon badges only; any other category stays off it. */
function badgeGroup(category: string): ProfileBadgeGroup | null {
  const normalized = category.trim().toLowerCase();
  return normalized === "academy" || normalized === "hackathon" ? normalized : null;
}

export async function getUserBadgesForProfile(
  userId: string,
): Promise<ProfileBadgeSummary[]> {
  if (!userId) return [];
  // getAllBadges and getRewardBoard skip the stored console rows (NOT_CONSOLE_BADGE).
  const [badges, userBadges] = await Promise.all([
    getAllBadges(),
    getRewardBoard(userId),
  ]);

  const academy: Array<{ summary: ProfileBadgeSummary; tier: number; index: number }> = [];
  const hackathon: ProfileBadgeSummary[] = [];
  for (const badge of badges) {
    const group = badgeGroup(badge.category);
    if (!group) continue;
    const summary = resolveProfileBadge(badge, group, userBadges);
    if (group === "hackathon") {
      // A hackathon badge is a prize: only its winners see it.
      if (summary.isUnlocked) hackathon.push(summary);
      continue;
    }
    const { tier, index } = academyRank(summary.requirements);
    // A badge that names no course of the programme (a removed course: FDE-154 NFT
    // Deployment, FDE-153 the Entrepreneur Academy) shows only to the users who earned it.
    if (tier === OUTSIDE_BADGE && !summary.isUnlocked) continue;
    academy.push({ summary, tier, index });
  }

  academy.sort((a, b) => a.tier - b.tier || a.index - b.index || a.summary.badgeId.localeCompare(b.summary.badgeId));
  hackathon.sort((a, b) => (b.awardedAt ?? "").localeCompare(a.awardedAt ?? "") || a.name.localeCompare(b.name));
  return [...academy.map((entry) => entry.summary), ...hackathon];
}

/** The Academy courses the user has a certificate for, of the programme's 13. */
export async function getAcademyProgress(userId: string): Promise<AcademyProgress> {
  const total = ACADEMY_COURSES.length;
  if (!userId) return { completed: 0, total };
  const done = new Set(await getCompletedCourseSlugs(userId));
  const completed = ACADEMY_COURSES.filter((course) => certificatesOf(course).every((slug) => done.has(slug))).length;
  return { completed, total };
}

function resolveProfileBadge(
  badge: Badge,
  group: ProfileBadgeGroup,
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
    group,
    isUnlocked: userBadge ? hasNoRequirements || allRequirementsCompleted : false,
    awardedAt: userBadge?.awarded_at?.toISOString() ?? null,
    requirements,
  };
}

export interface ProfileEngagementFlags {
  hasProject: boolean;
  hasHackathonParticipation: boolean;
  hasUsedConsole: boolean;
}

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

  // A user has used the console once it holds a console log entry, a faucet
  // claim or a node registration for them.
  const [projectMemberships, hackathonMemberships, consoleLog, faucetClaim, nodeRegistration] =
    await Promise.all([
      prisma.member.count({
        where: { user_id: userId, status: MemberStatus.CONFIRMED },
      }),
      prisma.member.count({
        where: {
          user_id: userId,
          status: MemberStatus.CONFIRMED,
          project: { hackaton_id: { not: null } },
        },
      }),
      prisma.consoleLog.findFirst({ where: { user_id: userId }, select: { id: true } }),
      prisma.faucetClaim.findFirst({ where: { user_id: userId }, select: { id: true } }),
      prisma.nodeRegistration.findFirst({ where: { user_id: userId }, select: { id: true } }),
    ]);

  return {
    hasProject: projectMemberships > 0,
    hasHackathonParticipation: hackathonMemberships > 0,
    hasUsedConsole: Boolean(consoleLog || faucetClaim || nodeRegistration),
  };
}

export async function getUserReferralCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const count = await prisma.referralAttribution.count({
    where: { user_id_referrer: userId },
  });
  return count;
}

export async function getOrCreateBhSignupReferralCode(
  userId: string,
): Promise<string> {
  const link = await createReferralLink({
    ownerUserId: userId,
    targetType: "bh_signup",
  });
  return link.code;
}

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

  return links.map((l) => {
    const destination = resolveReferralDestination(
      l.target_type,
      l.target_id,
      l.destination_url,
    );
    return {
      id: l.id,
      code: l.code,
      targetType: l.target_type,
      targetId: l.target_id,
      destinationUrl: destination,
      shareUrl: buildReferralUrl(origin, destination, l.code),
      signups: byId.get(l.id) ?? 0,
      createdAt: l.created_at.toISOString(),
    };
  });
}

export interface ProfileReferralTarget {
  key: string;
  group: "signup" | "event" | "grant";
  label: string;
  detail: string;
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
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
