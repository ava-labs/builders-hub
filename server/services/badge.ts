import { prisma } from "@/prisma/prisma";
import { Badge, BadgeAwardStatus, Requirement } from "@/types/badge";
import { parseBadgeMetadata } from "./rewardBoard";

export enum BadgeCategory {
  academy,
  project,
  requirement,

}

export interface AssignBadgeBody {
  category?: BadgeCategory;
  courseId?: string;
  userId: string;
  hackathonId?: string;
  projectId?: string;
  requirementId?: string; // For social badges - specific requirement to fulfill
  badgesId?: string[];
}

export interface AssignBadgeResult {
  success: boolean;
  message: string;
  badge_id: string;
  user_id: string;
  badges: BadgeData[] | [];
}

export interface BadgeData {
  name: string;
  image_path: string;
  completed_requirement: Requirement;
}

export async function getAllBadges(): Promise<Badge[]> {
  const badges = await prisma.badge.findMany({});

  return badges.map((badge) => ({
    ...badge,
    requirements: badge.requirements.map((requirement) =>
      parseBadgeMetadata(requirement)
    ) as Requirement[],
  }));
}

export async function assignBadgeAcademy(
  body: AssignBadgeBody
): Promise<AssignBadgeResult> {
  const badgesAcademy = await getBadgeByCourseId(body.courseId!);
  let badgeToReturn: AssignBadgeResult = {
    success: false,
    message: "Badges not found",
    badge_id: "",
    user_id: "",
    badges: [],
  };
  if (!badgesAcademy) {
    return badgeToReturn;
  }
  for (const badge of badgesAcademy) {
    const isBadgeAlreadyAwarded = await validateBadge(badge.id, body.userId);
    if (isBadgeAlreadyAwarded) {
      continue;
    }
    const badgeRequirements = badge.requirements;
    const badgeImage: string = badge.image_path as string;
    const existingUserBadge = await prisma.userBadge.findUnique({
      where: {
        user_id_badge_id: {
          user_id: body.userId,
          badge_id: badge.id,
        },
      },
    });

    const completedRequirements =
      (existingUserBadge?.evidence as Requirement[]) || [];
    const currentRequirement = badgeRequirements?.find(
      (req: any) => req.course_id === body.courseId
    );
    
    let isNewRequirement = false;
    if (
      currentRequirement &&
      currentRequirement.id &&
      !completedRequirements.some((req: any) => 
        req && req.id && String(req.id) === String(currentRequirement.id)
      )
    ) {
      completedRequirements.push(currentRequirement);
      isNewRequirement = true;
    }

    // Check if all requirements are completed by comparing IDs
    const allRequirementsCompleted = badgeRequirements?.every((req: any) => {
      if (!req || !req.id) return false;
      return completedRequirements.some((completed: any) => 
        completed && completed.id && String(completed.id) === String(req.id)
      );
    });

    const someRequirementsCompleted = completedRequirements.length > 0;
    let badgeStatus = BadgeAwardStatus.pending;

    if (allRequirementsCompleted) {
      badgeStatus = BadgeAwardStatus.approved;
      // Only add badge to return array when all requirements are completed
      (badgeToReturn.badges as BadgeData[]).push({
        name: badge.name,
        image_path: badgeImage,
        completed_requirement: currentRequirement || (badgeRequirements && badgeRequirements[0]) || ({} as Requirement),
      });
      badgeToReturn.success = true;
      badgeToReturn.message = "Badge assigned successfully";
      badgeToReturn.badge_id = badge.id;
      badgeToReturn.user_id = body.userId;
    } else if (someRequirementsCompleted) {
      badgeStatus = BadgeAwardStatus.pending;
    }

    if (someRequirementsCompleted) {
      await prisma.userBadge.upsert({
        where: {
          user_id_badge_id: {
            user_id: body.userId,
            badge_id: badge.id,
          },
        },
        update: {
          awarded_at:
            badgeStatus == BadgeAwardStatus.approved
              ? new Date()
              : existingUserBadge?.awarded_at,
          awarded_by: "system",
          status: badgeStatus,
          requirements_version: 1,
          evidence: completedRequirements,
        },
        create: {
          user_id: body.userId,
          badge_id: badge.id,
          awarded_at:
            badgeStatus == BadgeAwardStatus.approved ? new Date() : undefined,
          awarded_by: "system",
          status: badgeStatus,
          requirements_version: 1,
          evidence: completedRequirements,
        },
      });
    }
  }

  return badgeToReturn;
}

export async function validateBadge(
  badgeId: string,
  userId: string
): Promise<boolean> {
  const existingUserBadge = await prisma.userBadge.findUnique({
    where: {
      user_id_badge_id: {
        user_id: userId,
        badge_id: badgeId,
      },
    },
  });
  return existingUserBadge?.status == BadgeAwardStatus.approved;
}

export async function getBadgeByCourseId(courseId: string): Promise<Badge[]> {
  const badges = await prisma.badge.findMany({
    where: {
      category: "academy",
    },
  });

  const filteredBadges = badges.filter((badge) =>
    badge.requirements?.some((req: any) => req.course_id === courseId)
  );

  if (filteredBadges.length === 0) {
    throw new Error(`Badge not found for course ID: ${courseId}`);
  }

  return filteredBadges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    description: badge.description,
    points: 0,
    image_path: badge.image_path,
    category: badge.category,
    requirements: badge.requirements.map((requirement) =>
      parseBadgeMetadata(requirement)
    ) as Requirement[],
  }));
}

export async function getBadgesByHackathonId(
  hackathonId: string
): Promise<Badge[]> {
  const badges = await prisma.badge.findMany({
    where: {
      category: "hackathon",
    },
  });

  const filteredBadges = badges.filter((badge) =>
    badge.requirements?.some((req: any) => req.hackathon == hackathonId)
  );
  if (filteredBadges.length === 0) {
    throw new Error(`Badge not found for hackathon ID: ${hackathonId}`);
  }

  return filteredBadges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    description: badge.description,
    
    image_path: badge.image_path,
    category: badge.category,
    requirements: badge.requirements.map((requirement) =>
      parseBadgeMetadata(requirement)
    ) as Requirement[],
  }));
}


export async function getBadgesByIds(
  badgesIds: string[]
): Promise<Badge[]> {
  const badges = await prisma.badge.findMany({
    where: {
      id: {
        in: badgesIds,
      },
    },
  });

  return badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    description: badge.description,
    
    image_path: badge.image_path,
    category: badge.category,
    requirements: badge.requirements.map((requirement) =>
      parseBadgeMetadata(requirement)
    ) as Requirement[],
  }));
}