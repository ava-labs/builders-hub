import { describe, expect, it } from "vitest";
import { parseWholeNumber, weeksLabel } from "@/components/audits/shared/format";
import { normalizeUrlInput } from "@/types/audits";

describe("parseWholeNumber", () => {
  it("reads thousands separators the way a human types them", () => {
    // The reported bug: parseInt("12,500") is 12, so a $12,500 quote was
    // recorded as $12 and the project could have accepted that price.
    expect(parseWholeNumber("12,500")).toBe(12500);
    expect(Number.parseInt("12,500", 10)).toBe(12);
  });

  it("accepts the other shapes people type", () => {
    expect(parseWholeNumber("12500")).toBe(12500);
    expect(parseWholeNumber("$12,500")).toBe(12500);
    expect(parseWholeNumber("12 500")).toBe(12500);
    expect(parseWholeNumber(" 1,000,000 ")).toBe(1_000_000);
    expect(parseWholeNumber("0")).toBe(0);
  });

  it("refuses anything that is not a whole number instead of coercing it", () => {
    // Silence is the danger here: every one of these used to become a number.
    expect(parseWholeNumber("12.5")).toBeNull();
    expect(parseWholeNumber("12,5.00")).toBeNull();
    expect(parseWholeNumber("12abc")).toBeNull();
    expect(parseWholeNumber("abc")).toBeNull();
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber("-500")).toBeNull();
    expect(parseWholeNumber("1e5")).toBeNull();
  });

  it("refuses numbers too large to hold exactly", () => {
    expect(parseWholeNumber("9".repeat(20))).toBeNull();
  });
});

describe("weeksLabel", () => {
  it("says week in the singular", () => {
    expect(weeksLabel(1)).toBe("1 week");
  });

  it("pluralizes everything else, including zero", () => {
    expect(weeksLabel(0)).toBe("0 weeks");
    expect(weeksLabel(2)).toBe("2 weeks");
    expect(weeksLabel(12)).toBe("12 weeks");
  });
});

describe("normalizeUrlInput", () => {
  it("adds the scheme people should not have to type", () => {
    expect(normalizeUrlInput("yourproject.com")).toBe("https://yourproject.com");
    expect(normalizeUrlInput("  avax.network/docs  ")).toBe("https://avax.network/docs");
  });

  it("leaves an existing scheme exactly as written", () => {
    expect(normalizeUrlInput("https://avax.network")).toBe("https://avax.network");
    expect(normalizeUrlInput("http://legacy.example")).toBe("http://legacy.example");
  });

  it("repairs a half-typed scheme instead of doubling it", () => {
    expect(normalizeUrlInput("https:/avax.network")).toBe("https://avax.network");
    expect(normalizeUrlInput("//avax.network")).toBe("https://avax.network");
  });

  it("leaves empty input empty so autosave never invents a value", () => {
    expect(normalizeUrlInput("")).toBe("");
    expect(normalizeUrlInput("   ")).toBe("");
  });
});
