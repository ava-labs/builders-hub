import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  txRequestFindFirstMock,
  txRequestUpdateMock,
  txAuditorFindManyMock,
  txDeliveryCreateManyMock,
  txEventCreateManyMock,
  txEventCreateMock,
  deliveryUpdateMock,
  requestUpdateManyMock,
  eventCreateMock,
  sendFanoutMock,
} = vi.hoisted(() => ({
  txRequestFindFirstMock: vi.fn(),
  txRequestUpdateMock: vi.fn(),
  txAuditorFindManyMock: vi.fn(),
  txDeliveryCreateManyMock: vi.fn(),
  txEventCreateManyMock: vi.fn(),
  txEventCreateMock: vi.fn(),
  deliveryUpdateMock: vi.fn(),
  requestUpdateManyMock: vi.fn(),
  eventCreateMock: vi.fn(),
  sendFanoutMock: vi.fn(),
}));

const tx = {
  auditRequest: { findFirst: txRequestFindFirstMock, update: txRequestUpdateMock },
  auditor: { findMany: txAuditorFindManyMock },
  auditFanoutDelivery: { createMany: txDeliveryCreateManyMock },
  auditEventLog: { createMany: txEventCreateManyMock, create: txEventCreateMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    auditFanoutDelivery: { update: deliveryUpdateMock },
    auditRequest: { updateMany: requestUpdateManyMock },
    auditEventLog: { create: eventCreateMock },
  },
}));

vi.mock("@/server/services/audits/emails/sendFanoutNotification", () => ({
  sendFanoutNotification: sendFanoutMock,
}));

import {
  approveRequestAndFanout,
  rejectRequest,
  submitRequestForReview,
} from "@/server/services/audits/fanout";

const OWNER = "user-owner";
const ADMIN = "user-admin";
const ADMIN_NAME = "Federico";
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
  multichain: false,
  services: ["Smart contract audit (Solidity / Vyper)"],
  project_types: ["DeFi"],
  languages: ["Solidity"],
  frameworks: ["Foundry"],
  nsloc: 4200,
  repos: [],
  doc_links: [],
  needed_by: new Date(Date.now() + 45 * DAY),
  quote_deadline: null,
  urgency: "within_6_weeks",
  contact_name: "Alex Stone",
  contact_email: "alex@glacierswap.example",
  contact_calendar_url: null,
};

const pendingRow = { ...completeDraft, status: "pending_review" };

const ACTIVE_FIRMS = [
  {
    id: "aud-1",
    firm_name: "Nordlicht Security",
    quote_email: "quotes@nordlicht.example",
    members: [{ email: "alice@nordlicht.example" }],
  },
  { id: "aud-2", firm_name: "Ledgerproof Labs", quote_email: "audits@ledgerproof.example", members: [] },
  { id: "aud-3", firm_name: "Harborline", quote_email: "quotes@harborline.example", members: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  txRequestFindFirstMock.mockResolvedValue(completeDraft);
  txRequestUpdateMock.mockResolvedValue({});
  txAuditorFindManyMock.mockResolvedValue(ACTIVE_FIRMS);
  txDeliveryCreateManyMock.mockResolvedValue({ count: ACTIVE_FIRMS.length });
  txEventCreateManyMock.mockResolvedValue({ count: 2 });
  txEventCreateMock.mockResolvedValue({});
  deliveryUpdateMock.mockResolvedValue({});
  requestUpdateManyMock.mockResolvedValue({ count: 1 });
  eventCreateMock.mockResolvedValue({});
  sendFanoutMock.mockResolvedValue(undefined);
});

describe("submitRequestForReview", () => {
  it("parks the request in pending_review and notifies NOBODY", async () => {
    const result = await submitRequestForReview("req-1", OWNER);

    expect(result).toMatchObject({ success: true });
    expect(txRequestUpdateMock.mock.calls[0][0].data.status).toBe("pending_review");
    // The whole point of the gate: no firms looked up, no delivery rows, no mail.
    expect(txAuditorFindManyMock).not.toHaveBeenCalled();
    expect(txDeliveryCreateManyMock).not.toHaveBeenCalled();
    expect(sendFanoutMock).not.toHaveBeenCalled();
  });

  it("leaves the quote deadline unstamped so review time never eats the window", async () => {
    await submitRequestForReview("req-1", OWNER);

    expect(txRequestUpdateMock.mock.calls[0][0].data.quote_deadline).toBeUndefined();
  });

  it("refuses anything but the caller's own draft", async () => {
    txRequestFindFirstMock.mockResolvedValue(null);

    const result = await submitRequestForReview("req-1", "someone-else");

    expect(result).toMatchObject({ success: false, code: "not_found" });
    expect(txRequestFindFirstMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: "someone-else",
      status: "draft",
    });
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects an incomplete row with field errors and writes nothing", async () => {
    txRequestFindFirstMock.mockResolvedValue({ ...completeDraft, description: "" });

    const result = await submitRequestForReview("req-1", OWNER);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("invalid");
      expect(result.errors?.description).toBeDefined();
    }
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a row whose required needed_by date is null (no 1970 coercion)", async () => {
    txRequestFindFirstMock.mockResolvedValue({ ...completeDraft, needed_by: null });

    const result = await submitRequestForReview("req-1", OWNER);

    expect(result.success).toBe(false);
    if (!result.success && result.code === "invalid") {
      expect(result.errors?.needed_by).toBeDefined();
    }
    expect(txRequestUpdateMock).not.toHaveBeenCalled();
  });
});

describe("approveRequestAndFanout", () => {
  beforeEach(() => {
    txRequestFindFirstMock.mockResolvedValue(pendingRow);
  });

  it("fans out to ACTIVE firms only, one delivery per firm", async () => {
    const result = await approveRequestAndFanout("req-1", ADMIN, ADMIN_NAME);

    expect(txAuditorFindManyMock.mock.calls[0][0].where).toMatchObject({ active: true });
    // Teammates ride along in the same read so the mail reaches everyone approved.
    expect(txAuditorFindManyMock.mock.calls[0][0].select).toMatchObject({
      members: { select: { email: true } },
    });
    expect(sendFanoutMock.mock.calls[0][0]).toMatchObject({
      members: [{ email: "alice@nordlicht.example" }],
    });
    const created = txDeliveryCreateManyMock.mock.calls[0][0].data;
    expect(created).toHaveLength(3);
    expect(new Set(created.map((d: { auditor_id: string }) => d.auditor_id)).size).toBe(3);
    expect(sendFanoutMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ success: true, auditorCount: 3, emailFailures: 0 });
  });

  it("only ever approves a pending_review row, so a double click cannot fan out twice", async () => {
    txRequestFindFirstMock.mockResolvedValue(null);

    const result = await approveRequestAndFanout("req-1", ADMIN, ADMIN_NAME);

    expect(result).toMatchObject({ success: false, code: "not_found" });
    expect(txRequestFindFirstMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      status: "pending_review",
    });
    expect(txRequestUpdateMock.mock.calls[0]?.[0]?.where).toBeUndefined();
    expect(sendFanoutMock).not.toHaveBeenCalled();
  });

  it("starts the quote window at approval, not at submission", async () => {
    await approveRequestAndFanout("req-1", ADMIN, ADMIN_NAME);

    const data = txRequestUpdateMock.mock.calls[0][0].data;
    expect(data.status).toBe("collecting");
    const tenDays = Date.now() + 10 * DAY;
    expect(Math.abs(data.quote_deadline.getTime() - tenDays)).toBeLessThan(60_000);
  });

  it("keeps a deadline the project picked", async () => {
    const picked = new Date(Date.now() + 5 * DAY);
    txRequestFindFirstMock.mockResolvedValue({ ...pendingRow, quote_deadline: picked });

    await approveRequestAndFanout("req-1", ADMIN, ADMIN_NAME);

    expect(txRequestUpdateMock.mock.calls[0][0].data.quote_deadline).toEqual(picked);
  });

  it("logs the approving admin on the trail", async () => {
    await approveRequestAndFanout("req-1", ADMIN, ADMIN_NAME);

    const actions = txEventCreateManyMock.mock.calls[0][0].data;
    expect(actions[0]).toMatchObject({
      action: "request_approved",
      actor_type: "admin",
      actor_id: ADMIN,
      meta: { admin_name: ADMIN_NAME },
    });
    expect(actions[1]).toMatchObject({ action: "fanout_created" });
  });

  it("degrades a failing send to email_status failed without failing the approval", async () => {
    sendFanoutMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("sendgrid down"))
      .mockResolvedValueOnce(undefined);

    const result = await approveRequestAndFanout("req-1", ADMIN, ADMIN_NAME);

    expect(result).toMatchObject({ success: true, emailFailures: 1 });
    const statuses = deliveryUpdateMock.mock.calls.map((c) => c[0].data.email_status).sort();
    expect(statuses).toEqual(["failed", "sent", "sent"]);
  });
});

describe("rejectRequest", () => {
  it("closes the request, writes no deliveries and sends no mail", async () => {
    const result = await rejectRequest("req-1", ADMIN, ADMIN_NAME, "Out of scope for the program");

    expect(result).toMatchObject({ success: true });
    expect(requestUpdateManyMock.mock.calls[0][0]).toMatchObject({
      where: { id: "req-1", status: "pending_review" },
      data: { status: "rejected" },
    });
    expect(txDeliveryCreateManyMock).not.toHaveBeenCalled();
    expect(sendFanoutMock).not.toHaveBeenCalled();
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      action: "request_rejected",
      meta: { admin_name: ADMIN_NAME, reason: "Out of scope for the program" },
    });
  });

  it("is a no-op once the request has left pending_review", async () => {
    requestUpdateManyMock.mockResolvedValue({ count: 0 });

    const result = await rejectRequest("req-1", ADMIN, ADMIN_NAME, "too late");

    expect(result).toMatchObject({ success: false });
    expect(eventCreateMock).not.toHaveBeenCalled();
  });
});

describe("consent", () => {
  it("stamps the moment of submission, not draft time", async () => {
    const before = Date.now();
    await submitRequestForReview("req-1", OWNER);

    const stamped = txRequestUpdateMock.mock.calls[0][0].data.contact_consent_at as Date;
    expect(stamped).toBeInstanceOf(Date);
    expect(stamped.getTime()).toBeGreaterThanOrEqual(before);
  });
});
