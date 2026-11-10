import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { sessionMock, resolveMock, setMock, rateLimitMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  resolveMock: vi.fn(),
  setMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: rateLimitMock }));
vi.mock("@/server/services/audits/auditors", () => ({
  resolveAuditorByEmail: resolveMock,
  setOwnGithubUsername: setMock,
}));

import { PATCH } from "@/app/api/audits/portal/me/github/route";

const QUOTE_EMAIL = "quotes@nordlicht.example";
const TEAMMATE = "alice@nordlicht.example";
const FIRM = {
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: QUOTE_EMAIL,
  active: true,
  github_username: null,
};

const patch = (body: unknown, contentType = "application/json") =>
  PATCH(
    new NextRequest("http://localhost/api/audits/portal/me/github", {
      method: "PATCH",
      headers: { "content-type": contentType },
      body: JSON.stringify(body),
    }),
    {} as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { email: TEAMMATE } });
  resolveMock.mockResolvedValue(FIRM);
  rateLimitMock.mockReturnValue({ allowed: true });
  setMock.mockImplementation(async (_firm: unknown, _email: string, value: string | null) => ({
    success: true,
    github_username: value,
  }));
});

describe("PATCH /api/audits/portal/me/github", () => {
  it("saves the quote-email person's own username from a pasted profile link", async () => {
    sessionMock.mockResolvedValue({ user: { email: QUOTE_EMAIL } });

    const res = await patch({ github_username: "https://github.com/nordlicht-sec/" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, github_username: "nordlicht-sec" });
    expect(setMock).toHaveBeenCalledWith(FIRM, QUOTE_EMAIL, "nordlicht-sec");
  });

  it("saves a teammate's own username under their signed-in address", async () => {
    sessionMock.mockResolvedValue({ user: { email: "Alice@Nordlicht.example" } });

    const res = await patch({ github_username: "alice-audits" });

    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith(FIRM, TEAMMATE, "alice-audits");
  });

  it("clears the username with null or an empty value", async () => {
    await patch({ github_username: null });
    await patch({ github_username: "" });

    expect(setMock.mock.calls.map((call) => call[2])).toEqual([null, null]);
  });

  it("refuses a body that names another person, before any write", async () => {
    for (const body of [{ github_username: "x", email: QUOTE_EMAIL }, { email: QUOTE_EMAIL }]) {
      const res = await patch(body);
      expect(res.status).toBe(400);
    }
    expect(setMock).not.toHaveBeenCalled();
  });

  it("explains a name GitHub would not accept", async () => {
    const res = await patch({ github_username: "-alice" });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("GitHub username");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("turns away a signed-out caller", async () => {
    sessionMock.mockResolvedValue(null);

    const res = await patch({ github_username: "alice-audits" });

    expect(res.status).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("refuses a deactivated firm's write", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, active: false });

    const res = await patch({ github_username: "alice-audits" });

    expect(res.status).toBe(403);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("takes JSON only", async () => {
    const res = await patch({ github_username: "alice-audits" }, "text/plain");

    expect(res.status).toBe(415);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("spends a github-update budget per signed-in address, 50 a day", async () => {
    await patch({ github_username: "alice-audits" });

    expect(rateLimitMock).toHaveBeenCalledWith(`audit:github-update:${TEAMMATE}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 50,
    });
  });

  it("answers 429 once the budget is spent, before any write", async () => {
    rateLimitMock.mockReturnValue({ allowed: false, resetAt: Date.now() + 60 * 60 * 1000 });

    const res = await patch({ github_username: "alice-audits" });

    expect(res.status).toBe(429);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("answers 404 when the address left the firm before the save", async () => {
    setMock.mockResolvedValue({ success: false, code: "not_found" });

    const res = await patch({ github_username: "alice-audits" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, message: "Email not found on this firm." });
  });

  it("answers 500 without details when the write fails", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    setMock.mockRejectedValue(new Error("connection reset"));

    const res = await patch({ github_username: "alice-audits" });

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("connection reset");
    quiet.mockRestore();
  });
});
