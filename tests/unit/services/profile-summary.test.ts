import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeAwardStatus } from "@/types/badge";

const {
  badgeFindMany,
  userBadgeFindMany,
  memberCount,
  consoleLogFindFirst,
  faucetClaimFindFirst,
  nodeRegistrationFindFirst,
} = vi.hoisted(() => ({
  badgeFindMany: vi.fn(),
  userBadgeFindMany: vi.fn(),
  memberCount: vi.fn(),
  consoleLogFindFirst: vi.fn(),
  faucetClaimFindFirst: vi.fn(),
  nodeRegistrationFindFirst: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    badge: { findMany: badgeFindMany },
    userBadge: { findMany: userBadgeFindMany },
    member: { count: memberCount },
    consoleLog: { findFirst: consoleLogFindFirst },
    faucetClaim: { findFirst: faucetClaimFindFirst },
    nodeRegistration: { findFirst: nodeRegistrationFindFirst },
  },
}));

import { getAcademyProgress, getProfileEngagement, getUserBadgesForProfile } from "@/server/services/profile-summary";
import { NOT_CONSOLE_BADGE } from "@/server/services/rewardBoard";

const course = (courseId: string) => ({
  id: `${courseId}-complete`,
  type: "course",
  unlocked: false,
  course_id: courseId,
  description: `Complete the ${courseId} course`,
});

type RequirementRow = {
  id: string;
  type: string;
  unlocked: boolean;
  course_id?: string;
  hackathon?: string;
  description: string;
};

type BadgeRow = { id: string; name: string; description: string; image_path: string; category: string; requirements: RequirementRow[] };

const badge = (id: string, courseIds: string[], category = "academy"): BadgeRow => ({
  id,
  name: id,
  description: `Badge ${id}`,
  image_path: `https://example.com/${id}.png`,
  category,
  requirements: courseIds.map(course),
});

/** A hackathon prize badge: its one requirement names the hackathon (set-project-winner.ts, project-badge.ts). */
const prize = (id: string, hackathonId: string, category = "hackathon"): BadgeRow => ({
  ...badge(id, [], category),
  requirements: [
    {
      id: `${hackathonId}-won`,
      type: "hackathon",
      unlocked: false,
      hackathon: hackathonId,
      description: "Win a prize",
    },
  ],
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
  memberCount.mockReset().mockResolvedValue(0);
  consoleLogFindFirst.mockReset().mockResolvedValue(null);
  faucetClaimFindFirst.mockReset().mockResolvedValue(null);
  nodeRegistrationFindFirst.mockReset().mockResolvedValue(null);
});

describe("getUserBadgesForProfile: badges of removed courses (FDE-154)", () => {
  it("hides the NFT Deployment badge from a user who never earned it", async () => {
    given([NFT_DEPLOYMENT, X402], []);
    expect(await shownIds()).toEqual([X402.id]);
  });

  it("keeps the NFT Deployment badge, unlocked and last, for a user who earned it", async () => {
    given([NFT_DEPLOYMENT, X402], [NFT_DEPLOYMENT]);
    const summaries = await getUserBadgesForProfile("u1");
    expect(summaries.map((summary) => [summary.badgeId, summary.isUnlocked])).toEqual([
      [X402.id, false],
      [NFT_DEPLOYMENT.id, true],
    ]);
  });

  it("keeps a badge that still has live courses among its requirements, such as the Graduate before its migration", async () => {
    given([GRADUATE], []);
    expect(await shownIds()).toEqual([GRADUATE.id]);
  });
});

// The Entrepreneur Academy badges as the seed names them (prisma/seeds/entrepreneurBadges.ts:5-10). The
// Graduate's stored requirements are not in the repo; modelled here as the four courses.
const FOUNDATIONS = badge("3entrepreneurAcademy-1foundations-web3-venture", ["foundations-web3-venture"]);
const ENTREPRENEUR_GRADUATE = badge("3entrepreneurAcademy-5academy-full-completion", [
  "foundations-web3-venture",
  "fundraising-finance",
  "go-to-market",
  "web3-community-architect",
]);

/** User u1's pending row for a badge they only started: evidence for the first `done` requirements. */
const started = (row: BadgeRow, done: number) => ({
  user_id: "u1",
  badge_id: row.id,
  awarded_at: new Date("2026-01-01T00:00:00Z"),
  awarded_by: "system",
  status: BadgeAwardStatus.pending,
  requirements_version: 1,
  evidence: row.requirements.slice(0, done),
  badge: row,
});

describe("getUserBadgesForProfile: badges of the removed Entrepreneur Academy (FDE-153)", () => {
  it("hides the Entrepreneur course badges and the Entrepreneur Graduate from a user who never earned them", async () => {
    given([FOUNDATIONS, ENTREPRENEUR_GRADUATE, X402], []);
    expect(await shownIds()).toEqual([X402.id]);
  });

  it("keeps an earned Entrepreneur badge, unlocked, for its holder", async () => {
    given([FOUNDATIONS, X402], [FOUNDATIONS]);
    const summaries = await getUserBadgesForProfile("u1");
    expect(summaries.map((summary) => [summary.badgeId, summary.isUnlocked])).toEqual([
      [X402.id, false],
      [FOUNDATIONS.id, true],
    ]);
  });

  it("hides a retired badge the user only started, and keeps a started live one, locked", async () => {
    badgeFindMany.mockResolvedValue([ENTREPRENEUR_GRADUATE, GRADUATE]);
    userBadgeFindMany.mockResolvedValue([started(ENTREPRENEUR_GRADUATE, 2), started(GRADUATE, 2)]);
    const summaries = await getUserBadgesForProfile("u1");
    expect(summaries.map((summary) => [summary.badgeId, summary.isUnlocked])).toEqual([[GRADUATE.id, false]]);
  });
});

describe("getUserBadgesForProfile: console badges were removed", () => {
  it("reads the badges and the user's badges without the stored console rows", async () => {
    given([X402], []);
    await getUserBadgesForProfile("u1");
    expect(badgeFindMany).toHaveBeenCalledWith({ where: NOT_CONSOLE_BADGE });
    expect(userBadgeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: "u1", badge: NOT_CONSOLE_BADGE } }),
    );
  });
});

// The Academy badges as the database names them: the course_id is the course folder
// (solidity-foundry for Intro to Solidity), and Access Restriction needs two halves.
const BLOCKCHAIN_FUNDAMENTALS = badge("2blockchainAcademy-1blockchain-fundamentals", ["blockchain-fundamentals"]);
const AVALANCHE_FUNDAMENTALS = badge("1avalancheL1Academy-1avalanche-fundamentals", ["avalanche-fundamentals"]);
const ACCESS_RESTRICTION = badge("1avalancheL1Academy-9access-restriction", [
  "access-restriction-fundamentals",
  "access-restriction-advanced",
]);
const INTRO_TO_SOLIDITY = badge("2blockchainAcademy-2intro-to-solidity", ["solidity-foundry"]);
const ENCRYPTED_ERC = badge("2blockchainAcademy-5encrypted-erc", ["encrypted-erc"]);
const L1_GRADUATE = badge("1avalancheL1Academy-10academy-full-completion", [
  "avalanche-fundamentals",
  "permissioned-l1s",
  "access-restriction-fundamentals",
  "access-restriction-advanced",
]);

describe("getUserBadgesForProfile: groups", () => {
  it("puts every badge in the academy or the hackathon group by its category, in any case", async () => {
    const won = prize("hackathon-prize-1", "h1", "Hackathon");
    given([won, badge("1avalancheL1Academy-1avalanche-fundamentals", ["avalanche-fundamentals"], "ACADEMY")], [won]);
    const summaries = await getUserBadgesForProfile("u1");
    expect(summaries.map((summary) => [summary.badgeId, summary.group])).toEqual([
      [AVALANCHE_FUNDAMENTALS.id, "academy"],
      [won.id, "hackathon"],
    ]);
  });

  it("leaves out console, social and other badges, even when a read returns them and the user holds them", async () => {
    const consoleBadge = badge("console-node-runner", [], "console");
    const social = badge("social-github", [], "social");
    const other = badge("devrel-pick", [], "requirement");
    given([consoleBadge, social, other, X402], [consoleBadge, social, other]);
    expect(await shownIds()).toEqual([X402.id]);
  });
});

describe("getUserBadgesForProfile: Academy order", () => {
  it("orders course badges by the Academy reading order, the Graduates after them, earned retired badges last", async () => {
    given(
      [
        NFT_DEPLOYMENT,
        L1_GRADUATE,
        ENCRYPTED_ERC,
        GRADUATE,
        INTRO_TO_SOLIDITY,
        ACCESS_RESTRICTION,
        AVALANCHE_FUNDAMENTALS,
        BLOCKCHAIN_FUNDAMENTALS,
      ],
      [NFT_DEPLOYMENT],
    );
    expect(await shownIds()).toEqual([
      BLOCKCHAIN_FUNDAMENTALS.id,
      AVALANCHE_FUNDAMENTALS.id,
      ACCESS_RESTRICTION.id,
      INTRO_TO_SOLIDITY.id,
      ENCRYPTED_ERC.id,
      GRADUATE.id,
      L1_GRADUATE.id,
      NFT_DEPLOYMENT.id,
    ]);
  });

  it("hides an Academy badge that names no course of the programme from a user who does not hold it", async () => {
    given([badge("1devAcademy-9unknown", ["no-such-course"]), X402], []);
    expect(await shownIds()).toEqual([X402.id]);
  });
});

describe("getUserBadgesForProfile: hackathon badges", () => {
  it("shows only the prizes the user won, newest first, and no locked prize of another hackathon", async () => {
    const first = prize("hackathon-prize-1", "h1");
    const second = prize("hackathon-prize-2", "h2");
    const others = prize("hackathon-prize-3", "h3");
    badgeFindMany.mockResolvedValue([first, others, second]);
    userBadgeFindMany.mockResolvedValue(
      [
        [first, "2026-01-01T00:00:00Z"],
        [second, "2026-05-01T00:00:00Z"],
      ].map(([row, at]) => ({
        user_id: "u1",
        badge_id: (row as BadgeRow).id,
        awarded_at: new Date(at as string),
        awarded_by: "admin",
        status: BadgeAwardStatus.approved,
        requirements_version: 1,
        evidence: (row as BadgeRow).requirements,
        badge: row,
      })),
    );
    const summaries = await getUserBadgesForProfile("u1");
    expect(summaries.map((summary) => [summary.badgeId, summary.isUnlocked])).toEqual([
      [second.id, true],
      [first.id, true],
    ]);
  });

  it("shows no hackathon badge to a user who won none", async () => {
    given([prize("hackathon-prize-1", "h1"), X402], []);
    expect(await shownIds()).toEqual([X402.id]);
  });
});

/** User u1's badge rows as getCompletedCourseSlugs reads them. */
const certificateRow = (row: BadgeRow, status: BadgeAwardStatus, evidence: RequirementRow[] = []) => ({
  user_id: "u1",
  badge_id: row.id,
  status,
  evidence,
  badge: row,
});

describe("getAcademyProgress", () => {
  it("counts the courses with a certificate, of the 13", async () => {
    userBadgeFindMany.mockResolvedValue([
      certificateRow(AVALANCHE_FUNDAMENTALS, BadgeAwardStatus.approved),
      certificateRow(INTRO_TO_SOLIDITY, BadgeAwardStatus.approved),
      // the Blockchain Graduate started: one course done
      certificateRow(GRADUATE, BadgeAwardStatus.pending, GRADUATE.requirements.slice(0, 1)),
      // a hackathon prize names no course
      certificateRow(prize("hackathon-prize-1", "h1"), BadgeAwardStatus.approved),
    ]);
    expect(await getAcademyProgress("u1")).toEqual({ completed: 3, total: 13 });
  });

  it("counts Access Restriction only when both halves are done", async () => {
    userBadgeFindMany.mockResolvedValue([
      certificateRow(ACCESS_RESTRICTION, BadgeAwardStatus.pending, ACCESS_RESTRICTION.requirements.slice(0, 1)),
    ]);
    expect(await getAcademyProgress("u1")).toEqual({ completed: 0, total: 13 });

    userBadgeFindMany.mockResolvedValue([certificateRow(ACCESS_RESTRICTION, BadgeAwardStatus.approved)]);
    expect(await getAcademyProgress("u1")).toEqual({ completed: 1, total: 13 });
  });

  it("counts no course of a removed course badge", async () => {
    userBadgeFindMany.mockResolvedValue([certificateRow(NFT_DEPLOYMENT, BadgeAwardStatus.approved)]);
    expect(await getAcademyProgress("u1")).toEqual({ completed: 0, total: 13 });
  });

  it("is zero without a user, and reads nothing", async () => {
    expect(await getAcademyProgress("")).toEqual({ completed: 0, total: 13 });
    expect(userBadgeFindMany).not.toHaveBeenCalled();
  });
});

describe("getProfileEngagement: the 'Use the console' step", () => {
  it.each([
    ["a console log entry", consoleLogFindFirst],
    ["a faucet claim", faucetClaimFindFirst],
    ["a node registration", nodeRegistrationFindFirst],
  ])("counts %s as console use", async (_, findFirst) => {
    findFirst.mockResolvedValue({ id: "row" });
    expect((await getProfileEngagement("u1")).hasUsedConsole).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({ where: { user_id: "u1" }, select: { id: true } });
  });

  it("is not done for a user with no console activity, and reads no badge", async () => {
    expect((await getProfileEngagement("u1")).hasUsedConsole).toBe(false);
    expect(badgeFindMany).not.toHaveBeenCalled();
    expect(userBadgeFindMany).not.toHaveBeenCalled();
  });
});
