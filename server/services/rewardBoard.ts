import { prisma } from "@/prisma/prisma";
import { UserBadge, Requirement, Badge } from "@/types/badge";
import { JsonValue } from "@prisma/client/runtime/library";
import { continents } from '../../types/infrabuidlForm';

// Utility function to safely convert JSON metadata
export function parseBadgeMetadata(metadata: JsonValue): Requirement | null {
  const metadataObject = metadata as Requirement;
  const toReturn = {
    course_id: metadataObject.course_id || undefined,
    hackathon: metadataObject.hackathon || null,
    type: metadataObject.type || undefined,
    points: metadataObject.points || undefined,
    description: metadataObject.description || undefined,
    id: metadataObject.id || "",
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
    requirements:userBadge.badge.requirements.map((requirement) => parseBadgeMetadata(requirement)) as Requirement[],
  }));
}

