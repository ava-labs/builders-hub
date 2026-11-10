import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, rateLimitMock, startAgainMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  rateLimitMock: vi.fn(),
  startAgainMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: rateLimitMock }));
vi.mock("@/server/services/audits/requests", () => ({ startAgain: startAgainMock }));

import { POST } from "@/app/api/audits/requests/[id]/start-again/route";

const OWNER = { id: "user-owner", email: "owner@project.example" };

const startAgain = () =>
  POST(
    new Request("http://localhost/api/audits/requests/req-1/start-again", {
      method: "POST",
    }) as never,
    { params: Promise.resolve({ id: "req-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: OWNER });
  rateLimitMock.mockReturnValue({ allowed: true });
  startAgainMock.mockResolvedValue({ success: true, id: "req-new" });
});

describe("POST /api/audits/requests/[id]/start-again", () => {
  it("copies the signed-in owner's request and answers 201 with the new draft id", async () => {
    const res = await startAgain();

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, id: "req-new" });
    expect(startAgainMock).toHaveBeenCalledWith("user-owner", "req-1");
  });

  it("spends the draft-creation bucket, 20 a day per address, since each call makes a draft", async () => {
    await startAgain();

    expect(rateLimitMock).toHaveBeenCalledWith("audit:draft-create:owner@project.example", {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 20,
    });
  });

  it("turns a signed-out caller away before any copy", async () => {
    sessionMock.mockResolvedValue(null);

    const res = await startAgain();

    expect(res.status).toBe(401);
    expect(startAgainMock).not.toHaveBeenCalled();
  });

  it("answers 429 once the bucket is spent, before any copy", async () => {
    rateLimitMock.mockReturnValue({ allowed: false, resetAt: Date.now() + 60 * 60 * 1000 });

    const res = await startAgain();

    expect(res.status).toBe(429);
    expect(startAgainMock).not.toHaveBeenCalled();
  });

  it("answers 409 for a request that has not lapsed", async () => {
    startAgainMock.mockResolvedValue({ success: false, code: "not_restartable" });

    const res = await startAgain();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      message: "Only an expired request with quotes can be started again.",
    });
  });

  it("answers 404 for a request the caller does not own", async () => {
    startAgainMock.mockResolvedValue({ success: false, code: "not_found" });

    const res = await startAgain();

    expect(res.status).toBe(404);
  });
});
