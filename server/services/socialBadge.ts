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
    console.log('badges found', badges);
    if (!badges || badges.length === 0) {
      return {
        success: false,
        message: `No social badges found for requirement: ${requirementId}`,
        badges: []
      };
    }

    const awardedBadges: any[] = [];

    for (const badge of badges) {
      // Find the specific requirement that was fulfilled
      const fulfilledRequirement = badge.requirements?.find((req: any) => req.id === requirementId);
      
      if (!fulfilledRequirement) {
        continue;
      }

      // Check if the user already has this badge
      const existingUserBadge = await prisma.userBadge.findUnique({
        where: {
          user_id_badge_id: {
            user_id: userId,
            badge_id: badge.id,
          },
        },
      });
      
      if (existingUserBadge) {
        // User already has the badge, check if requirement is already in evidence
        const completedRequirements = (existingUserBadge.evidence as Requirement[]) || [];
        
        // Check if this requirement is already completed
        const requirementAlreadyCompleted = completedRequirements.some(
          (req: any) => req && req.id && String(req.id) === String(requirementId)
        );
        
        if (requirementAlreadyCompleted) {
          // Requirement already exists, skip it
          continue;
        }
        
        // Add the new requirement to the completed requirements
        completedRequirements.push(fulfilledRequirement);
        
        // Check if all requirements are completed
        const allRequirementsCompleted = badge.requirements?.every((req: any) => {
          if (!req || !req.id) return false;
          return completedRequirements.some((completed: any) => 
            completed && completed.id && String(completed.id) === String(req.id)
          );
        });
        
        // Determine badge status based on requirements completion
        const badgeStatus = allRequirementsCompleted 
          ? BadgeAwardStatus.approved 
          : BadgeAwardStatus.pending;
        
        // Update the existing badge with the new requirement
        await prisma.userBadge.update({
          where: {
            user_id_badge_id: {
              user_id: userId,
              badge_id: badge.id,
            },
          },
          data: {
            status: badgeStatus,
            evidence: completedRequirements,
            awarded_at: badgeStatus === BadgeAwardStatus.approved ? new Date() : existingUserBadge.awarded_at,
          },
        });
        
        console.log('badge updated with new requirement', badge.name);
        awardedBadges.push({
          name: badge.name,
          image_path: badge.image_path,
          completed_requirement: fulfilledRequirement,
          status: badgeStatus === BadgeAwardStatus.approved ? 'approved' : 'pending'
        });
      } else {
        // User doesn't have the badge, create it
        // Check if all requirements are completed (only one requirement completed so far)
        const completedRequirements = [fulfilledRequirement];
        const allRequirementsCompleted = badge.requirements?.every((req: any) => {
          if (!req || !req.id) return false;
          return completedRequirements.some((completed: any) => 
            completed && completed.id && String(completed.id) === String(req.id)
          );
        });
        
        const badgeStatus = allRequirementsCompleted 
          ? BadgeAwardStatus.approved 
          : BadgeAwardStatus.pending;
        
        await prisma.userBadge.create({
          data: {
            user_id: userId,
            badge_id: badge.id,
            awarded_at: badgeStatus === BadgeAwardStatus.approved ? new Date() : undefined,
            awarded_by: awardedBy,
            status: badgeStatus,
            requirements_version: 1,
            evidence: completedRequirements,
          },
        });
        
        console.log('badge assigned', badge.name);
        awardedBadges.push({
          name: badge.name,
          image_path: badge.image_path,
          completed_requirement: fulfilledRequirement,
          status: badgeStatus === BadgeAwardStatus.approved ? 'approved' : 'pending'
        });
      }
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
