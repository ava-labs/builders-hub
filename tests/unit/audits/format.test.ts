import { describe, expect, it } from "vitest";
import {
  formatIsoDate,
  fromUtcCalendarDate,
  hostOf,
  isOutsideWindow,
  parseWholeNumber,
  priceDeltaLabel,
  toUtcCalendarDate,
  weeksLabel,
} from "@/components/audits/shared/format";
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

describe("calendar dates", () => {
  it("stores the day that was picked, not the day before", () => {
    // A picker hands back LOCAL midnight. Formatting that with toISOString
    // showed the previous day for anyone east of Greenwich.
    const pickedLocally = new Date(2026, 7, 18, 0, 0, 0);
    expect(formatIsoDate(toUtcCalendarDate(pickedLocally))).toBe("2026-08-18");
  });

  it("survives a late-evening pick, which is where the old bug bit", () => {
    const pickedLateLocal = new Date(2026, 7, 18, 23, 30, 0);
    expect(formatIsoDate(toUtcCalendarDate(pickedLateLocal))).toBe("2026-08-18");
  });

  it("round-trips back to the same calendar day for the picker", () => {
    const stored = new Date("2026-08-18T00:00:00.000Z");
    const shown = fromUtcCalendarDate(stored);
    expect(shown.getFullYear()).toBe(2026);
    expect(shown.getMonth()).toBe(7);
    expect(shown.getDate()).toBe(18);
    expect(formatIsoDate(toUtcCalendarDate(shown))).toBe("2026-08-18");
  });
});

describe("priceDeltaLabel", () => {
  it("labels non-lowest quotes with the concrete dollar gap", () => {
    expect(priceDeltaLabel(36000, 34500)).toBe("+$1,500 vs lowest");
    expect(priceDeltaLabel(44000, 34500)).toBe("+$9,500 vs lowest");
  });

  it("is silent for the lowest quote itself", () => {
    // The "Lowest price" chip already marks it; a "+$0" line would be noise.
    expect(priceDeltaLabel(34500, 34500)).toBeNull();
    expect(priceDeltaLabel(30000, 34500)).toBeNull();
  });
});

describe("hostOf", () => {
  it("shows where a proposal link goes before the click", () => {
    expect(hostOf("https://docs.google.com/document/d/abc")).toBe("docs.google.com");
    expect(hostOf("https://www.notion.so/firm/sow")).toBe("notion.so");
  });

  it("never crashes a view on a value that does not parse", () => {
    expect(hostOf("not a url")).toBe("");
    expect(hostOf("")).toBe("");
  });
});

describe("isOutsideWindow", () => {
  it("flags starts after the needed-by date", () => {
    expect(isOutsideWindow("2026-08-19", "2026-08-17")).toBe(true);
  });

  it("keeps the boundary day itself inside", () => {
    // Starting ON the needed-by date still meets it (the shipped table's
    // strict-greater semantics, now shared by all three views).
    expect(isOutsideWindow("2026-08-17", "2026-08-17")).toBe(false);
    expect(isOutsideWindow("2026-08-10", "2026-08-17")).toBe(false);
  });

  it("never fires without a needed-by date", () => {
    expect(isOutsideWindow("2026-08-19", null)).toBe(false);
    expect(isOutsideWindow("2026-08-19", undefined)).toBe(false);
  });
});
