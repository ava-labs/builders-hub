import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  txRequestFindFirstMock,
  txRequestUpdateMock,
  txAuditorFindManyMock,
  txDeliveryCreateManyMock,
  txEventCreateManyMock,
  deliveryUpdateMock,
  sendFanoutMock,
} = vi.hoisted(() => ({
  txRequestFindFirstMock: vi.fn(),
  txRequestUpdateMock: vi.fn(),
  txAuditorFindManyMock: vi.fn(),
  txDeliveryCreateManyMock: vi.fn(),
  txEventCreateManyMock: vi.fn(),
  deliveryUpdateMock: vi.fn(),
  sendFanoutMock: vi.fn(),
}));

const tx = {
  auditRequest: { findFirst: txRequestFindFirstMock, update: txRequestUpdateMock },
  auditor: { findMany: txAuditorFindManyMock },
  auditFanoutDelivery: { createMany: txDeliveryCreateManyMock },
  auditEventLog: { createMany: txEventCreateManyMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    auditFanoutDelivery: { update: deliveryUpdateMock },
  },
}));

vi.mock("@/server/services/audits/emails/sendFanoutNotification", () => ({
  sendFanoutNotification: sendFanoutMock,
}));

import { submitRequestAndFanout } from "@/server/services/audits/fanout";

const OWNER = "user-owner";
const DAY = 24 * 60 * 60 * 1000;

const completeDraft = {
  id: "req-1",
  user_id: OWNER,
  status: "draft",
  project_name: "Glacierswap",
  website: "https://glacierswap.example",
  description: "Concentrated-liquidity DEX on the C-Chain with a custom router.",
  scope: "Audit of the pool factory, router and incentives module before mainnet.",
  deployment_target: "c_chain",
  services: ["Smart contract audit (Solidity / Vyper)"],
  repos: [],
  doc_links: [],
  needed_by: new Date(Date.now() + 45 * DAY),
  quote_deadline: null,
  contact_name: "Alex Stone",
  contact_email: "alex@glacierswap.example",
  contact_calendar_url: null,
};

const ACTIVE_FIRMS = [
  { id: "aud-1", firm_name: "Nordlicht Security", quote_email: "quotes@nordlicht.example" },
  { id: "aud-2", firm_name: "Ledgerproof Labs", quote_email: "audits@ledgerproof.example" },
  { id: "aud-3", firm_name: "Harborline", quote_email: "quotes@harborline.example" },
];

beforeEach(() => {
  vi.clearAllMocks();
  txRequestFindFirstMock.mockResolvedValue(completeDraft);
  txRequestUpdateMock.mockResolvedValue({});
  txAuditorFindManyMock.mockResolvedValue(ACTIVE_FIRMS);
  txDeliveryCreateManyMock.mockResolvedValue({ count: ACTIVE_FIRMS.length });
  txEventCreateManyMock.mockResolvedValue({ count: 2 });
  deliveryUpdateMock.mockResolvedValue({});
  sendFanoutMock.mockResolvedValue(undefined);
});

describe("submitRequestAndFanout", () => {
  it("fans out to ACTIVE firms only, one delivery per firm", async () => {
    const result = await submitRequestAndFanout("req-1", OWNER);

    expect(txAuditorFindManyMock.mock.calls[0][0].where).toMatchObject({ active: true });
    const created = txDeliveryCreateManyMock.mock.calls[0][0].data;
    expect(created).toHaveLength(3);
    expect(new Set(created.map((d: { auditor_id: string }) => d.auditor_id)).size).toBe(3);
    expect(sendFanoutMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ success: true, auditorCount: 3, emailFailures: 0 });
  });

  it("degrades a failing send to email_status failed without failing submission", async () => {
    sendFanoutMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("sendgrid down"))
      .mockResolvedValueOnce(undefined);

    const result = await submitRequestAndFanout("req-1", OWNER);

    expect(result).toMatchObject({ success: true, emailFailures: 1 });
    const statuses = deliveryUpdateMock.mock.calls.map((c) => c[0].data.email_status).sort();
    expect(statuses).toEqual(["failed", "sent", "sent"]);
  });

  it("refuses anything but the caller's own draft", async () => {
    txRequestFindFirstMock.mockResolvedValue(null);

    const result = await submitRequestAndFanout("req-1", "someone-else");

    expect(result).toMatchObject({ success: false, code: "not_found" });
    expect(txRequestFindFirstMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: "someone-else",
      status: "draft",
    });
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
    expect(sendFanoutMock).not.toHaveBeenCalled();
  });

  it("rejects an incomplete row with field errors and writes nothing", async () => {
    txRequestFindFirstMock.mockResolvedValue({ ...completeDraft, description: "" });

    const result = await submitRequestAndFanout("req-1", OWNER);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("invalid");
      expect(result.errors?.description).toBeDefined();
    }
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
    expect(txDeliveryCreateManyMock).not.toHaveBeenCalled();
  });

  it("rejects a row whose required needed_by date is null (no 1970 coercion)", async () => {
    txRequestFindFirstMock.mockResolvedValue({ ...completeDraft, needed_by: null });

    const result = await submitRequestAndFanout("req-1", OWNER);

    expect(result.success).toBe(false);
    if (!result.success && result.code === "invalid") {
      expect(result.errors?.needed_by).toBeDefined();
    }
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
  });

  it("defaults the quote deadline to +10 days when the draft has none", async () => {
    await submitRequestAndFanout("req-1", OWNER);

    const data = txRequestUpdateMock.mock.calls[0][0].data;
    expect(data.status).toBe("collecting");
    expect(data.quote_deadline).toBeInstanceOf(Date);
    const tenDays = Date.now() + 10 * DAY;
    expect(Math.abs(data.quote_deadline.getTime() - tenDays)).toBeLessThan(60_000);
  });

  it("keeps a deadline the project picked", async () => {
    const picked = new Date(Date.now() + 5 * DAY);
    txRequestFindFirstMock.mockResolvedValue({ ...completeDraft, quote_deadline: picked });

    await submitRequestAndFanout("req-1", OWNER);

    expect(txRequestUpdateMock.mock.calls[0][0].data.quote_deadline).toEqual(picked);
  });
});
