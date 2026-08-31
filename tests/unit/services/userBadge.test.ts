import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadgeAwardStatus } from "@/types/badge";

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));

vi.mock("@/prisma/prisma", () => ({
  prisma: { userBadge: { findMany: findManyMock } },
}));

import { getCompletedCourseSlugs } from "@/server/services/userBadge";

const req = (courseId: string) => ({
  id: courseId,
  type: "course",
  course_id: courseId,
  unlocked: false,
});

type Row = {
  status: BadgeAwardStatus;
  evidence: unknown;
  badge: { category: string; requirements: unknown };
};

// Emulate prisma's where.status filtering so the test verifies which
// statuses the implementation actually queries for.
function givenUserBadges(rows: Row[]) {
  findManyMock.mockImplementation(async ({ where }: { where: { status?: number | { in: number[] } } }) => {
    return rows.filter((r) => {
      const s = where.status;
      if (s === undefined) return true;
      if (typeof s === "object") return s.in.includes(r.status);
      return r.status === s;
    });
  });
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("getCompletedCourseSlugs", () => {
  it("returns all requirement course ids of an approved badge", async () => {
    givenUserBadges([
      {
        status: BadgeAwardStatus.approved,
        evidence: [req("access-restriction-fundamentals"), req("access-restriction-advanced")],
        badge: {
          category: "academy",
          requirements: [req("access-restriction-fundamentals"), req("access-restriction-advanced")],
        },
      },
    ]);
    const slugs = await getCompletedCourseSlugs("u1");
    expect(slugs).toContain("access-restriction-fundamentals");
    expect(slugs).toContain("access-restriction-advanced");
  });

  it("returns only the evidence course ids of a pending multi-requirement badge", async () => {
    givenUserBadges([
      {
        status: BadgeAwardStatus.pending,
        evidence: [req("access-restriction-fundamentals")],
        badge: {
          category: "academy",
          requirements: [req("access-restriction-fundamentals"), req("access-restriction-advanced")],
        },
      },
    ]);
    const slugs = await getCompletedCourseSlugs("u1");
    expect(slugs).toEqual(["access-restriction-fundamentals"]);
  });

  it("counts an approved badge even if its evidence holds legacy requirement ids", async () => {
    // Users who finished the course before it was split have evidence
    // [{course_id: "access-restriction"}] but the badge is approved.
    givenUserBadges([
      {
        status: BadgeAwardStatus.approved,
        evidence: [req("access-restriction")],
        badge: {
          category: "academy",
          requirements: [req("access-restriction-fundamentals"), req("access-restriction-advanced")],
        },
      },
    ]);
    const slugs = await getCompletedCourseSlugs("u1");
    expect(slugs).toContain("access-restriction-fundamentals");
    expect(slugs).toContain("access-restriction-advanced");
  });

  it("ignores non-academy badges and pending badges without evidence", async () => {
    givenUserBadges([
      {
        status: BadgeAwardStatus.approved,
        evidence: [req("some-console-thing")],
        badge: { category: "console", requirements: [req("some-console-thing")] },
      },
      {
        status: BadgeAwardStatus.pending,
        evidence: null,
        badge: { category: "academy", requirements: [req("avalanche-fundamentals")] },
      },
    ]);
    const slugs = await getCompletedCourseSlugs("u1");
    expect(slugs).toEqual([]);
  });

  it("deduplicates course ids that appear in several badges", async () => {
    // e.g. course badge + academy graduate badge share requirements
    givenUserBadges([
      {
        status: BadgeAwardStatus.approved,
        evidence: [req("avalanche-fundamentals")],
        badge: { category: "academy", requirements: [req("avalanche-fundamentals")] },
      },
      {
        status: BadgeAwardStatus.pending,
        evidence: [req("avalanche-fundamentals")],
        badge: {
          category: "academy",
          requirements: [req("avalanche-fundamentals"), req("permissioned-l1s")],
        },
      },
    ]);
    const slugs = await getCompletedCourseSlugs("u1");
    expect(slugs).toEqual(["avalanche-fundamentals"]);
  });
});
