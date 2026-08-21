import { describe, expect, it, vi, beforeEach } from "vitest";

const { userFindUniqueMock, projectFindManyMock } = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  projectFindManyMock: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    project: { findMany: projectFindManyMock },
  },
}));

import { GetProjectsByUserId } from "@/server/services/memberProject";

const USER_ID = "user-1";
const EMAIL = "invitee@example.com";

beforeEach(() => {
  userFindUniqueMock.mockReset();
  projectFindManyMock.mockReset();
  userFindUniqueMock.mockResolvedValue({ email: EMAIL });
  projectFindManyMock.mockResolvedValue([]);
});

describe("GetProjectsByUserId", () => {
  it("matches members by user_id or email, and skips removed ones", async () => {
    await GetProjectsByUserId(USER_ID);

    expect(projectFindManyMock.mock.calls[0][0].where).toEqual({
      members: {
        some: {
          OR: [{ user_id: USER_ID }, { email: EMAIL }],
          status: { not: "Removed" },
        },
      },
    });
  });

  it("omits the email clause for a user without one", async () => {
    userFindUniqueMock.mockResolvedValue({ email: null });
    await GetProjectsByUserId(USER_ID);

    expect(projectFindManyMock.mock.calls[0][0].where.members.some.OR).toEqual([
      { user_id: USER_ID },
    ]);
  });

  it("reports a pending invitation matched only by email", async () => {
    projectFindManyMock.mockResolvedValue([
      {
        id: "p1",
        members: [
          { user_id: "owner", email: "owner@example.com", status: "Confirmed" },
          { user_id: null, email: EMAIL, status: "Pending Confirmation" },
        ],
        badges: [],
      },
    ]);

    const [project] = await GetProjectsByUserId(USER_ID);
    expect(project.my_member_status).toBe("Pending Confirmation");
  });

  it("reports a confirmed membership matched by user_id", async () => {
    projectFindManyMock.mockResolvedValue([
      {
        id: "p1",
        members: [{ user_id: USER_ID, email: EMAIL, status: "Confirmed" }],
        badges: [],
      },
    ]);

    const [project] = await GetProjectsByUserId(USER_ID);
    expect(project.my_member_status).toBe("Confirmed");
  });
});
