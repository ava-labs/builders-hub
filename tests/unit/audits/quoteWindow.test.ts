import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  deliveryFindUniqueMock,
  requestFindUniqueMock,
  quoteCreateMock,
  quoteUpdateMock,
  eventCreateMock,
  getOwnQuoteMock,
} = vi.hoisted(() => ({
  deliveryFindUniqueMock: vi.fn(),
  requestFindUniqueMock: vi.fn(),
  quoteCreateMock: vi.fn(),
  quoteUpdateMock: vi.fn(),
  eventCreateMock: vi.fn(),
  getOwnQuoteMock: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    auditFanoutDelivery: { findUnique: deliveryFindUniqueMock },
    auditRequest: { findUnique: requestFindUniqueMock },
    auditQuote: { create: quoteCreateMock, update: quoteUpdateMock },
    auditEventLog: { create: eventCreateMock },
  },
}));

vi.mock("@/server/services/audits/visibility", () => ({
  getOwnQuote: getOwnQuoteMock,
}));

import { upsertOwnQuote } from "@/server/services/audits/quotes";

const DAY = 24 * 60 * 60 * 1000;
const AUDITOR = { id: "aud-1", firm_name: "Nordlicht Security", active: true };
const INPUT = {
  price_usd: 34500,
  duration_weeks: 4,
  earliest_start: new Date(Date.now() + 7 * DAY),
  message: "Fixed fee including a re-audit of fixes within 30 days.",
};

beforeEach(() => {
  vi.clearAllMocks();
  deliveryFindUniqueMock.mockResolvedValue({ request_id: "req-1", auditor_id: "aud-1" });
  requestFindUniqueMock.mockResolvedValue({
    status: "collecting",
    quote_deadline: new Date(Date.now() + 6 * DAY),
    project_name: "Glacierswap",
  });
  getOwnQuoteMock.mockResolvedValue(null);
  quoteCreateMock.mockResolvedValue({ id: "q-new" });
  quoteUpdateMock.mockResolvedValue({ id: "q-old" });
  eventCreateMock.mockResolvedValue({});
});

describe("upsertOwnQuote", () => {
  it("refuses a request this firm was never fanned out to", async () => {
    deliveryFindUniqueMock.mockResolvedValue(null);

    const result = await upsertOwnQuote(AUDITOR, "req-1", INPUT);

    expect(result).toEqual({ success: false, code: "not_invited" });
    expect(quoteCreateMock).not.toHaveBeenCalled();
  });

  it("refuses once the window is closed (past deadline or non-collecting)", async () => {
    requestFindUniqueMock.mockResolvedValue({
      status: "collecting",
      quote_deadline: new Date(Date.now() - DAY),
      project_name: "Glacierswap",
    });
    expect(await upsertOwnQuote(AUDITOR, "req-1", INPUT)).toEqual({
      success: false,
      code: "window_closed",
    });

    requestFindUniqueMock.mockResolvedValue({
      status: "engaged",
      quote_deadline: new Date(Date.now() + DAY),
      project_name: "Glacierswap",
    });
    expect(await upsertOwnQuote(AUDITOR, "req-1", INPUT)).toEqual({
      success: false,
      code: "window_closed",
    });
    expect(quoteCreateMock).not.toHaveBeenCalled();
    expect(quoteUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses a deactivated firm even inside an open window", async () => {
    // Read-only portal access for deactivated firms (round-3 N-4) must never
    // extend to writes; the route wrapper AND the service both refuse.
    const result = await upsertOwnQuote({ ...AUDITOR, active: false }, "req-1", INPUT);

    expect(result).toEqual({ success: false, code: "not_active" });
    expect(quoteCreateMock).not.toHaveBeenCalled();
    expect(quoteUpdateMock).not.toHaveBeenCalled();
    expect(eventCreateMock).not.toHaveBeenCalled();
  });

  it("creates the first quote pinned to this auditor and logs quote_submitted", async () => {
    const result = await upsertOwnQuote(AUDITOR, "req-1", INPUT);

    expect(result).toMatchObject({ success: true, updated: false });
    expect(quoteCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      auditor_id: "aud-1",
      price_usd: 34500,
    });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      action: "quote_submitted",
      actor_type: "auditor",
      actor_id: "aud-1",
      meta: { firm_name: "Nordlicht Security", price_usd: 34500 },
    });
  });

  it("updates an existing quote through the composite key and logs quote_updated", async () => {
    getOwnQuoteMock.mockResolvedValue({ id: "q-old", status: "submitted" });

    const result = await upsertOwnQuote(AUDITOR, "req-1", INPUT);

    expect(result).toMatchObject({ success: true, updated: true });
    expect(quoteUpdateMock.mock.calls[0][0].where).toEqual({
      request_id_auditor_id: { request_id: "req-1", auditor_id: "aud-1" },
    });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({ action: "quote_updated" });
  });
});