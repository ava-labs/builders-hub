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
      status: BadgeAwardStatus.approved,
    },
    include: {
      badge: true,
    },
  });

  const courseSlugs: string[] = [];
  for (const ub of userBadges) {
    if (ub.badge.category !== 'academy') continue;
    const requirements = ub.badge.requirements as any[];
    for (const req of requirements) {
      if (req?.course_id) {
        courseSlugs.push(req.course_id);
      }
    }
  }

  return courseSlugs;
}