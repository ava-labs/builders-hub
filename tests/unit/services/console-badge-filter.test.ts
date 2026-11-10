import { beforeEach, describe, expect, it, vi } from "vitest";

const { badgeFindMany, userBadgeFindMany, projectFindUnique } = vi.hoisted(() => ({
  badgeFindMany: vi.fn(),
  userBadgeFindMany: vi.fn(),
  projectFindUnique: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    badge: { findMany: badgeFindMany },
    userBadge: { findMany: userBadgeFindMany },
    project: { findUnique: projectFindUnique },
  },
}));

import { getAllBadges, getBadgesByIds } from "@/server/services/badge";
import { getUserBadgesByProjectId } from "@/server/services/project-badge";
import { getRewardBoard, NOT_CONSOLE_BADGE } from "@/server/services/rewardBoard";
import { getBadgesByRequirementId } from "@/server/services/socialBadge";

// The Console no longer gives badges, but its rows stay in the database. Each
// badge read must leave them out, or they show on the profile and the showcase
// and the award paths can write them again.

beforeEach(() => {
  badgeFindMany.mockReset().mockResolvedValue([]);
  userBadgeFindMany.mockReset().mockResolvedValue([]);
  projectFindUnique.mockReset().mockResolvedValue({ members: [{ user_id: "u1" }] });
});

describe("console badge rows", () => {
  it("match on the category or on an id that names the console, in any case", () => {
    expect(NOT_CONSOLE_BADGE).toEqual({
      NOT: [
        { category: { equals: "console", mode: "insensitive" } },
        { id: { contains: "console", mode: "insensitive" } },
      ],
    });
  });

  it("are left out of the badge list (profile and /api/badge/get-all)", async () => {
    await getAllBadges();
    expect(badgeFindMany).toHaveBeenCalledWith({ where: NOT_CONSOLE_BADGE });
  });

  it("are left out of a user's badges", async () => {
    await getRewardBoard("u1");
    expect(userBadgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: "u1", badge: NOT_CONSOLE_BADGE } }),
    );
  });

  it("cannot be assigned by id", async () => {
    await getBadgesByIds(["b1"]);
    expect(badgeFindMany).toHaveBeenCalledWith({ where: { id: { in: ["b1"] }, ...NOT_CONSOLE_BADGE } });
  });

  it("cannot be assigned by requirement id", async () => {
    await getBadgesByRequirementId("1");
    expect(badgeFindMany).toHaveBeenCalledWith({ where: NOT_CONSOLE_BADGE });
  });

  it("are left out of the showcase team badges", async () => {
    await getUserBadgesByProjectId("p1");
    expect(userBadgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: { in: ["u1"] }, badge: NOT_CONSOLE_BADGE } }),
    );
  });
});
