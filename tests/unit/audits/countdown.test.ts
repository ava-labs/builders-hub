import { describe, expect, it } from "vitest";
import { countdownTickMs, formatRemaining } from "@/components/audits/shared/CountdownChip";

/**
 * The countdown every chip shows (2026-10-20, call T1 B): two units until the
 * last day, then a live clock, so nobody has to work out UTC on the final day.
 */

const NOW = new Date("2026-10-27T12:00:00Z");
const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;
const at = (ms: number) => new Date(NOW.getTime() + ms);

describe("formatRemaining", () => {
  it("reads days and hours, both floored, with a day or more left", () => {
    expect(formatRemaining(at(2 * D + 4 * H + 30 * M), NOW)).toBe("in 2d 4h");
    expect(formatRemaining(at(9 * D + 6 * H + 59 * M), NOW)).toBe("in 9d 6h");
    expect(formatRemaining(at(D), NOW)).toBe("in 1d 0h");
  });

  it("becomes a zero-padded clock under 24 hours", () => {
    expect(formatRemaining(at(D - S), NOW)).toBe("in 23:59:59");
    expect(formatRemaining(at(5 * H + 12 * M + 44 * S), NOW)).toBe("in 05:12:44");
    expect(formatRemaining(at(59 * S), NOW)).toBe("in 00:00:59");
  });

  it("is closed at the deadline and after it", () => {
    expect(formatRemaining(NOW, NOW)).toBeNull();
    expect(formatRemaining(at(-S), NOW)).toBeNull();
  });
});

describe("countdownTickMs", () => {
  it("redraws once a minute with a day or more left, and when closed", () => {
    expect(countdownTickMs(at(D), NOW)).toBe(60 * S);
    expect(countdownTickMs(at(9 * D), NOW)).toBe(60 * S);
    expect(countdownTickMs(NOW, NOW)).toBe(60 * S);
    expect(countdownTickMs(at(-S), NOW)).toBe(60 * S);
  });

  it("redraws every second while the clock shows", () => {
    expect(countdownTickMs(at(D - S), NOW)).toBe(S);
    expect(countdownTickMs(at(59 * S), NOW)).toBe(S);
  });
});
