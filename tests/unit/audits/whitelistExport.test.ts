import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, adminAuditorsMock, historyMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  adminAuditorsMock: vi.fn(),
  historyMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/server/services/audits/visibility", () => ({ getAdminAuditors: adminAuditorsMock }));
vi.mock("@/server/services/audits/auditors", () => ({ getAuditorStatusHistory: historyMock }));

import { GET } from "@/app/api/audits/admin/auditors/export/route";

const ADMIN = {
  id: "user-admin",
  email: "admin@program.example",
  name: "Joey",
  custom_attributes: ["audit_admin"],
};

const person = (email: string, github_username: string | null) => ({
  id: `mem-${email}`,
  email,
  invited_at: new Date("2026-09-06"),
  first_login_at: null,
  github_username,
});

const firm = (
  firm_name: string,
  quote_email: string,
  github_username: string | null,
  members: ReturnType<typeof person>[],
) => ({
  id: `aud-${firm_name}`,
  firm_name,
  quote_email,
  github_username,
  services: ["OpSec"],
  active: true,
  invited_at: new Date("2026-09-04"),
  first_login_at: new Date("2026-09-05"),
  deactivated_at: null,
  attio_ref: null,
  website: null,
  logo_url: null,
  sent: 0,
  quoted: 0,
  won: 0,
  last_quote_at: null,
  members,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: ADMIN });
  historyMock.mockResolvedValue(new Map());
  adminAuditorsMock.mockResolvedValue([
    firm("Nordlicht", "quotes@nordlicht.example", "nordlicht-sec", [
      person("alice@nordlicht.example", "alice-audits"),
      person("bob@nordlicht.example", null),
    ]),
    firm("Harborline", "quotes@harborline.example", null, [
      person("carol@harborline.example", null),
    ]),
    firm("Ashgrove", "quotes@ashgrove.example", null, [person("dan@ashgrove.example", "dan-gh")]),
  ]);
});

const csvLines = async () => (await (await GET()).text()).trim().split("\n");

describe("GET /api/audits/admin/auditors/export · github_usernames (D2.6)", () => {
  it("adds the column right after the team emails", async () => {
    const [header] = await csvLines();

    expect(header.startsWith("firm,quote_email,team_emails,github_usernames,services,")).toBe(true);
  });

  it("lists email: username pairs, the quote email first, people without one left out", async () => {
    const [, nordlicht] = await csvLines();

    expect(nordlicht).toContain(
      ",alice@nordlicht.example; bob@nordlicht.example," +
        "quotes@nordlicht.example: nordlicht-sec; alice@nordlicht.example: alice-audits,OpSec,",
    );
  });

  it("leaves the cell empty when nobody has a username", async () => {
    const [, , harborline] = await csvLines();

    expect(harborline).toContain(",carol@harborline.example,,OpSec,");
  });

  it("lists only the teammate when only a teammate has one", async () => {
    const [, , , ashgrove] = await csvLines();

    expect(ashgrove).toContain(",dan@ashgrove.example,dan@ashgrove.example: dan-gh,OpSec,");
  });
});
