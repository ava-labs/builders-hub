import { prisma } from "@/prisma/prisma";
import {
  AssignBadgeBody,
  AssignBadgeResult,
  BadgeData,
  getBadgesByHackathonId,
  getBadgesByIds,
  validateBadge,
} from "./badge";
import {
  Badge,
  BadgeAwardStatus,
  ProjectBadge,
  Requirement,
  UserBadge,
} from "@/types/badge";

export async function assignBadgeProject(
  body: AssignBadgeBody,
  awarded_by: string
): Promise<AssignBadgeResult> {
  let badgesHackathon: Badge[] = [];
  let isValidateRequirements = true;
  if (body.badgesId && body.badgesId.length > 0) {
    isValidateRequirements = false;
    const badges = await getBadgesByIds(body.badgesId!);
    badgesHackathon = badges;
  } else {
    badgesHackathon = await getBadgesByHackathonId(body.hackathonId!);
  }

  let badgeToReturn: AssignBadgeResult = {
    success: false,
    message: "No results",
    badge_id: "",
    user_id: "",
    badges: [],
  };

  if (!badgesHackathon) {
    return badgeToReturn;
  }

  const userProject = await prisma.project.findUnique({
    where: {
      id: body.projectId,
      members: {
        some: {
          status: "Confirmed",
        },
      },
    },
    include: {
      members: {
        where: {
          status: "Confirmed",
          user_id: {
            not: null,
          },
        },
      },
    },
  });

  if (!userProject) {
    return badgeToReturn;
  }

  const userProjectMembers = userProject.members;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const awardedBadges: BadgeData[] = [];

      for (const badge of badgesHackathon) {
        for (const member of userProjectMembers) {
          const modifiedBody: AssignBadgeBody = {
            ...body,
            userId: member.user_id!,
          };

          const userBadgeResult = await awardBadgeUserWithTransaction(
            modifiedBody,
            awarded_by,
            badge,
            tx,
            isValidateRequirements
          );

          if (userBadgeResult.success && userBadgeResult.badges) {
            awardedBadges.push(...userBadgeResult.badges);
          }
        }

        const projectBadgeResult = await awardBadgeProjectWithTransaction(
          body,
          awarded_by,
          badge,
          tx
        );

        if (projectBadgeResult.success && projectBadgeResult.badges) {
          awardedBadges.push(...projectBadgeResult.badges);
        }
      }

      return {
        success: true,
        message: "Badges assigned successfully",
        badge_id: badgesHackathon[0]?.id || "",
        user_id: body.userId,
        badges: awardedBadges,
      };
    });

    return result;
  } catch (error) {
    console.error("Error in transaction:", error);

    return {
      success: false,
      message: `Transaction failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      badge_id: "",
      user_id: "",
      badges: [],
    };
  }
}

async function awardBadgeUserWithTransaction(
  body: AssignBadgeBody,
  awarded_by: string,
  badge: Badge,
  tx: any,
  validateRequirements: boolean = true
): Promise<AssignBadgeResult> {
  try {
    const isBadgeAlreadyAwarded = await validateBadge(badge.id, body.userId);

    if (isBadgeAlreadyAwarded) {
      return {
        success: false,
        message: "Badge already awarded",
        badge_id: badge.id,
        user_id: body.userId,
        badges: [],
      };
    }

    const badgeRequirements = badge.requirements;
    const existingUserBadge = await tx.userBadge.findUnique({
      where: {
        user_id_badge_id: {
          user_id: body.userId,
          badge_id: badge.id,
        },
      },
    });

    let completedRequirements: Requirement[] = [];
    let badgeStatus = BadgeAwardStatus.pending;
    let awardedBadges: BadgeData[] = [];

    if (!validateRequirements) {
      completedRequirements = badgeRequirements || [];
      badgeStatus = BadgeAwardStatus.approved;
      awardedBadges.push({
        name: badge.name,
        image_path: badge.image_path as string,
        completed_requirement: badgeRequirements?.[0] || ({} as Requirement),
      });
    } else {
      completedRequirements =
        (existingUserBadge?.evidence as Requirement[]) || [];
      const currentRequirement = badgeRequirements?.find(
        (req: any) => req.hackathon === body.hackathonId
      );

      if (
        currentRequirement &&
        !completedRequirements.some(
          (req: any) => req.id == currentRequirement.id
        )
      ) {
        completedRequirements.push(currentRequirement);
      }

      const allRequirementsCompleted = badgeRequirements?.every((req: any) =>
        completedRequirements.some((completed: any) => completed.id == req.id)
      );

      const someRequirementsCompleted = completedRequirements.length > 0;

      if (allRequirementsCompleted) {
        badgeStatus = BadgeAwardStatus.approved;
        awardedBadges.push({
          name: badge.name,
          image_path: badge.image_path as string,
          completed_requirement: currentRequirement!,
        });
      } else if (someRequirementsCompleted) {
        badgeStatus = BadgeAwardStatus.pending;
      }
    }

    if (completedRequirements.length > 0 || !validateRequirements) {
      await tx.userBadge.upsert({
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
          awarded_by: awarded_by,
          status: badgeStatus,
          requirements_version: 1,
          evidence: completedRequirements,
        },
        create: {
          user_id: body.userId,
          badge_id: badge.id,
          awarded_at:
            badgeStatus == BadgeAwardStatus.approved ? new Date() : undefined,
          awarded_by: awarded_by,
          status: badgeStatus,
          requirements_version: 1,
          evidence: completedRequirements,
        },
      });
    }

    return {
      success: true,
      message: "User badge assigned successfully",
      badge_id: badge.id,
      user_id: body.userId,
      badges: awardedBadges,
    };
  } catch (error) {
    console.error("Error in awardBadgeUserWithTransaction:", error);
    throw error; // Re-lanzar para que la transacción haga rollback
  }
}

async function awardBadgeProjectWithTransaction(
  body: AssignBadgeBody,
  awarded_by: string,
  badge: Badge,
  tx: any
): Promise<AssignBadgeResult> {
  try {
    const existingProjectBadge = await tx.projectBadge.findUnique({
      where: {
        project_id_badge_id: {
          project_id: body.projectId!,
          badge_id: badge.id,
        },
      },
    });

    const completedRequirements =
      (existingProjectBadge?.evidence as Requirement[]) || [];
    const currentRequirement = badge.requirements?.find(
      (req: any) => req.hackathon_id === body.hackathonId
    );

    if (
      currentRequirement &&
      !completedRequirements.some((req: any) => req.id == currentRequirement.id)
    ) {
      completedRequirements.push(currentRequirement);
    }

    const allRequirementsCompleted = badge.requirements?.every((req: any) =>
      completedRequirements.some((completed: any) => completed.id == req.id)
    );

    const someRequirementsCompleted = completedRequirements.length > 0;
    let badgeStatus = BadgeAwardStatus.pending;
    let awardedBadges: BadgeData[] = [];

    if (allRequirementsCompleted) {
      badgeStatus = BadgeAwardStatus.approved;
      awardedBadges.push({
        name: badge.name,
        image_path: badge.image_path as string,
        completed_requirement: currentRequirement!,
      });
    } else if (someRequirementsCompleted) {
      badgeStatus = BadgeAwardStatus.pending;
    }

    await tx.projectBadge.upsert({
      where: {
        project_id_badge_id: {
          project_id: body.projectId!,
          badge_id: badge.id,
        },
      },
      update: {
        awarded_at:
          badgeStatus == BadgeAwardStatus.approved
            ? new Date()
            : existingProjectBadge?.awarded_at,
        awarded_by: awarded_by,
        status: badgeStatus,
        requirements_version: 1,
        evidence: completedRequirements,
      },
      create: {
        project_id: body.projectId!,
        badge_id: badge.id,
        awarded_at:
          badgeStatus == BadgeAwardStatus.approved ? new Date() : undefined,
        awarded_by: awarded_by,
        status: badgeStatus,
        requirements_version: 1,

        evidence: completedRequirements,
      },
    });

    return {
      success: true,
      message: "Project badge assigned successfully",
      badge_id: badge.id,
      user_id: body.userId,
      badges: awardedBadges,
    };
  } catch (error) {
    console.error("Error in awardBadgeProjectWithTransaction:", error);
    throw error; // Re-lanzar para que la transacción haga rollback
  }
}

export async function getProjectBadges(
  projectId: string
): Promise<ProjectBadge[]> {
  const projectBadges = await prisma.projectBadge.findMany({
    where: {
      project_id: projectId,
    },
    include: {
      badge: true,
    },
  });
  const badges = projectBadges.map((badge) => ({
    ...badge,
    name: badge.badge.name,
    image_path: badge.badge.image_path,
  }));

  return badges as unknown as ProjectBadge[];
}

export async function getUserBadgesByProjectId(
  projectId: string
): Promise<UserBadge[]> {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      members: {
        some: {
          status: "Confirmed",
        },
      },
    },
    include: {
      members: true,
    },
  });

  const userBadges = await prisma.userBadge.findMany({
    where: {
      user_id: {
        in: project?.members
          .map((member) => member.user_id)
          .filter((id): id is string => id !== null && id !== undefined),
      },
    },
    include: {
      badge: true,
    },
  });

  const badgesReturn = userBadges.map((badge) => ({
    ...badge,
    name: badge.badge.name,
    image_path: badge.badge.image_path,
  }));

  return badgesReturn as unknown as UserBadge[];
}
