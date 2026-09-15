import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const {
  auditorFindUniqueMock,
  auditorUpdateMock,
  auditorUpdateManyMock,
  auditorCreateMock,
  memberFindUniqueMock,
  memberUpdateMock,
  memberUpdateManyMock,
  eventCreateMock,
  inviteMock,
  transactionMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  auditorUpdateManyMock: vi.fn(),
  auditorCreateMock: vi.fn(),
  memberFindUniqueMock: vi.fn(),
  memberUpdateMock: vi.fn(),
  memberUpdateManyMock: vi.fn(),
  eventCreateMock: vi.fn(),
  inviteMock: vi.fn(),
  transactionMock: vi.fn(),
}));

// createAuditor's teammate clash check and insert share one transaction client.
const tx = {
  auditor: { create: auditorCreateMock },
  auditorMember: { findUnique: memberFindUniqueMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    auditor: {
      findUnique: auditorFindUniqueMock,
      update: auditorUpdateMock,
      updateMany: auditorUpdateManyMock,
      create: auditorCreateMock,
    },
    auditorMember: {
      findUnique: memberFindUniqueMock,
      update: memberUpdateMock,
      updateMany: memberUpdateManyMock,
    },
    auditEventLog: { create: eventCreateMock },
  },
}));
vi.mock("@/server/services/audits/emails/sendAuditorInvite", () => ({
  sendAuditorInvite: inviteMock,
}));

import {
  createAuditor,
  findAuditorByEmail,
  resolveAuditorByEmail,
  updateAuditor,
} from "@/server/services/audits/auditors";

const FIRM = {
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: "quotes@nordlicht.example",
  active: true,
  first_login_at: new Date("2026-08-01"),
};
const ADMIN_ACTOR = { type: "admin" as const, id: "admin-1", name: "Federico" };
const AUDITOR_ACTOR = { type: "auditor" as const, id: "aud-1", email: "alice@nordlicht.example" };
const MEMBER = {
  id: "mem-1",
  auditor_id: "aud-1",
  email: "alice@nordlicht.example",
  first_login_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  auditorFindUniqueMock.mockResolvedValue(null);
  memberFindUniqueMock.mockResolvedValue(null);
  auditorUpdateMock.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    ...FIRM,
    ...args.data,
  }));
  memberUpdateMock.mockResolvedValue({});
  auditorUpdateManyMock.mockResolvedValue({ count: 1 });
  memberUpdateManyMock.mockResolvedValue({ count: 1 });
  eventCreateMock.mockResolvedValue({});
  inviteMock.mockResolvedValue(undefined);
  transactionMock.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
});

describe("findAuditorByEmail", () => {
  it("matches the firm's quote email first, normalized", async () => {
    auditorFindUniqueMock.mockResolvedValue(FIRM);

    const found = await findAuditorByEmail("  Quotes@Nordlicht.Example ");

    expect(found).toEqual({ auditor: FIRM, member: null });
    expect(auditorFindUniqueMock.mock.calls[0][0].where).toEqual({
      quote_email: "quotes@nordlicht.example",
    });
    expect(memberFindUniqueMock).not.toHaveBeenCalled();
  });

  it("falls back to an approved teammate and returns that teammate's firm", async () => {
    memberFindUniqueMock.mockResolvedValue({ ...MEMBER, auditor: FIRM });

    const found = await findAuditorByEmail("alice@nordlicht.example");

    expect(found?.auditor).toEqual(FIRM);
    expect(found?.member).toMatchObject({ id: "mem-1", email: "alice@nordlicht.example" });
    expect(memberFindUniqueMock.mock.calls[0][0].where).toEqual({
      email: "alice@nordlicht.example",
    });
  });

  it("returns null for an unknown address", async () => {
    expect(await findAuditorByEmail("stranger@example.com")).toBeNull();
  });
});

describe("resolveAuditorByEmail", () => {
  it("stamps a teammate's first login without touching an already-active firm", async () => {
    memberFindUniqueMock.mockResolvedValue({ ...MEMBER, auditor: FIRM });

    const auditor = await resolveAuditorByEmail("alice@nordlicht.example");

    expect(auditor).toEqual(FIRM);
    expect(memberUpdateManyMock.mock.calls[0][0]).toMatchObject({
      where: { id: "mem-1", first_login_at: null },
    });
    expect(memberUpdateManyMock.mock.calls[0][0].data.first_login_at).toBeInstanceOf(Date);
    expect(auditorUpdateManyMock).not.toHaveBeenCalled();
    expect(eventCreateMock).not.toHaveBeenCalled();
  });

  it("a teammate's sign-in can be the firm's first login, attributed to that address", async () => {
    const invitedFirm = { ...FIRM, first_login_at: null };
    memberFindUniqueMock.mockResolvedValue({ ...MEMBER, auditor: invitedFirm });

    await resolveAuditorByEmail("alice@nordlicht.example");

    expect(auditorUpdateManyMock.mock.calls[0][0]).toMatchObject({
      where: { id: "aud-1", first_login_at: null },
    });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      actor_type: "auditor",
      actor_id: "aud-1",
      action: "auditor_first_login",
      meta: { firm_name: "Nordlicht Security", actor_email: "alice@nordlicht.example" },
    });
  });

  it("does not mark a teammate of a deactivated firm as having accepted the invite", async () => {
    memberFindUniqueMock.mockResolvedValue({ ...MEMBER, auditor: { ...FIRM, active: false } });

    const auditor = await resolveAuditorByEmail("alice@nordlicht.example");

    expect(auditor).toMatchObject({ id: "aud-1", active: false });
    expect(memberUpdateManyMock).not.toHaveBeenCalled();
    expect(auditorUpdateManyMock).not.toHaveBeenCalled();
  });

  it("does not re-stamp a teammate who already signed in", async () => {
    memberFindUniqueMock.mockResolvedValue({
      ...MEMBER,
      first_login_at: new Date("2026-08-20"),
      auditor: FIRM,
    });

    await resolveAuditorByEmail("alice@nordlicht.example");

    expect(memberUpdateManyMock).not.toHaveBeenCalled();
  });
});

describe("updateAuditor", () => {
  beforeEach(() => {
    auditorFindUniqueMock.mockResolvedValue({ ...FIRM, active: true });
    auditorUpdateMock.mockImplementation(async (a: { data: Record<string, unknown> }) => ({
      ...FIRM,
      ...a.data,
    }));
  });

  it("an admin actor spreads services, website and logo_url", async () => {
    await updateAuditor(
      "aud-1",
      { services: ["OpSec"], website: "https://x.example/", logo_url: "https://b" },
      ADMIN_ACTOR,
    );
    expect(auditorUpdateMock.mock.calls[0][0].data).toMatchObject({
      services: ["OpSec"],
      website: "https://x.example/",
      logo_url: "https://b",
    });
  });

  it("logs an auditor actor with actor_type, actor_email and the changed fields", async () => {
    await updateAuditor("aud-1", { website: "https://x.example/" }, AUDITOR_ACTOR);
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      actor_type: "auditor",
      actor_id: "aud-1",
      action: "auditor_updated",
      meta: {
        firm_name: "Nordlicht Security",
        actor_email: "alice@nordlicht.example",
        fields: ["website"],
      },
    });
  });

  it("never lets an auditor actor write active or firm_name (S-13)", async () => {
    await updateAuditor(
      "aud-1",
      { active: false, firm_name: "X", services: ["OpSec"] } as never,
      AUDITOR_ACTOR,
    );
    const data = auditorUpdateMock.mock.calls[0][0].data;
    expect("active" in data).toBe(false);
    expect("firm_name" in data).toBe(false);
    expect(data).toMatchObject({ services: ["OpSec"] });
  });
});

describe("createAuditor", () => {
  it("checks for a teammate clash and inserts inside one serializable transaction", async () => {
    auditorCreateMock.mockResolvedValue({
      id: "aud-2",
      firm_name: "Newfirm",
      quote_email: "quotes@newfirm.example",
    });

    const result = await createAuditor(
      { firm_name: "Newfirm", quote_email: "quotes@newfirm.example", services: [] },
      { id: "admin-1", name: "Federico" },
    );

    expect(result).toMatchObject({ success: true, inviteSent: true });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(memberFindUniqueMock.mock.calls[0][0].where).toEqual({
      email: "quotes@newfirm.example",
    });
    expect(inviteMock).toHaveBeenCalledWith({
      firm_name: "Newfirm",
      email: "quotes@newfirm.example",
    });
  });

  it("refuses a quote email that is already an approved teammate somewhere", async () => {
    memberFindUniqueMock.mockResolvedValue(MEMBER);

    const result = await createAuditor(
      { firm_name: "Copycat", quote_email: "alice@nordlicht.example", services: [] },
      { id: "admin-1", name: "Federico" },
    );

    expect(result).toEqual({ success: false, code: "duplicate_email" });
    expect(auditorCreateMock).not.toHaveBeenCalled();
  });
});
