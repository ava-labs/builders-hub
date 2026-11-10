import { describe, expect, it } from "vitest";

import { formatCompact, formatCompactIn, formatExact } from "@/components/landing-v2/compactFigure";

describe("formatCompact", () => {
  it("sets large figures to three significant digits with a B, M or K suffix", () => {
    expect(formatCompact(2_118_145_663.76, "usd")).toBe("$2.12B");
    expect(formatCompact(43_612_345)).toBe("43.6M");
    expect(formatCompact(137_123)).toBe("137K");
    expect(formatCompact(658_512_000, "usd")).toBe("$659M");
    expect(formatCompact(184_507_462)).toBe("185M");
  });

  it("keeps trailing zeros, so a figure always shows three digits", () => {
    expect(formatCompact(2_103_385_066.8, "usd")).toBe("$2.10B");
    expect(formatCompact(43_012_345)).toBe("43.0M");
    expect(formatCompact(1_000_000)).toBe("1.00M");
  });

  it("keeps counts under 10,000 exact", () => {
    expect(formatCompact(1_177)).toBe("1,177");
    expect(formatCompact(66)).toBe("66");
    expect(formatCompact(9_999)).toBe("9,999");
    expect(formatCompact(10_000)).toBe("10.0K");
  });

  it("never uses a locale suffix such as bn", () => {
    expect(formatCompact(3_920_000_000, "usd")).toBe("$3.92B");
    expect(formatCompact(1.2e12, "usd")).toBe("$1.20T");
  });
});

describe("formatExact", () => {
  it("keeps the full figure: money to the cent, counts grouped", () => {
    expect(formatExact(2_118_145_663.76, "usd")).toBe("$2,118,145,663.76");
    expect(formatExact(43_612_345)).toBe("43,612,345");
  });
});

describe("formatCompactIn", () => {
  it("counts up inside the target's unit and decimals", () => {
    expect(formatCompactIn(0, 2_118_145_663.76, "usd")).toBe("$0.00B");
    expect(formatCompactIn(850_000_000, 2_118_145_663.76, "usd")).toBe("$0.85B");
    expect(formatCompactIn(5_000, 43_612_345)).toBe("0.0M");
    expect(formatCompactIn(60_000, 137_123)).toBe("60K");
  });

  it("ends on the exact compact string", () => {
    expect(formatCompactIn(43_612_345, 43_612_345)).toBe(formatCompact(43_612_345));
    expect(formatCompactIn(999_600, 999_600)).toBe("1.00M");
  });

  it("counts up with the target's trailing zeros", () => {
    expect(formatCompactIn(0, 2_103_385_066.8, "usd")).toBe("$0.00B");
    expect(formatCompactIn(21_500_000, 43_012_345)).toBe("21.5M");
    expect(formatCompactIn(500_000, 1_000_000)).toBe("0.50M");
  });

  it("counts small targets as whole numbers", () => {
    expect(formatCompactIn(33.4, 66)).toBe("33");
    expect(formatCompactIn(1_177, 1_177)).toBe("1,177");
  });
});
