import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestFindUniqueMock, deliveryFindUniqueMock, findAuditorMock } = vi.hoisted(() => ({
  requestFindUniqueMock: vi.fn(),
  deliveryFindUniqueMock: vi.fn(),
  findAuditorMock: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    auditRequest: { findUnique: requestFindUniqueMock, findFirst: vi.fn(), findMany: vi.fn() },
    auditFanoutDelivery: { findUnique: deliveryFindUniqueMock, findMany: vi.fn() },
    auditor: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    auditQuote: { findUnique: vi.fn(), findMany: vi.fn() },
    auditSubsidyDecision: { findFirst: vi.fn() },
  },
}));
vi.mock("@/server/services/audits/auditors", () => ({ findAuditorByEmail: findAuditorMock }));

import { readableAttachment } from "@/server/services/audits/visibility";

const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";
const ATTACHMENT = { name: "scope.pdf", url: `https://${HOST}/audits/scope-abc.pdf`, size: 10 };
const OWNER = "user-owner";
const OWNER_EMAIL = "owner@project.example";
const FIRM_EMAIL = "quotes@nordlicht.example";
const STRANGER = { userId: "user-nobody", email: "nobody@example.com", isAdmin: false };

const row = (over: Record<string, unknown> = {}) => ({
  user_id: OWNER,
  status: "collecting",
  attachments: [ATTACHMENT],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  requestFindUniqueMock.mockResolvedValue(row());
  deliveryFindUniqueMock.mockResolvedValue(null);
  findAuditorMock.mockResolvedValue(null);
});

describe("readableAttachment · who may read a request's files", () => {
  it("lets the owner read their own, drafts included", async () => {
    requestFindUniqueMock.mockResolvedValue(row({ status: "draft" }));

    const found = await readableAttachment("req-1", 0, {
      userId: OWNER,
      email: OWNER_EMAIL,
      isAdmin: false,
    });

    expect(found).toEqual(ATTACHMENT);
  });

  it("lets a firm the request actually reached read it", async () => {
    findAuditorMock.mockResolvedValue({ auditor: { id: "aud-1" }, member: null });
    deliveryFindUniqueMock.mockResolvedValue({ request_id: "req-1" });

    const found = await readableAttachment("req-1", 0, {
      userId: "user-auditor",
      email: FIRM_EMAIL,
      isAdmin: false,
    });

    expect(found).toEqual(ATTACHMENT);
    expect(deliveryFindUniqueMock.mock.calls[0][0].where).toMatchObject({
      request_id_auditor_id: { request_id: "req-1", auditor_id: "aud-1" },
    });
  });

  it("refuses a whitelisted firm the request never reached", async () => {
    findAuditorMock.mockResolvedValue({ auditor: { id: "aud-2" }, member: null });
    deliveryFindUniqueMock.mockResolvedValue(null);

    const found = await readableAttachment("req-1", 0, {
      userId: "user-auditor",
      email: "quotes@other.example",
      isAdmin: false,
    });

    expect(found).toBeNull();
  });

  it("refuses a signed-in stranger", async () => {
    expect(await readableAttachment("req-1", 0, STRANGER)).toBeNull();
  });

  it("lets an audit admin read a submitted request but never a draft", async () => {
    const admin = { userId: "user-admin", email: "admin@avalabs.org", isAdmin: true };
    expect(await readableAttachment("req-1", 0, admin)).toEqual(ATTACHMENT);

    requestFindUniqueMock.mockResolvedValue(row({ status: "draft" }));
    expect(await readableAttachment("req-1", 0, admin)).toBeNull();
  });

  it("refuses an index that is not in the list", async () => {
    expect(
      await readableAttachment("req-1", 5, {
        userId: OWNER,
        email: OWNER_EMAIL,
        isAdmin: false,
      }),
    ).toBeNull();
  });

  it("refuses when the request does not exist, without looking a firm up", async () => {
    requestFindUniqueMock.mockResolvedValue(null);

    expect(await readableAttachment("req-1", 0, STRANGER)).toBeNull();
    expect(findAuditorMock).not.toHaveBeenCalled();
  });

  it("resolves the firm without stamping first_login_at (findAuditorByEmail, not resolve)", async () => {
    findAuditorMock.mockResolvedValue({ auditor: { id: "aud-1" }, member: null });
    deliveryFindUniqueMock.mockResolvedValue({ request_id: "req-1" });

    await readableAttachment("req-1", 0, {
      userId: "user-auditor",
      email: FIRM_EMAIL,
      isAdmin: false,
    });

    expect(findAuditorMock).toHaveBeenCalledWith(FIRM_EMAIL);
  });
});
