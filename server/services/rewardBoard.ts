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
    unlocked: metadataObject.unlocked || false,
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
let badges=userBadges.map((userBadge) => {
  const parsedRequirements = userBadge.badge.requirements.map((requirement) => parseBadgeMetadata(requirement)) as Requirement[];
  
  // Marcar como unlocked los requirements que están en evidence
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
    points: 0, // Se calculará después
    image_path: userBadge.badge.image_path,
    category: userBadge.badge.category,
    evidence: userBadge.evidence,
    requirements: parsedRequirements,
  };
});

// Calcular los puntos totales basándose en los requirements del evidence
badges.forEach((badge) => {
  if (Array.isArray(badge.evidence)) {
    badge.points = badge.evidence.reduce(
      (acc: number, requirement: any) => {
        // Asegura que requirement no sea null y tenga la propiedad points
        if (requirement && typeof requirement.points !== "undefined" && requirement.points !== null) {
          return acc + parseInt(requirement.points.toString(), 10);
        }
        return acc;
      },
      0
    );
  } else {
    badge.points = 0;
  }
});

  // Map the result to the UserBadge type, flattening the badge fields
  return badges as unknown as UserBadge[];
}

