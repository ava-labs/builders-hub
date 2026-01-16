import { prisma } from "@/prisma/prisma";
import { UserBadge } from "@/types/badge";

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