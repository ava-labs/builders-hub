import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeSubsidySplit } from "@/lib/audits/subsidy";
import { subsidyDecisionSchema } from "@/types/audits";

const { txRequestFindUniqueMock, txDecisionCreateMock, txEventCreateMock, acceptedQuoteMock } =
  vi.hoisted(() => ({
    txRequestFindUniqueMock: vi.fn(),
    txDecisionCreateMock: vi.fn(),
    txEventCreateMock: vi.fn(),
    acceptedQuoteMock: vi.fn(),
  }));

const tx = {
  auditRequest: { findUnique: txRequestFindUniqueMock },
  auditSubsidyDecision: { create: txDecisionCreateMock },
  auditEventLog: { create: txEventCreateMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

vi.mock("@/server/services/audits/visibility", () => ({
  getAcceptedQuoteForAdmin: acceptedQuoteMock,
}));

import { decideSubsidy } from "@/server/services/audits/subsidy";

const ADMIN = { id: "admin-1", name: "Federico" };

describe("computeSubsidySplit", () => {
  it("splits whole-dollar prices so the parts always sum to the price", () => {
    for (const price of [28000, 34500, 28001, 99999, 1]) {
      for (const pct of [0, 5, 35, 75]) {
        const split = computeSubsidySplit(price, pct);
        expect(split.program_amount_usd + split.project_amount_usd).toBe(price);
      }
    }
  });
});

describe("subsidyDecisionSchema (amount-based)", () => {
  it("accepts whole-dollar program amounts", () => {
    expect(
      subsidyDecisionSchema.safeParse({ state: "approved", program_amount_usd: 2500 }).success,
    ).toBe(true);
    expect(
      subsidyDecisionSchema.safeParse({ state: "declined", program_amount_usd: 0 }).success,
    ).toBe(true);
  });

  it("rejects negatives, fractions and non-v1 states", () => {
    expect(
      subsidyDecisionSchema.safeParse({ state: "approved", program_amount_usd: -5 }).success,
    ).toBe(false);
    expect(
      subsidyDecisionSchema.safeParse({ state: "approved", program_amount_usd: 12.5 }).success,
    ).toBe(false);
    expect(
      subsidyDecisionSchema.safeParse({ state: "paid", program_amount_usd: 10 }).success,
    ).toBe(false);
  });
});

describe("decideSubsidy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txRequestFindUniqueMock.mockResolvedValue({
      id: "req-1",
      status: "engaged",
      accepted_quote_id: "q-2",
    });
    acceptedQuoteMock.mockResolvedValue({
      id: "q-2",
      price_usd: 22222,
      firm_name: "Nordlicht Security",
    });
    txDecisionCreateMock.mockResolvedValue({ id: "dec-1" });
    txEventCreateMock.mockResolvedValue({});
  });

  it("APPENDS the exact amounts with a derived display percentage", async () => {
    const result = await decideSubsidy(
      "req-1",
      { state: "approved", program_amount_usd: 2500 },
      ADMIN,
    );

    expect(result.success).toBe(true);
    expect(txDecisionCreateMock).toHaveBeenCalledTimes(1);
    expect(txDecisionCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      quote_id: "q-2",
      state: "approved",
      pct: 11, // 2500 / 22222 rounded, display only
      program_amount_usd: 2500,
      project_amount_usd: 19722,
      decided_by: "admin-1",
    });
    expect(txEventCreateMock.mock.calls[0][0].data.meta).toMatchObject({
      program_amount_usd: 2500,
      admin_name: "Federico",
    });
  });

  it("rejects amounts over the 75% cap", async () => {
    const result = await decideSubsidy(
      "req-1",
      { state: "approved", program_amount_usd: 20000 }, // cap is 16666
      ADMIN,
    );

    expect(result).toEqual({ success: false, code: "over_cap" });
    expect(txDecisionCreateMock).not.toHaveBeenCalled();
  });

  it("a decline stores zero regardless of the typed amount", async () => {
    await decideSubsidy("req-1", { state: "declined", program_amount_usd: 4000 }, ADMIN);

    expect(txDecisionCreateMock.mock.calls[0][0].data).toMatchObject({
      state: "declined",
      pct: 0,
      program_amount_usd: 0,
      project_amount_usd: 22222,
    });
    expect(txEventCreateMock.mock.calls[0][0].data).toMatchObject({
      action: "subsidy_declined",
    });
  });

  it("refuses anything but an engaged request with an accepted quote", async () => {
    txRequestFindUniqueMock.mockResolvedValue({
      id: "req-1",
      status: "collecting",
      accepted_quote_id: null,
    });

    const result = await decideSubsidy(
      "req-1",
      { state: "approved", program_amount_usd: 100 },
      ADMIN,
    );

    expect(result).toEqual({ success: false, code: "invalid_state" });
    expect(txDecisionCreateMock).not.toHaveBeenCalled();
  });
});