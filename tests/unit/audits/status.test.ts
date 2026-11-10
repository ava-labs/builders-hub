import { describe, it, expect } from "vitest";
import {
  decisionDeadline,
  deriveRequestStatus,
  deriveQuoteDisplayStatus,
  endOfUtcDay,
  formatUtcDeadline,
  formatUtcTime,
  isAcceptanceOpen,
  isAdminDeletable,
  isQuoteWindowOpen,
  oldestAcceptableQuoteDeadline,
  STORED_REQUEST_STATUSES,
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

// A window that closes after the release grace: its pick-by date is a week later.
const CLOSED = new Date("2026-11-10T12:00:00Z");
const PICK_BY = new Date("2026-11-17T12:00:00Z");
const JUST_AFTER_PICK_BY = new Date("2026-11-17T12:00:00.001Z");
// A window that closed before 2026-10-23: its week counts from that day.
const CLOSED_EARLY = new Date("2026-08-05T12:00:00Z");
const GRACE_END = new Date("2026-10-30T00:00:00Z");
const JUST_AFTER_GRACE = new Date("2026-10-30T00:00:00.001Z");

describe("decisionDeadline", () => {
  it("is a week after the quote deadline once the window closes after the limit start", () => {
    expect(decisionDeadline(CLOSED)).toEqual(PICK_BY);
  });

  it("counts the week from 2026-10-23 for a window that closed before it", () => {
    expect(decisionDeadline(CLOSED_EARLY)).toEqual(GRACE_END);
    expect(decisionDeadline(new Date("2026-10-23T00:00:00Z"))).toEqual(GRACE_END);
  });
});

// A quote window closes at 23:59 UTC on its date (2026-10-20, call T2).
const END_OF_29TH = new Date("2026-10-29T23:59:59.999Z");

describe("endOfUtcDay", () => {
  it("moves any moment of a UTC day to that day's last millisecond", () => {
    for (const moment of ["2026-10-29T00:00:00.000Z", "2026-10-29T14:37:12.345Z", "2026-10-29T23:59:59.999Z"]) {
      expect(endOfUtcDay(new Date(moment)), moment).toEqual(END_OF_29TH);
    }
  });

  it("is idempotent", () => {
    expect(endOfUtcDay(endOfUtcDay(new Date("2026-10-29T08:00:00Z")))).toEqual(END_OF_29TH);
  });

  it("keeps the year a project typed, even one Date.UTC would read as 19xx", () => {
    expect(endOfUtcDay(new Date("0050-06-01T12:00:00Z")).toISOString()).toBe("0050-06-01T23:59:59.999Z");
  });
});

describe("the UTC deadline label", () => {
  it("prints the stored instant, so a row the update missed shows its real time", () => {
    expect(formatUtcDeadline(END_OF_29TH)).toBe("2026-10-29 23:59 UTC");
    expect(formatUtcDeadline(new Date("2026-10-29T00:00:00Z"))).toBe("2026-10-29 00:00 UTC");
    expect(formatUtcTime(END_OF_29TH)).toBe("23:59");
  });
});

describe("deriveRequestStatus · decision window", () => {
  const row = { status: "collecting", quote_deadline: CLOSED };

  it("stays deciding through the pick-by instant", () => {
    expect(deriveRequestStatus(row, 2, PICK_BY)).toBe("deciding");
  });

  it("reads expired once the pick-by date passes with no quote accepted", () => {
    expect(deriveRequestStatus(row, 2, JUST_AFTER_PICK_BY)).toBe("expired");
  });

  it("still expires a window without quotes the moment it closes", () => {
    expect(deriveRequestStatus(row, 0, new Date("2026-11-10T12:00:00.001Z"))).toBe("expired");
  });

  it("keeps a window that closed before the limit start deciding until 2026-10-30", () => {
    const early = { status: "collecting", quote_deadline: CLOSED_EARLY };
    expect(deriveRequestStatus(early, 1, GRACE_END)).toBe("deciding");
    expect(deriveRequestStatus(early, 1, JUST_AFTER_GRACE)).toBe("expired");
  });
});

describe("isAcceptanceOpen", () => {
  const collecting = { status: "collecting", quote_deadline: CLOSED };

  it("allows an early pick while quotes are still open", () => {
    expect(isAcceptanceOpen(collecting, new Date("2026-11-01T00:00:00Z"))).toBe(true);
  });

  it("allows a pick through the pick-by instant and not after it", () => {
    expect(isAcceptanceOpen(collecting, PICK_BY)).toBe(true);
    expect(isAcceptanceOpen(collecting, JUST_AFTER_PICK_BY)).toBe(false);
  });

  it("stays open defensively without a deadline", () => {
    expect(
      isAcceptanceOpen({ status: "collecting", quote_deadline: null }, new Date("2027-01-01T00:00:00Z")),
    ).toBe(true);
  });

  it("is closed for every stored status but collecting", () => {
    for (const status of ["draft", "pending_review", "rejected", "engaged", "withdrawn"]) {
      expect(
        isAcceptanceOpen({ status, quote_deadline: CLOSED }, new Date("2026-11-01T00:00:00Z")),
      ).toBe(false);
    }
  });
});

describe("oldestAcceptableQuoteDeadline", () => {
  it("is null while the release grace still holds every decision window open", () => {
    expect(oldestAcceptableQuoteDeadline(new Date("2026-10-29T12:00:00Z"))).toBeNull();
    expect(oldestAcceptableQuoteDeadline(GRACE_END)).toBeNull();
  });

  it("is a week before now once the grace is over", () => {
    expect(oldestAcceptableQuoteDeadline(new Date("2026-12-01T12:00:00Z"))).toEqual(
      new Date("2026-11-24T12:00:00Z"),
    );
  });

  // The acceptance write uses this where-clause form of isAcceptanceOpen; the
  // two must agree on both sides of every boundary or a screen offers an
  // accept the server refuses (or the reverse).
  it("agrees with isAcceptanceOpen on both sides of every boundary", () => {
    const nows = [
      "2026-10-20T00:00:00Z",
      "2026-10-30T00:00:00Z",
      "2026-10-30T00:00:00.001Z",
      "2026-11-17T12:00:00Z",
      "2026-11-17T12:00:00.001Z",
      "2026-12-01T12:00:00Z",
    ];
    const deadlines = [
      "2026-08-05T12:00:00Z",
      "2026-10-23T00:00:00Z",
      "2026-11-10T12:00:00Z",
      "2026-11-24T12:00:00Z",
      "2026-12-20T00:00:00Z",
    ];
    for (const nowIso of nows) {
      const now = new Date(nowIso);
      const oldest = oldestAcceptableQuoteDeadline(now);
      for (const deadlineIso of deadlines) {
        const quote_deadline = new Date(deadlineIso);
        const whereMatches = oldest === null || quote_deadline >= oldest;
        expect(whereMatches, `deadline ${deadlineIso} at ${nowIso}`).toBe(
          isAcceptanceOpen({ status: "collecting", quote_deadline }, now),
        );
      }
    }
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

describe("isAdminDeletable", () => {
  it("lets an admin delete every submitted request but an engaged one", () => {
    expect(STORED_REQUEST_STATUSES.filter(isAdminDeletable)).toEqual([
      "pending_review",
      "rejected",
      "collecting",
      "withdrawn",
    ]);
  });
});
