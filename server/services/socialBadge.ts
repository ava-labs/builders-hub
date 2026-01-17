import { prisma } from "@/prisma/prisma";
import { Badge, BadgeAwardStatus, Requirement } from "@/types/badge";
import { parseBadgeMetadata } from "./rewardBoard";

/**
 * Assigns social badges based on a specific requirement
 * @param userId - ID of the user
 * @param requirementId - ID of the requirement to fulfill
 * @param awardedBy - Who is awarding the badge (optional)
 */
export async function assignBadgeByRequirement(
  userId: string, 
  requirementId: string, 
  awardedBy: string = "system"
): Promise<{ success: boolean; message: string; badges: any[] }> {
  try {
    // Find badges that have this specific requirement
    const badges = await getBadgesByRequirementId(requirementId);
    
    if (!badges || badges.length === 0) {
      return {
        success: false,
        message: `No social badges found for requirement: ${requirementId}`,
        badges: []
      };
    }

    const awardedBadges: any[] = [];

    for (const badge of badges) {
      // Check if the user already has this badge
      const existingUserBadge = await prisma.userBadge.findUnique({
        where: {
          user_id_badge_id: {
            user_id: userId,
            badge_id: badge.id,
          },
        },
      });

      // If user already has the badge, skip it
      if (existingUserBadge) {
        continue;
      }

      // Find the specific requirement that was fulfilled
      const fulfilledRequirement = badge.requirements?.find((req: any) => req.id === requirementId);
      
      // Assign the badge to the user
      await prisma.userBadge.create({
        data: {
          user_id: userId,
          badge_id: badge.id,
          awarded_at: new Date(),
          awarded_by: awardedBy,
          status: BadgeAwardStatus.approved,
          requirements_version: 1,
          
          evidence: fulfilledRequirement ? [fulfilledRequirement] : [],
        },
      });

      awardedBadges.push({
        name: badge.name,
        image_path: badge.image_path,
        completed_requirement: fulfilledRequirement
      });
    }

    return {
      success: true,
      message: `Successfully assigned ${awardedBadges.length} social badge(s) for requirement: ${requirementId}`,
      badges: awardedBadges
    };

  } catch (error) {
    console.error("Error assigning social badge by requirement:", error);
    return {
      success: false,
      message: `Error assigning social badge: ${error instanceof Error ? error.message : 'Unknown error'}`,
      badges: []
    };
  }
}

/**
 * Gets badges by requirement ID and category
 * @param requirementId - ID of the requirement
 * @returns Array of badges that have the specified requirement
 */
export async function getBadgesByRequirementId(
  requirementId: string
): Promise<Badge[]> {
  // Get all badges and filter those that contain the requirementId
  const allBadges = await prisma.badge.findMany();
  
  const badges = allBadges.filter((badge) =>
    badge.requirements?.some((req: any) => req.id === requirementId)
  );

  if (badges.length === 0) {
    return [];
  }
  
  const badgesToReturn = badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    description: badge.description,
    
    image_path: badge.image_path,
    category: badge.category,
    requirements: badge.requirements?.map((requirement) =>
      parseBadgeMetadata(requirement)
    ) as Requirement[] || [],
  }));

  return badgesToReturn;
}

/**
 * Checks if a user has a specific social badge by requirement
 * @param userId - User ID
 * @param requirementId - Requirement ID
 * @returns true if user has the badge, false otherwise
 */
export async function hasSocialBadgeByRequirement(
  userId: string, 
  requirementId: string
): Promise<boolean> {
  try {
    const badges = await getBadgesByRequirementId(requirementId);
    
    if (badges.length === 0) {
      return false;
    }

    // Check if user has any of the badges for this requirement
    for (const badge of badges) {
      const userBadge = await prisma.userBadge.findUnique({
        where: {
          user_id_badge_id: {
            user_id: userId,
            badge_id: badge.id,
          },
        },
      });

      if (userBadge) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking social badge by requirement:", error);
    return false;
  }
}
