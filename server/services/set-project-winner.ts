import { prisma } from "@/prisma/prisma";
import { badgeAssignmentService } from "./badgeAssignmentService";
import { AssignBadgeResult, BadgeCategory } from "./badge";

export async function SetWinner(
  project_id: string,
  isWinner: boolean,
  awardedBy: string
) {

  const project = await prisma.project.update({
    where: { id: project_id },
    data: { is_winner: isWinner },
  });
  const body = {
    projectId: project_id,
    userId: "",
    hackathonId: project.hackaton_id ?? undefined,
    awardedBy: awardedBy,
    category: BadgeCategory.project,
  };
  let badge: AssignBadgeResult = {
    success: false,
    message: "No badges assigned",
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

    badge = await badgeAssignmentService.assignBadge(sanitizedBody, awardedBy);
  }

  return badge;
}
