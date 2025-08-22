
import { prisma } from "@/prisma/prisma";
import { Badge, Requirement } from "@/types/badge";
import { parseBadgeMetadata } from "./rewardBoard";

export async function getAllBadges():Promise<Badge[]> {
  const badges = await prisma.badge.findMany({
  });

  return badges.map((badge) => ({
    ...badge,
    requirements: badge.requirements.map((requirement) => parseBadgeMetadata(requirement)) as Requirement[],
  }));
}