import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, submitMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  submitMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/server/services/audits/fanout", () => ({ submitRequestForReview: submitMock }));

import { POST } from "@/app/api/audits/requests/[id]/submit/route";

const OWNER = "user-owner";

const submit = (body: unknown) =>
  POST(
    new Request("http://localhost/api/audits/requests/req-1/submit", {
      method: "POST",
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "req-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: OWNER, email: "owner@project.example" } });
  submitMock.mockResolvedValue({ success: true });
});

describe("POST /api/audits/requests/[id]/submit · Telegram share", () => {
  it("hands the share choice to the submit transaction", async () => {
    const res = await submit({ contact_consent: true, share_contact_handle: true });

    expect(res.status).toBe(200);
    expect(submitMock).toHaveBeenCalledWith("req-1", OWNER, true);
  });

  it("does not share when the body carries the consent alone", async () => {
    const res = await submit({ contact_consent: true });

    expect(res.status).toBe(200);
    expect(submitMock).toHaveBeenCalledWith("req-1", OWNER, false);
  });
});
