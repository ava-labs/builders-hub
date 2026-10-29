import { describe, expect, it } from "vitest";
import { ageWords } from "@/components/explorer-v2/format";

const NOW = 1_800_000_000;

describe("ageWords", () => {
  it("names the largest unit, singular at one", () => {
    expect(ageWords(NOW - 1, NOW)).toBe("1 sec ago");
    expect(ageWords(NOW - 13, NOW)).toBe("13 secs ago");
    expect(ageWords(NOW - 60, NOW)).toBe("1 min ago");
    expect(ageWords(NOW - 3 * 3600 - 59, NOW)).toBe("3 hrs ago");
    expect(ageWords(NOW - 86400, NOW)).toBe("1 day ago");
    expect(ageWords(NOW - 364 * 86400, NOW)).toBe("364 days ago");
  });

  it("adds the days past a whole year", () => {
    expect(ageWords(NOW - 365 * 86400, NOW)).toBe("1 yr ago");
    expect(ageWords(NOW - (365 + 351) * 86400, NOW)).toBe("1 yr 351 days ago");
    expect(ageWords(NOW - (730 + 1) * 86400, NOW)).toBe("2 yrs 1 day ago");
  });

  it("reads a missing time as n/a and a future time as now", () => {
    expect(ageWords(undefined, NOW)).toBe("n/a");
    expect(ageWords(NOW + 30, NOW)).toBe("0 secs ago");
  });
});
