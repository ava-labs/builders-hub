import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// The session and the stats module are mocked; every key the page reads from the stats is recorded.
const mocks = vi.hoisted(() => ({
  session: null as unknown,
  readStats: vi.fn((track: string) => ({ [`/academy/${track}/course`]: { modules: 0, lessons: 1 } })),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: async () => mocks.session }));
vi.mock("@/lib/academy/course-stats.generated", () => ({
  COURSE_STATS: new Proxy({}, { get: (_stats, key) => (typeof key === "string" ? mocks.readStats(key) : undefined) }),
}));

import Team1AcademyPage from "@/app/(home)/academy/team1/page";
import { AccessDenied } from "@/components/ui/access-denied";
import { AuthLoading } from "@/components/ui/auth-loading";

const visit = async (session: unknown) => {
  mocks.session = session;
  return (await Team1AcademyPage()) as ReactElement<{ message?: string }>;
};
const signedIn = (customAttributes: string[]) => ({ user: { id: "user", custom_attributes: customAttributes } });

describe("the Team1 landing checks access before it reads any course stats", () => {
  beforeEach(() => mocks.readStats.mockClear());

  it("gives a visitor without a session the sign-in state and reads no stats", async () => {
    expect((await visit(null)).type).toBe(AuthLoading);
    expect(mocks.readStats).not.toHaveBeenCalled();
  });

  it.each([[[]], [["hackathon-judge"]]])("gives a user with %j and no Team1 access the denial and reads no stats", async (attributes) => {
    const page = await visit(signedIn(attributes));
    expect(page.type).toBe(AccessDenied);
    expect(page.props.message).toBe("The Team1 Academy is only accessible to Team1 members.");
    expect(mocks.readStats).not.toHaveBeenCalled();
  });

  it("reads only the Team1 stats for a user with Team1 access", async () => {
    await visit(signedIn(["team1-member"]));
    expect(mocks.readStats.mock.calls).toEqual([["team1"]]);
  });
});
