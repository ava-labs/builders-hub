import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock("@/prisma/prisma", () => ({
  prisma: { hackathonJudge: { findUnique: findUniqueMock } },
}));

import { canReviewMiniGrants } from "@/lib/auth/permissions";
import { MINI_GRANT_HACKATHON_ID } from "@/lib/grants/programs";

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("canReviewMiniGrants", () => {
  it("denies anonymous users without touching the database", async () => {
    expect(await canReviewMiniGrants(null)).toBe(false);
    expect(await canReviewMiniGrants(undefined)).toBe(false);
    expect(await canReviewMiniGrants({})).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows devrel without a judge assignment lookup", async () => {
    const allowed = await canReviewMiniGrants({
      user: { id: "u1", custom_attributes: ["devrel"] },
    });
    expect(allowed).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("denies the global judge attribute (mini-grant review is scoped)", async () => {
    findUniqueMock.mockResolvedValue(null);
    const allowed = await canReviewMiniGrants({
      user: { id: "u2", custom_attributes: ["judge"] },
    });
    expect(allowed).toBe(false);
  });

  it("allows a judge assigned to the mini-grant hackathon", async () => {
    findUniqueMock.mockResolvedValue({ id: "j1" });
    const allowed = await canReviewMiniGrants({
      user: { id: "u3", custom_attributes: ["judge"] },
    });
    expect(allowed).toBe(true);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        hackathon_id_user_id: {
          hackathon_id: MINI_GRANT_HACKATHON_ID,
          user_id: "u3",
        },
      },
      select: { id: true },
    });
  });

  it("denies a user with no attributes and no assignment", async () => {
    findUniqueMock.mockResolvedValue(null);
    const allowed = await canReviewMiniGrants({ user: { id: "u4" } });
    expect(allowed).toBe(false);
  });
});
