import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock("@/prisma/prisma", () => ({
  prisma: { hackathon: { findUnique: findUniqueMock } },
}));

import { canViewEventRegistrations } from "@/lib/auth/permissions";

const EVENT_ID = "evt-1";

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("canViewEventRegistrations", () => {
  it("denies anonymous users without touching the database", async () => {
    expect(await canViewEventRegistrations(null, EVENT_ID)).toBe(false);
    expect(await canViewEventRegistrations(undefined, EVENT_ID)).toBe(false);
    expect(await canViewEventRegistrations({}, EVENT_ID)).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows devrel for any event without a lookup", async () => {
    const allowed = await canViewEventRegistrations(
      { user: { id: "u1", custom_attributes: ["devrel"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("denies a plain cohost without a privileged role, without a lookup", async () => {
    const allowed = await canViewEventRegistrations(
      { user: { id: "u2", email: "cohost@example.com", custom_attributes: [] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("allows team1-admin for a Team1 event", async () => {
    findUniqueMock.mockResolvedValue({
      organizers: "team1-india",
      cohosts: [],
      created_by: "someone-else",
    });
    const allowed = await canViewEventRegistrations(
      { user: { id: "u3", custom_attributes: ["team1-admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
  });

  it("denies team1-admin for a non-Team1 event, even as cohost", async () => {
    findUniqueMock.mockResolvedValue({
      organizers: "acme",
      cohosts: ["admin@example.com"],
      created_by: "someone-else",
    });
    const allowed = await canViewEventRegistrations(
      {
        user: {
          id: "u4",
          email: "admin@example.com",
          custom_attributes: ["team1-admin"],
        },
      },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
  });

  it("allows team1-event-admin only where they are a cohost", async () => {
    findUniqueMock.mockResolvedValue({
      organizers: "team1-latam",
      cohosts: ["organizer@example.com"],
      created_by: "someone-else",
    });
    const session = (email: string) => ({
      user: { id: "u5", email, custom_attributes: ["team1-event-admin"] },
    });
    expect(
      await canViewEventRegistrations(session("organizer@example.com"), EVENT_ID),
    ).toBe(true);
    expect(
      await canViewEventRegistrations(session("stranger@example.com"), EVENT_ID),
    ).toBe(false);
  });

  it("allows team1-event-admin for events they created, even without a cohost entry", async () => {
    findUniqueMock.mockResolvedValue({
      organizers: "team1-latam",
      cohosts: [],
      created_by: "u5",
    });
    const allowed = await canViewEventRegistrations(
      {
        user: {
          id: "u5",
          email: "creator@example.com",
          custom_attributes: ["team1-event-admin"],
        },
      },
      EVENT_ID,
    );
    expect(allowed).toBe(true);
  });

  it("denies when the event does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    const allowed = await canViewEventRegistrations(
      { user: { id: "u6", custom_attributes: ["team1-admin"] } },
      EVENT_ID,
    );
    expect(allowed).toBe(false);
  });
});
