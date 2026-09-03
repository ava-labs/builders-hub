import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const {
  auditorFindUniqueMock,
  memberCreateMock,
  memberFindFirstMock,
  memberDeleteMock,
  eventCreateMock,
  inviteMock,
  transactionMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  memberCreateMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  memberDeleteMock: vi.fn(),
  eventCreateMock: vi.fn(),
  inviteMock: vi.fn(),
  transactionMock: vi.fn(),
}));

// The clash check and the insert share one transaction client.
const tx = {
  auditor: { findUnique: auditorFindUniqueMock },
  auditorMember: { create: memberCreateMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    auditor: { findUnique: auditorFindUniqueMock },
    auditorMember: {
      create: memberCreateMock,
      findFirst: memberFindFirstMock,
      delete: memberDeleteMock,
    },
    auditEventLog: { create: eventCreateMock },
  },
}));
vi.mock("@/server/services/audits/emails/sendAuditorInvite", () => ({
  sendAuditorInvite: inviteMock,
}));

import { auditorMemberCreateSchema } from "@/types/audits";
import { addAuditorMember, removeAuditorMember } from "@/server/services/audits/members";

const ADMIN = { id: "admin-1", name: "Federico" };
const FIRM = {
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: "quotes@nordlicht.example",
  _count: { members: 1 },
};
const NEW_MEMBER = {
  id: "mem-2",
  auditor_id: "aud-1",
  email: "bob@nordlicht.example",
  first_login_at: null,
};
type FindUniqueArgs = { where: { id?: string; quote_email?: string } };

describe("auditorMemberCreateSchema", () => {
  it("trims and lowercases the email", () => {
    const parsed = auditorMemberCreateSchema.safeParse({ email: "  Alice@Nordlicht.Example " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("alice@nordlicht.example");
  });

  it("rejects unknown keys and bad addresses", () => {
    expect(
      auditorMemberCreateSchema.safeParse({ email: "alice@nordlicht.example", role: "x" }).success,
    ).toBe(false);
    expect(auditorMemberCreateSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects addresses longer than the 254-character mailbox limit", () => {
    const tooLong = `${"a".repeat(250)}@nordlicht.example`;
    expect(auditorMemberCreateSchema.safeParse({ email: tooLong }).success).toBe(false);
  });
});

describe("addAuditorMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Two findUnique roles: by id (the firm) and by quote_email (the clash check).
    auditorFindUniqueMock.mockImplementation(async (args: FindUniqueArgs) =>
      args.where.id ? FIRM : null,
    );
    memberCreateMock.mockResolvedValue(NEW_MEMBER);
    eventCreateMock.mockResolvedValue({});
    inviteMock.mockResolvedValue(undefined);
    transactionMock.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    );
  });

  it("runs the limit, the clash check and the insert in one serializable transaction", async () => {
    await addAuditorMember("aud-1", { email: "bob@nordlicht.example" }, ADMIN);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(memberCreateMock).toHaveBeenCalledTimes(1);
  });

  it("treats a serialization conflict as a duplicate instead of crashing", async () => {
    transactionMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );

    const result = await addAuditorMember("aud-1", { email: "bob@nordlicht.example" }, ADMIN);

    expect(result).toEqual({ success: false, code: "duplicate_email" });
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("creates the teammate, invites that exact address and logs the admin action", async () => {
    const result = await addAuditorMember("aud-1", { email: "bob@nordlicht.example" }, ADMIN);

    expect(result).toMatchObject({
      success: true,
      inviteSent: true,
      member: { email: "bob@nordlicht.example" },
    });
    expect(memberCreateMock.mock.calls[0][0].data).toEqual({
      auditor_id: "aud-1",
      email: "bob@nordlicht.example",
      added_by: "admin-1",
    });
    expect(inviteMock).toHaveBeenCalledWith({
      firm_name: "Nordlicht Security",
      email: "bob@nordlicht.example",
    });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      actor_type: "admin",
      actor_id: "admin-1",
      action: "auditor_member_added",
      meta: { firm_name: "Nordlicht Security", email: "bob@nordlicht.example", invite_sent: true },
    });
  });

  it("keeps the teammate when the invite email fails and says so", async () => {
    inviteMock.mockRejectedValue(new Error("sendgrid down"));

    const result = await addAuditorMember("aud-1", { email: "bob@nordlicht.example" }, ADMIN);

    expect(result).toMatchObject({ success: true, inviteSent: false });
  });

  it("refuses an address that is some firm's quote email", async () => {
    auditorFindUniqueMock.mockImplementation(async (args: FindUniqueArgs) =>
      args.where.id ? FIRM : { id: "aud-9" },
    );

    const result = await addAuditorMember("aud-1", { email: "quotes@other.example" }, ADMIN);

    expect(result).toEqual({ success: false, code: "duplicate_email" });
    expect(memberCreateMock).not.toHaveBeenCalled();
  });

  it("maps the unique-index violation to duplicate_email", async () => {
    memberCreateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
    );

    const result = await addAuditorMember("aud-1", { email: "bob@nordlicht.example" }, ADMIN);

    expect(result).toEqual({ success: false, code: "duplicate_email" });
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("stops at the per-firm limit", async () => {
    auditorFindUniqueMock.mockImplementation(async (args: FindUniqueArgs) =>
      args.where.id ? { ...FIRM, _count: { members: 10 } } : null,
    );

    const result = await addAuditorMember("aud-1", { email: "bob@nordlicht.example" }, ADMIN);

    expect(result).toEqual({ success: false, code: "limit_reached" });
    expect(memberCreateMock).not.toHaveBeenCalled();
  });

  it("reports not_found for an unknown firm", async () => {
    auditorFindUniqueMock.mockResolvedValue(null);

    expect(await addAuditorMember("nope", { email: "bob@nordlicht.example" }, ADMIN)).toEqual({
      success: false,
      code: "not_found",
    });
  });
});

describe("removeAuditorMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memberDeleteMock.mockResolvedValue({});
    eventCreateMock.mockResolvedValue({});
  });

  it("deletes only a teammate of THAT firm and logs the removed address", async () => {
    memberFindFirstMock.mockResolvedValue({
      ...NEW_MEMBER,
      auditor: { firm_name: "Nordlicht Security" },
    });

    const result = await removeAuditorMember("aud-1", "mem-2", ADMIN);

    expect(result).toEqual({ success: true });
    expect(memberFindFirstMock.mock.calls[0][0].where).toEqual({
      id: "mem-2",
      auditor_id: "aud-1",
    });
    expect(memberDeleteMock.mock.calls[0][0]).toEqual({ where: { id: "mem-2" } });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      action: "auditor_member_removed",
      meta: { firm_name: "Nordlicht Security", email: "bob@nordlicht.example" },
    });
  });

  it("reports not_found instead of deleting across firms", async () => {
    memberFindFirstMock.mockResolvedValue(null);

    expect(await removeAuditorMember("aud-1", "mem-2", ADMIN)).toEqual({
      success: false,
      code: "not_found",
    });
    expect(memberDeleteMock).not.toHaveBeenCalled();
  });
});
