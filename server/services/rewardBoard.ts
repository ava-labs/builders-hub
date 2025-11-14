import { prisma } from "@/prisma/prisma";
import { UserBadge, Requirement, Badge } from "@/types/badge";
import { JsonValue } from "@prisma/client/runtime/library";

// Utility function to safely convert JSON metadata
export function parseBadgeMetadata(metadata: JsonValue): Requirement | null {
  const metadataObject = metadata as Requirement;
  const toReturn = {
    course_id: metadataObject.course_id || undefined,
    hackathon: metadataObject.hackathon || null,
    type: metadataObject.type || undefined,
    // points: metadataObject.points || undefined, // COMMENTED OUT: Points feature disabled
    description: metadataObject.description || undefined,
    id: metadataObject.id || "",
    unlocked: false,
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
    orderBy: {
      badge_id: "desc",
    },
  });
  let badges = userBadges.map((userBadge) => {
    const parsedRequirements = userBadge.badge.requirements.map((requirement) => parseBadgeMetadata(requirement)) as Requirement[];

    if (Array.isArray(userBadge.evidence)) {
      const evidenceArray = userBadge.evidence as Requirement[];
      parsedRequirements.forEach((requirement) => {
        const isInEvidence = evidenceArray.some((evidenceItem: any) =>
          evidenceItem && evidenceItem.id === requirement.id
        );
        if (isInEvidence) {
          requirement.unlocked = true;
        }
      });
    }

    return {
      user_id: userBadge.user_id,
      badge_id: userBadge.badge_id,
      awarded_at: userBadge.awarded_at,
      awarded_by: userBadge.awarded_by,
      name: userBadge.badge.name,
      description: userBadge.badge.description,
      // points: 0, // COMMENTED OUT: Points calculation disabled
      image_path: userBadge.badge.image_path,
      category: userBadge.badge.category,
      evidence: userBadge.evidence,
      requirements: parsedRequirements,
      status: userBadge.status,
      requirements_version: userBadge.requirements_version,
    };
  });

// COMMENTED OUT: Points calculation disabled
// badges.forEach((badge) => {
//   if (Array.isArray(badge.evidence)) {
//     badge.points = badge.evidence.reduce(
//       (acc: number, requirement: any) => {
//         if (requirement && typeof requirement.points !== "undefined" && requirement.points !== null) {
//           return acc + parseInt(requirement.points.toString(), 10);
//         }
//         return acc;
//       },
//       0
//     );
//   } else {
//     badge.points = 0;
//   }
// });

  return badges as unknown as UserBadge[];
}

