import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, requestFindFirstMock, handleUploadMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  requestFindFirstMock: vi.fn(),
  handleUploadMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/prisma/prisma", () => ({
  prisma: { auditRequest: { findFirst: requestFindFirstMock } },
}));
// Stand in for the SDK: run the route's own gate and hand back what it
// returned, so the assertions are about our rules and not Vercel's.
vi.mock("@vercel/blob/client", () => ({ handleUpload: handleUploadMock }));

import { POST } from "@/app/api/audits/attachments/upload/route";

const OWNER = "user-owner";
const REQUEST_ID = "req-1";

const PAYLOAD = JSON.stringify({ requestId: REQUEST_ID });

// No default on clientPayload: a test needs to send genuinely nothing, and a
// default would swallow an explicit undefined.
const post = (clientPayload: string | undefined, pathname = `audits/${REQUEST_ID}/scope.pdf`) => {
  handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) =>
    onBeforeGenerateToken(pathname, clientPayload),
  );
  return POST(
    new Request("http://localhost/api/audits/attachments/upload", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = "test";
  sessionMock.mockResolvedValue({ user: { id: OWNER, email: "owner@project.example" } });
  requestFindFirstMock.mockResolvedValue({ id: REQUEST_ID });
});

describe("POST /api/audits/attachments/upload", () => {
  it("mints a token only against a draft the caller owns", async () => {
    const res = await post(PAYLOAD);

    expect(res.status).toBe(200);
    expect(requestFindFirstMock.mock.calls[0][0].where).toMatchObject({
      id: REQUEST_ID,
      user_id: OWNER,
      status: "draft",
    });
  });

  it("refuses when the draft is someone else's, or no longer a draft", async () => {
    requestFindFirstMock.mockResolvedValue(null);

    const res = await post(PAYLOAD);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("refuses a payload that names no draft at all", async () => {
    expect((await post(JSON.stringify({}))).status).toBe(400);
    // No clientPayload at all, and a malformed one.
    expect((await post(undefined)).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect(requestFindFirstMock).not.toHaveBeenCalled();
  });

  it("pins the key to the verified draft, not to the payload's copy", async () => {
    // Someone else's request id, a firm logo folder, an unprefixed key, and
    // an extra path segment are all refused.
    expect((await post(PAYLOAD, "audits/some-other-request/f.pdf")).status).toBe(400);
    expect((await post(PAYLOAD, "audits/firms/aud-1/logo.png")).status).toBe(400);
    expect((await post(PAYLOAD, "audits/scope.pdf")).status).toBe(400);
    expect((await post(PAYLOAD, `audits/${REQUEST_ID}/sub/f.pdf`)).status).toBe(400);
    expect((await post(PAYLOAD, "other/x.pdf")).status).toBe(400);
  });

  it("allows no scriptable type: svg is not on the list", async () => {
    const res = await post(PAYLOAD);
    const token = await res.json();

    expect(token.allowedContentTypes).not.toContain("image/svg+xml");
    expect(token.allowedContentTypes).not.toContain("image/*");
    expect(token.allowedContentTypes).toContain("application/pdf");
    expect(token.allowedContentTypes).toContain("image/png");
  });

  it("401s an anonymous caller", async () => {
    sessionMock.mockResolvedValue(null);

    expect((await post(PAYLOAD)).status).toBe(401);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });
});
