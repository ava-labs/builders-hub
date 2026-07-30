import { describe, it, expect } from "vitest";
import { computeSubsidySplit } from "@/lib/audits/subsidy";
import { subsidyDecisionSchema } from "@/types/audits";

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
