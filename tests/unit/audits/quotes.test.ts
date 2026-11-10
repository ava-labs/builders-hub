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
import { auditQuoteSchema } from "@/types/audits";

const DAY = 24 * 60 * 60 * 1000;
const FIRM = {
  id: "aud-1",
  firm_name: "Nordlicht Security",
  active: true,
  actor_email: "alice@nordlicht.example",
};
const INPUT = {
  price_usd: 28000,
  duration: 4,
  duration_unit: "weeks" as const,
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

describe("upsertOwnQuote duration", () => {
  it("stores the duration in the unit the firm picked, on a new quote and on an edit", async () => {
    await upsertOwnQuote(FIRM, "req-1", { ...INPUT, duration: 10, duration_unit: "days" });
    expect(quoteCreateMock.mock.calls[0][0].data).toMatchObject({
      duration: 10,
      duration_unit: "days",
    });

    getOwnQuoteMock.mockResolvedValue({ id: "q-1" });
    await upsertOwnQuote(FIRM, "req-1", { ...INPUT, duration: 3, duration_unit: "weeks" });
    expect(quoteUpdateMock.mock.calls[0][0].data).toMatchObject({
      duration: 3,
      duration_unit: "weeks",
    });
  });
});

describe("auditQuoteSchema · duration", () => {
  // Joey, 2026-09-30: firms want to quote days as well as weeks.
  const accepts = (over: Record<string, unknown>) =>
    auditQuoteSchema.safeParse({
      price_usd: 28000,
      duration: 4,
      duration_unit: "weeks",
      earliest_start: new Date(Date.now() + 14 * DAY).toISOString(),
      message: "Fixed fee.",
      ...over,
    }).success;

  it("takes a duration in days or in weeks", () => {
    expect(accepts({ duration: 10, duration_unit: "days" })).toBe(true);
    expect(accepts({ duration: 3, duration_unit: "weeks" })).toBe(true);
  });

  it("caps a quote at one year in either unit", () => {
    expect(accepts({ duration: 365, duration_unit: "days" })).toBe(true);
    expect(accepts({ duration: 366, duration_unit: "days" })).toBe(false);
    expect(accepts({ duration: 52, duration_unit: "weeks" })).toBe(true);
    expect(accepts({ duration: 53, duration_unit: "weeks" })).toBe(false);
  });

  it("refuses a zero duration and a missing or unknown unit", () => {
    expect(accepts({ duration: 0 })).toBe(false);
    expect(accepts({ duration_unit: undefined })).toBe(false);
    expect(accepts({ duration_unit: "months" })).toBe(false);
  });
});
