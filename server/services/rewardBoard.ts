import { prisma } from "@/prisma/prisma";
import { UserBadge, BadgeMetadata, Badge } from "@/types/badge";
import { JsonValue } from "@prisma/client/runtime/library";

// Utility function to safely convert JSON metadata
function parseBadgeMetadata(metadata: JsonValue): BadgeMetadata | null {
  const metadataObject = metadata as BadgeMetadata;
  const toReturn = {
    course_id: metadataObject.course_id || undefined,
    hackathon: metadataObject.hackathon || null,
    type: metadataObject.type || undefined,
  };
  return toReturn;
}

export async function getRewardBoard(user_id: string): Promise<UserBadge[]> {
  const userBadges = await prisma.userBadge.findMany({
    where: {
      user_id: user_id,
    },
    include: {
      badge: true,
    },
  });

  // Map the result to the UserBadge type, flattening the badge fields
  return userBadges.map((userBadge) => ({
    user_id: userBadge.user_id,
    badge_id: userBadge.badge_id,
    awarded_at: userBadge.awarded_at,
    awarded_by: userBadge.awarded_by,
    name: userBadge.badge.name,
    description: userBadge.badge.description,
    points: userBadge.badge.points,
    image_path: userBadge.badge.image_path,
    category: userBadge.badge.category,
    metadata: parseBadgeMetadata(userBadge.badge.metadata),
  }));
}

export async function getBadgeByCourseId(courseId: string): Promise<Badge> {
  const badge = await prisma.badge.findFirst({
    where: {
      metadata: {
        path: ['course_id'],
        equals: courseId,
      },
    },
  });

  if (!badge) {
    throw new Error(`Badge not found for course ID: ${courseId}`);
  }

  return {
    id: badge.id,
    name: badge.name,
    description: badge.description,
    points: badge.points,
    image_path: badge.image_path,
    category: badge.category,
    metadata: parseBadgeMetadata(badge.metadata),
  };
}
