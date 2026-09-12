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

  it("denies users without an event-editing role, without a lookup", async () => {
    const allowed = await canEditEvent(
      { user: { id: "u2", email: "someone@example.com", custom_attributes: ["showcase"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("denies team1_event_admin — read-only on events, may not edit", async () => {
    const allowed = await canEditEvent(
      { user: { id: "u2b", custom_attributes: ["team1_event_admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows hackathon_creator for events they created", async () => {
    // The role can create events (POST /api/events grants event:write), so it
    // must also be able to save edits to them — otherwise the editor opens and
    // 403s on save.
    findUniqueMock.mockResolvedValue({ cohosts: [], created_by: "u2c" });
    const allowed = await canEditEvent(
      { user: { id: "u2c", custom_attributes: ["hackathon_creator"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
  });

  it("denies hackathon_creator for an event they neither created nor cohost", async () => {
    findUniqueMock.mockResolvedValue({ cohosts: ["other@example.com"], created_by: "someone-else" });
    const allowed = await canEditEvent(
      { user: { id: "u2d", email: "me@example.com", custom_attributes: ["hackathon_creator"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
  });

  it("allows team1_admin for events they created", async () => {
    findUniqueMock.mockResolvedValue({ cohosts: [], created_by: "u3" });
    const allowed = await canEditEvent(
      { user: { id: "u3", custom_attributes: ["team1_admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
  });

  it("allows team1_admin only where they are a cohost", async () => {
    findUniqueMock.mockResolvedValue({
      cohosts: ["admin@example.com"],
      created_by: "someone-else",
    });
    const session = (email: string) => ({
      user: { id: "u4", email, custom_attributes: ["team1_admin"] },
    });
    expect(await canEditEvent(session("admin@example.com"), EVENT_ID)).toBe(true);
    expect(await canEditEvent(session("stranger@example.com"), EVENT_ID)).toBe(false);
  });

  it("denies when the event does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    const allowed = await canEditEvent(
      { user: { id: "u5", custom_attributes: ["team1_admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
  });
});

describe("canManageHackathonJudges", () => {
  it("denies anonymous users and roles without judge:assign, without a lookup", async () => {
    expect(await canManageHackathonJudges(null, EVENT_ID)).toBe(false);
    // team1_event_admin is read-only on events; hackathon_creator now holds
    // judge:assign (scope own) so it reaches the ownership lookup instead.
    expect(
      await canManageHackathonJudges(
        { user: { id: "u1", custom_attributes: ["team1_event_admin"] } },
        EVENT_ID,
      ),
    ).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows hackathon_creator to add judges to their own event", async () => {
    findUniqueMock.mockResolvedValue({ created_by: "u9", cohosts: [] });
    expect(
      await canManageHackathonJudges(
        { user: { id: "u9", custom_attributes: ["hackathon_creator"] } },
        EVENT_ID,
      ),
    ).toBe(true);
    expect(
      await canManageHackathonJudges(
        { user: { id: "stranger", custom_attributes: ["hackathon_creator"] } },
        EVENT_ID,
      ),
    ).toBe(false);
  });

  it("allows devrel for any event without a lookup", async () => {
    const allowed = await canManageHackathonJudges(
      { user: { id: "u1", custom_attributes: ["devrel"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows team1_admin only for events they created or cohost", async () => {
    findUniqueMock.mockResolvedValue({
      cohosts: ["admin@example.com"],
      created_by: "creator-id",
    });
    const session = (id: string, email: string) => ({
      user: { id, email, custom_attributes: ["team1_admin"] },
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
