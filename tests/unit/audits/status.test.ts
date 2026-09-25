import { describe, it, expect } from "vitest";
import {
  deriveRequestStatus,
  deriveQuoteDisplayStatus,
  isQuoteWindowOpen,
} from "@/lib/audits/status";

const NOW = new Date("2026-08-10T12:00:00Z");
const FUTURE = new Date("2026-08-15T12:00:00Z");
const PAST = new Date("2026-08-05T12:00:00Z");

describe("deriveRequestStatus", () => {
  it("passes stored terminal and pre-submit statuses through untouched", () => {
    for (const status of ["draft", "engaged", "withdrawn"] as const) {
      expect(deriveRequestStatus({ status, quote_deadline: PAST }, 0, NOW)).toBe(status);
      expect(deriveRequestStatus({ status, quote_deadline: null }, 5, NOW)).toBe(status);
    }
  });

  it("stays collecting while the deadline is ahead", () => {
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: FUTURE }, 0, NOW),
    ).toBe("collecting");
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: FUTURE }, 3, NOW),
    ).toBe("collecting");
  });

  it("stays collecting at the exact deadline instant", () => {
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: NOW }, 2, NOW),
    ).toBe("collecting");
  });

  it("becomes deciding past the deadline when at least one quote exists", () => {
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: PAST }, 1, NOW),
    ).toBe("deciding");
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: PAST }, 7, NOW),
    ).toBe("deciding");
  });

  it("becomes expired past the deadline with zero quotes", () => {
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: PAST }, 0, NOW),
    ).toBe("expired");
  });

  it("treats a missing deadline as still collecting", () => {
    expect(
      deriveRequestStatus({ status: "collecting", quote_deadline: null }, 0, NOW),
    ).toBe("collecting");
  });
});

describe("deriveQuoteDisplayStatus", () => {
  it("passes non-submitted stored statuses through untouched", () => {
    for (const status of ["accepted", "not_selected", "withdrawn"] as const) {
      expect(deriveQuoteDisplayStatus(status, "expired")).toBe(status);
      expect(deriveQuoteDisplayStatus(status, "collecting")).toBe(status);
    }
  });

  it("displays a submitted quote as expired once its request is terminal", () => {
    expect(deriveQuoteDisplayStatus("submitted", "expired")).toBe("expired");
    expect(deriveQuoteDisplayStatus("submitted", "withdrawn")).toBe("expired");
  });

  it("keeps a submitted quote submitted while the request is live", () => {
    expect(deriveQuoteDisplayStatus("submitted", "collecting")).toBe("submitted");
    expect(deriveQuoteDisplayStatus("submitted", "deciding")).toBe("submitted");
    expect(deriveQuoteDisplayStatus("submitted", "engaged")).toBe("submitted");
  });
});

describe("isQuoteWindowOpen", () => {
  it("is open while collecting with the deadline ahead or at this instant", () => {
    expect(isQuoteWindowOpen({ status: "collecting", quote_deadline: FUTURE }, NOW)).toBe(true);
    expect(isQuoteWindowOpen({ status: "collecting", quote_deadline: NOW }, NOW)).toBe(true);
  });

  it("closes past the deadline", () => {
    expect(isQuoteWindowOpen({ status: "collecting", quote_deadline: PAST }, NOW)).toBe(false);
  });

  it("is closed for any non-collecting stored status", () => {
    for (const status of ["draft", "engaged", "withdrawn"] as const) {
      expect(isQuoteWindowOpen({ status, quote_deadline: FUTURE }, NOW)).toBe(false);
    }
  });

  it("stays open defensively while collecting without a deadline", () => {
    expect(isQuoteWindowOpen({ status: "collecting", quote_deadline: null }, NOW)).toBe(true);
  });
});
