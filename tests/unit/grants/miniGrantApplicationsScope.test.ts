import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthSessionMock, userFindUniqueMock, appFindManyMock, formDataFindManyMock, groupByMock } =
  vi.hoisted(() => ({
    getAuthSessionMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
    appFindManyMock: vi.fn(),
    formDataFindManyMock: vi.fn(),
    groupByMock: vi.fn(),
  }));

vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/prisma/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    grantApplication: { findMany: appFindManyMock },
    formData: { findMany: formDataFindManyMock },
    evaluation: { groupBy: groupByMock },
  },
}));

import { GET } from "@/app/api/grants/team1-mini-grants/applications/route";
import { MINI_GRANT_KEY } from "@/lib/grants/programs";

// User A owns the project; teammate B submitted the application.
const USER_A = "user-a";
const EMAIL_A = "a@example.com";

beforeEach(() => {
  getAuthSessionMock.mockReset();
  userFindUniqueMock.mockReset();
  appFindManyMock.mockReset();
  formDataFindManyMock.mockReset();
  groupByMock.mockReset();

  getAuthSessionMock.mockResolvedValue({ user: { id: USER_A } });
  userFindUniqueMock.mockResolvedValue({ email: EMAIL_A });
  appFindManyMock.mockResolvedValue([]);
  formDataFindManyMock.mockResolvedValue([]);
  groupByMock.mockResolvedValue([]);
});

describe("GET /api/grants/team1-mini-grants/applications", () => {
  it("scopes by confirmed project membership, not by who submitted", async () => {
    await GET();

    expect(appFindManyMock.mock.calls[0][0].where).toEqual({
      program_key: MINI_GRANT_KEY,
      project: {
        members: {
          some: {
            OR: [{ user_id: USER_A }, { email: EMAIL_A }],
            status: "Confirmed",
          },
        },
      },
    });
  });

  it("returns a teammate's application so the project shows as already applied", async () => {
    appFindManyMock.mockResolvedValue([
      {
        id: "app-1",
        project_id: "p1",
        created_at: new Date(0),
        project: { project_name: "Acme Protocol" },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.applications).toHaveLength(1);
    expect(body.applications[0]).toMatchObject({ projectId: "p1", projectName: "Acme Protocol" });
  });

  it("returns nothing for a signed-out or half-registered user", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ applications: [] });

    getAuthSessionMock.mockResolvedValue({ user: { id: "pending_123" } });
    expect(await (await GET()).json()).toEqual({ applications: [] });

    expect(appFindManyMock).not.toHaveBeenCalled();
  });
});
