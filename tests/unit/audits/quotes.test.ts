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
vi.mock("@/server/services/audits/visibility", () => ({ getOwnQuote: getOwnQuoteMock }));

import { upsertOwnQuote } from "@/server/services/audits/quotes";

const DAY = 24 * 60 * 60 * 1000;
const FIRM = {
  id: "aud-1",
  firm_name: "Nordlicht Security",
  active: true,
  actor_email: "alice@nordlicht.example",
};
const INPUT = {
  price_usd: 28000,
  duration_weeks: 4,
  earliest_start: new Date(Date.now() + 14 * DAY),
  message: "Fixed fee, four weeks, two auditors.",
};

beforeEach(() => {
  vi.clearAllMocks();
  deliveryFindUniqueMock.mockResolvedValue({ request_id: "req-1" });
  requestFindUniqueMock.mockResolvedValue({
    status: "collecting",
    quote_deadline: new Date(Date.now() + 5 * DAY),
    project_name: "Glacierswap",
  });
  getOwnQuoteMock.mockResolvedValue(null);
  quoteCreateMock.mockResolvedValue({});
  quoteUpdateMock.mockResolvedValue({});
  eventCreateMock.mockResolvedValue({});
});

describe("upsertOwnQuote attribution", () => {
  it("records which approved address saved a new quote and attributes the event", async () => {
    const result = await upsertOwnQuote(FIRM, "req-1", INPUT);

    expect(result).toEqual({ success: true, updated: false });
    expect(quoteCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      auditor_id: "aud-1",
      submitted_by_email: "alice@nordlicht.example",
    });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      action: "quote_submitted",
      meta: {
        firm_name: "Nordlicht Security",
        price_usd: 28000,
        actor_email: "alice@nordlicht.example",
      },
    });
  });

  it("moves the contact to whoever edits the quote", async () => {
    getOwnQuoteMock.mockResolvedValue({ id: "q-1" });

    const result = await upsertOwnQuote(
      { ...FIRM, actor_email: "bob@nordlicht.example" },
      "req-1",
      INPUT,
    );

    expect(result).toEqual({ success: true, updated: true });
    expect(quoteUpdateMock.mock.calls[0][0].data.submitted_by_email).toBe("bob@nordlicht.example");
    expect(eventCreateMock.mock.calls[0][0].data.action).toBe("quote_updated");
  });

  it("keeps deactivated firms out before any lookup", async () => {
    const result = await upsertOwnQuote({ ...FIRM, active: false }, "req-1", INPUT);

    expect(result).toEqual({ success: false, code: "not_active" });
    expect(deliveryFindUniqueMock).not.toHaveBeenCalled();
  });
});
