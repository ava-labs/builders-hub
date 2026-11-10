import { describe, expect, it } from "vitest";
import { bucketOf, countAwaiting } from "@/components/audits/portal/inboxBuckets";

// An own quote as visibility.ts hands it out: the derived status matches the
// stored one unless the request moved on (a lapsed quote reads expired).
const quote = (status: string, display_status = status) => ({ status, display_status });

describe("bucketOf", () => {
  it("an open window with no own quote is awaiting", () => {
    expect(bucketOf({ window_open: true, own_quote: null })).toBe("awaiting");
  });

  it("a submitted quote while the window is open is quoted", () => {
    expect(bucketOf({ window_open: true, own_quote: quote("submitted") })).toBe("quoted");
  });

  it("an accepted quote is won whether or not the window is still open", () => {
    expect(bucketOf({ window_open: true, own_quote: quote("accepted") })).toBe("won");
    expect(bucketOf({ window_open: false, own_quote: quote("accepted") })).toBe("won");
  });

  it("a submitted quote stays quoted past the window while it can still be picked", () => {
    expect(bucketOf({ window_open: false, own_quote: quote("submitted") })).toBe("quoted");
  });

  it("a closed window with no quote, or a not-selected quote, is closed", () => {
    expect(bucketOf({ window_open: false, own_quote: null })).toBe("closed");
    expect(bucketOf({ window_open: true, own_quote: quote("not_selected") })).toBe("closed");
  });

  it("an unpicked quote that expired is closed, though still stored submitted", () => {
    const lapsed = { window_open: false, own_quote: quote("submitted", "expired") };
    expect(bucketOf(lapsed)).toBe("closed");
  });
});

describe("countAwaiting", () => {
  it("counts only the items still awaiting this firm's quote", () => {
    const items = [
      { window_open: true, own_quote: null },
      { window_open: true, own_quote: null },
      { window_open: true, own_quote: quote("submitted") },
      { window_open: false, own_quote: null },
      { window_open: true, own_quote: quote("accepted") },
    ];
    expect(countAwaiting(items)).toBe(2);
  });

  it("is 0 for an empty inbox", () => {
    expect(countAwaiting([])).toBe(0);
  });
});
