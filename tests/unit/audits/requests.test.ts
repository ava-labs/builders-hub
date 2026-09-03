import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  updateManyMock,
  deleteManyMock,
  eventCreateMock,
  txRequestFindFirstMock,
  txRequestUpdateMock,
  txEventCountMock,
  txEventCreateMock,
  txAuditorFindManyMock,
  txDeliveryCreateManyMock,
  deliverFanoutEmailsMock,
} = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  deleteManyMock: vi.fn(),
  eventCreateMock: vi.fn(),
  txRequestFindFirstMock: vi.fn(),
  txRequestUpdateMock: vi.fn(),
  txEventCountMock: vi.fn(),
  txEventCreateMock: vi.fn(),
  txAuditorFindManyMock: vi.fn(),
  txDeliveryCreateManyMock: vi.fn(),
  deliverFanoutEmailsMock: vi.fn(),
}));

const tx = {
  auditRequest: { findFirst: txRequestFindFirstMock, update: txRequestUpdateMock },
  auditEventLog: { count: txEventCountMock, create: txEventCreateMock },
  auditor: { findMany: txAuditorFindManyMock },
  auditFanoutDelivery: { createMany: txDeliveryCreateManyMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    auditRequest: { updateMany: updateManyMock, deleteMany: deleteManyMock },
    auditEventLog: { create: eventCreateMock },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

// Only the send is mocked; toFanoutRequest is a pure mapper and the reopen
// path depends on its real output shape.
vi.mock("@/server/services/audits/fanout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/audits/fanout")>()),
  deliverFanoutEmails: deliverFanoutEmailsMock,
}));

import { patchDraft, deleteDraft, reopen, withdraw } from "@/server/services/audits/requests";

const OWNER = "user-owner";

beforeEach(() => {
  vi.clearAllMocks();
  updateManyMock.mockResolvedValue({ count: 1 });
  deleteManyMock.mockResolvedValue({ count: 1 });
  eventCreateMock.mockResolvedValue({});
});

describe("patchDraft", () => {
  it("only ever updates the caller's own draft", async () => {
    await patchDraft(OWNER, "req-1", { project_name: "Glacierswap" });

    expect(updateManyMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
      status: "draft",
    });
  });

  it("reports not_found when nothing matched (submitted or foreign request)", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await patchDraft(OWNER, "req-1", { project_name: "X" });

    expect(result).toEqual({ success: false, code: "not_found" });
  });
});

describe("deleteDraft", () => {
  it("pins owner and draft status on delete", async () => {
    await deleteDraft(OWNER, "req-1");

    expect(deleteManyMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
      status: "draft",
    });
  });
});

describe("withdraw", () => {
  it("withdraws only a collecting request and logs the event", async () => {
    const result = await withdraw(OWNER, "req-1");

    expect(updateManyMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
      status: "collecting",
    });
    expect(updateManyMock.mock.calls[0][0].data).toMatchObject({ status: "withdrawn" });
    expect(result).toEqual({ success: true });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      action: "request_withdrawn",
      actor_type: "project_user",
      actor_id: OWNER,
    });
  });

  it("does not log an event when nothing was withdrawn", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await withdraw(OWNER, "req-1");

    expect(result).toEqual({ success: false, code: "not_found" });
    expect(eventCreateMock).not.toHaveBeenCalled();
  });
});

describe("reopen", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const expiredRow = {
    id: "req-1",
    project_name: "Glacierswap",
    services: [],
    nsloc: 4200,
    status: "collecting",
    quote_deadline: new Date(Date.now() - 2 * DAY),
    _count: { quotes: 0 },
  };

  beforeEach(() => {
    txRequestFindFirstMock.mockResolvedValue(expiredRow);
    txEventCountMock.mockResolvedValue(0);
    txRequestUpdateMock.mockResolvedValue({});
    txAuditorFindManyMock.mockResolvedValue([
      {
        id: "aud-1",
        firm_name: "Nordlicht Security",
        quote_email: "quotes@nordlicht.example",
        members: [],
      },
    ]);
    txDeliveryCreateManyMock.mockResolvedValue({ count: 1 });
    txEventCreateMock.mockResolvedValue({});
    deliverFanoutEmailsMock.mockResolvedValue({ emailFailures: 0 });
  });

  it("gives an expired request a fresh +10d deadline and re-fans out, history intact", async () => {
    const result = await reopen(OWNER, "req-1");

    expect(result).toMatchObject({ success: true, auditorCount: 1 });
    const deadline = txRequestUpdateMock.mock.calls[0][0].data.quote_deadline as Date;
    expect(Math.abs(deadline.getTime() - (Date.now() + 10 * DAY))).toBeLessThan(60_000);
    expect(txDeliveryCreateManyMock.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(txEventCreateMock.mock.calls[0][0].data).toMatchObject({
      action: "request_reopened",
    });
    expect(deliverFanoutEmailsMock).toHaveBeenCalledTimes(1);
  });

  it("refuses anything that is not derived-expired (quotes exist)", async () => {
    txRequestFindFirstMock.mockResolvedValue({ ...expiredRow, _count: { quotes: 2 } });

    const result = await reopen(OWNER, "req-1");

    expect(result).toEqual({ success: false, code: "not_reopenable" });
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
  });

  it("allows exactly one extra round", async () => {
    txEventCountMock.mockResolvedValue(1);

    const result = await reopen(OWNER, "req-1");

    expect(result).toEqual({ success: false, code: "already_reopened" });
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
  });
});
