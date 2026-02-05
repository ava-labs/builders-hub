import { prisma } from "@/prisma/prisma";
import { badgeAssignmentService } from "./badgeAssignmentService";
import { AssignBadgeResult, BadgeCategory } from "./badge";

export async function SetWinner(
  project_id: string,
  isWinner: boolean,
  awardedBy: string
) {
  // Check if project exists and get current winner status
  const existingProject = await prisma.project.findUnique({
    where: { id: project_id },
    select: { is_winner: true },
  });

  if (!existingProject) {
    throw new Error("Project not found");
  }

  // Check if project is already a winner
  if (existingProject.is_winner === true && isWinner === true) {
    return {
      success: false,
      message: "Project is already set as winner",
      alreadyWinner: true,
      badge_id: "",
      user_id: "",
      badges: [],
    };
  }

  const project = await prisma.project.update({
    where: { id: project_id },
    data: { is_winner: isWinner },
  });
  const body = {
    projectId: project_id,
    userId: "",
    hackathonId: project.hackaton_id,
    awardedBy: awardedBy,
    category: BadgeCategory.project,
  };
  let result: AssignBadgeResult & { alreadyWinner?: boolean } = {
    success: true,
    message: "Project winner status updated successfully",
    badge_id: "",
    user_id: "",
    badges: [],
  };

  if (isWinner === true) {
    // HackathonId must be string or undefined, not null
    const sanitizedBody = {
      ...body,
      hackathonId: project.hackaton_id ?? undefined,
    };

    const badge = await badgeAssignmentService.assignBadge(sanitizedBody, awardedBy);
    result = {
      ...badge,
      success: true,
    };
  }

  return result;
}
