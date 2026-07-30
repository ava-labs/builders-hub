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

  it("computes the program share by rounding to whole dollars", () => {
    expect(computeSubsidySplit(28000, 75)).toEqual({
      program_amount_usd: 21000,
      project_amount_usd: 7000,
    });
    // 28001 * 0.75 = 21000.75 rounds to 21001; the project keeps the remainder.
    expect(computeSubsidySplit(28001, 75)).toEqual({
      program_amount_usd: 21001,
      project_amount_usd: 7000,
    });
  });

  it("gives the program nothing at 0 percent", () => {
    expect(computeSubsidySplit(34500, 0)).toEqual({
      program_amount_usd: 0,
      project_amount_usd: 34500,
    });
  });
});

describe("subsidyDecisionSchema", () => {
  const base = { state: "approved", pct: 35 };

  it("accepts the slider range at both ends", () => {
    expect(subsidyDecisionSchema.safeParse({ ...base, pct: 0 }).success).toBe(true);
    expect(subsidyDecisionSchema.safeParse({ ...base, pct: 75 }).success).toBe(true);
    expect(subsidyDecisionSchema.safeParse({ state: "declined", pct: 0 }).success).toBe(true);
  });

  it("rejects percentages beyond the 75 cap, negatives, and non-integers", () => {
    expect(subsidyDecisionSchema.safeParse({ ...base, pct: 80 }).success).toBe(false);
    expect(subsidyDecisionSchema.safeParse({ ...base, pct: -5 }).success).toBe(false);
    expect(subsidyDecisionSchema.safeParse({ ...base, pct: 33.5 }).success).toBe(false);
  });

  it("only allows the two v1 decision states", () => {
    expect(subsidyDecisionSchema.safeParse({ state: "paid", pct: 10 }).success).toBe(false);
    expect(subsidyDecisionSchema.safeParse({ state: "requested", pct: 10 }).success).toBe(false);
  });

  it("accepts an optional note", () => {
    expect(
      subsidyDecisionSchema.safeParse({ ...base, note: "Board approved 2026-08-01" }).success,
    ).toBe(true);
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
      price_usd: 28000,
      firm_name: "Nordlicht Security",
    });
    txDecisionCreateMock.mockResolvedValue({ id: "dec-1" });
    txEventCreateMock.mockResolvedValue({});
  });

  it("APPENDS a decision row with the split computed at decision time", async () => {
    const result = await decideSubsidy("req-1", { state: "approved", pct: 75 }, ADMIN);

    expect(result.success).toBe(true);
    expect(txDecisionCreateMock).toHaveBeenCalledTimes(1);
    expect(txDecisionCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      quote_id: "q-2",
      state: "approved",
      pct: 75,
      program_amount_usd: 21000,
      project_amount_usd: 7000,
      decided_by: "admin-1",
    });
  });

  it("logs the approval with the admin's name in the event meta", async () => {
    await decideSubsidy("req-1", { state: "approved", pct: 75 }, ADMIN);

    expect(txEventCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      actor_type: "admin",
      actor_id: "admin-1",
      action: "subsidy_approved",
      meta: { pct: 75, program_amount_usd: 21000, admin_name: "Federico" },
    });
  });

  it("a decline stores pct 0 regardless of the slider position", async () => {
    await decideSubsidy("req-1", { state: "declined", pct: 40 }, ADMIN);

    expect(txDecisionCreateMock.mock.calls[0][0].data).toMatchObject({
      state: "declined",
      pct: 0,
      program_amount_usd: 0,
      project_amount_usd: 28000,
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

    const result = await decideSubsidy("req-1", { state: "approved", pct: 10 }, ADMIN);

    expect(result).toEqual({ success: false, code: "invalid_state" });
    expect(txDecisionCreateMock).not.toHaveBeenCalled();
  });
});
