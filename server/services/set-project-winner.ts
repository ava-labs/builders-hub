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
    hackathonId: project.hackaton_id,
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

  if (isWinner===true) {

    badge = await badgeAssignmentService.assignBadge(body, awardedBy);
  }

  return badge;
}
