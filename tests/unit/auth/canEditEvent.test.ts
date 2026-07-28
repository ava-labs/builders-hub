import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock("@/prisma/prisma", () => ({
  prisma: { hackathon: { findUnique: findUniqueMock } },
}));

import { canEditEvent, canManageHackathonJudges } from "@/lib/auth/permissions";

const EVENT_ID = "evt-1";

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("canEditEvent", () => {
  it("denies anonymous users without touching the database", async () => {
    expect(await canEditEvent(null, EVENT_ID)).toBe(false);
    expect(await canEditEvent(undefined, EVENT_ID)).toBe(false);
    expect(await canEditEvent({}, EVENT_ID)).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows devrel for any event without a lookup", async () => {
    const allowed = await canEditEvent(
      { user: { id: "u1", custom_attributes: ["devrel"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("denies users without a privileged role, without a lookup", async () => {
    const allowed = await canEditEvent(
      { user: { id: "u2", email: "cohost@example.com", custom_attributes: ["hackathonCreator"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows team1-admin for events they created", async () => {
    findUniqueMock.mockResolvedValue({ cohosts: [], created_by: "u3" });
    const allowed = await canEditEvent(
      { user: { id: "u3", custom_attributes: ["team1-admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
  });

  it("allows team1-admin only where they are a cohost", async () => {
    findUniqueMock.mockResolvedValue({
      cohosts: ["admin@example.com"],
      created_by: "someone-else",
    });
    const session = (email: string) => ({
      user: { id: "u4", email, custom_attributes: ["team1-admin"] },
    });
    expect(await canEditEvent(session("admin@example.com"), EVENT_ID)).toBe(true);
    expect(await canEditEvent(session("stranger@example.com"), EVENT_ID)).toBe(false);
  });

  it("denies when the event does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    const allowed = await canEditEvent(
      { user: { id: "u5", custom_attributes: ["team1-admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
  });
});

describe("canManageHackathonJudges", () => {
  it("denies anonymous users and non-privileged roles without a lookup", async () => {
    expect(await canManageHackathonJudges(null, EVENT_ID)).toBe(false);
    expect(
      await canManageHackathonJudges(
        { user: { id: "u1", custom_attributes: ["hackathonCreator"] } },
        EVENT_ID,
      ),
    ).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows devrel for any event without a lookup", async () => {
    const allowed = await canManageHackathonJudges(
      { user: { id: "u1", custom_attributes: ["devrel"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows team1-admin only for events they created or cohost", async () => {
    findUniqueMock.mockResolvedValue({
      cohosts: ["admin@example.com"],
      created_by: "creator-id",
    });
    const session = (id: string, email: string) => ({
      user: { id, email, custom_attributes: ["team1-admin"] },
    });
    expect(
      await canManageHackathonJudges(session("creator-id", "x@example.com"), EVENT_ID),
    ).toBe(true);
    expect(
      await canManageHackathonJudges(session("u9", "admin@example.com"), EVENT_ID),
    ).toBe(true);
    expect(
      await canManageHackathonJudges(session("u9", "stranger@example.com"), EVENT_ID),
    ).toBe(false);
  });
});
