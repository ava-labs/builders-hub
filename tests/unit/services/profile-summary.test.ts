import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeAwardStatus } from "@/types/badge";

const { badgeFindMany, userBadgeFindMany } = vi.hoisted(() => ({
  badgeFindMany: vi.fn(),
  userBadgeFindMany: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    badge: { findMany: badgeFindMany },
    userBadge: { findMany: userBadgeFindMany },
  },
}));

import { getUserBadgesForProfile } from "@/server/services/profile-summary";

const course = (courseId: string) => ({
  id: `${courseId}-complete`,
  type: "course",
  unlocked: false,
  course_id: courseId,
  description: `Complete the ${courseId} course`,
});

type BadgeRow = { id: string; name: string; description: string; image_path: string; category: string; requirements: ReturnType<typeof course>[] };

const badge = (id: string, courseIds: string[]): BadgeRow => ({
  id,
  name: id,
  description: `Badge ${id}`,
  image_path: `https://example.com/${id}.png`,
  category: "academy",
  requirements: courseIds.map(course),
});

const NFT_DEPLOYMENT = badge("2blockchainAcademy-3nft-deployment", ["nft-deployment"]);
const X402 = badge("2blockchainAcademy-4x402-payments", ["x402-payment-infrastructure"]);
// The Graduate as the database holds it until the R1 migration runs: nft-deployment among four live courses.
const GRADUATE = badge("2blockchainAcademy-6academy-full-completion", [
  "blockchain-fundamentals",
  "solidity-foundry",
  "nft-deployment",
  "x402-payment-infrastructure",
  "encrypted-erc",
]);

/** The badges in the DB, and the ones user u1 holds with every requirement as evidence. */
function given(badges: BadgeRow[], held: BadgeRow[]) {
  badgeFindMany.mockResolvedValue(badges);
  userBadgeFindMany.mockResolvedValue(
    held.map((row) => ({
      user_id: "u1",
      badge_id: row.id,
      awarded_at: new Date("2026-01-01T00:00:00Z"),
      awarded_by: "system",
      status: BadgeAwardStatus.approved,
      requirements_version: 1,
      evidence: row.requirements,
      badge: row,
    })),
  );
}

const shownIds = async () => (await getUserBadgesForProfile("u1")).map((summary) => summary.badgeId);

beforeEach(() => {
  badgeFindMany.mockReset();
  userBadgeFindMany.mockReset();
});

describe("getUserBadgesForProfile: badges of removed courses (FDE-154)", () => {
  it("hides the NFT Deployment badge from a user who never earned it", async () => {
    given([NFT_DEPLOYMENT, X402], []);
    expect(await shownIds()).toEqual([X402.id]);
  });

  it("keeps the NFT Deployment badge, unlocked, for a user who earned it", async () => {
    given([NFT_DEPLOYMENT, X402], [NFT_DEPLOYMENT]);
    const summaries = await getUserBadgesForProfile("u1");
    expect(summaries.map((summary) => [summary.badgeId, summary.isUnlocked])).toEqual([
      [NFT_DEPLOYMENT.id, true],
      [X402.id, false],
    ]);
  });

  it("keeps a badge that still has live courses among its requirements, such as the Graduate before its migration", async () => {
    given([GRADUATE], []);
    expect(await shownIds()).toEqual([GRADUATE.id]);
  });
});
