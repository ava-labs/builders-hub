import { prisma } from "@/prisma/prisma";
import { BadgeAwardStatus, UserBadge } from "@/types/badge";

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const userBadges = await prisma.userBadge.findMany({
    where: {
      user_id: userId,
    },
    include: {
      badge: true,
    },
  });
  const badges = userBadges.map((badge) => ({
    ...badge,
    name: badge.badge.name,
    image_path: badge.badge.image_path,
  }));
  return badges as unknown as UserBadge[];
}

export async function getCompletedCourseSlugs(userId: string): Promise<string[]> {
  const userBadges = await prisma.userBadge.findMany({
    where: {
      user_id: userId,
      status: { in: [BadgeAwardStatus.approved, BadgeAwardStatus.pending] },
    },
    include: {
      badge: true,
    },
  });

  // approved = all requirements completed; pending = only the courses recorded
  // in evidence are completed (multi-certificate courses like Access Restriction).
  const courseSlugs = new Set<string>();
  for (const ub of userBadges) {
    if (ub.badge.category !== 'academy') continue;
    const completed =
      ub.status === BadgeAwardStatus.approved
        ? (ub.badge.requirements as any[])
        : ((ub.evidence as any[]) || []);
    for (const req of completed) {
      if (req?.course_id) {
        courseSlugs.add(req.course_id);
      }
    }
  }

  return [...courseSlugs];
}