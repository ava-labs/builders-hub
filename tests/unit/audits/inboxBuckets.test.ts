import { describe, expect, it } from "vitest";
import { bucketOf, countAwaiting } from "@/components/audits/portal/inboxBuckets";

describe("bucketOf", () => {
  it("an open window with no own quote is awaiting", () => {
    expect(bucketOf({ window_open: true, own_quote: null })).toBe("awaiting");
  });

  it("a submitted quote while the window is open is quoted", () => {
    expect(bucketOf({ window_open: true, own_quote: { status: "submitted" } })).toBe("quoted");
  });

  it("an accepted quote is won whether or not the window is still open", () => {
    expect(bucketOf({ window_open: true, own_quote: { status: "accepted" } })).toBe("won");
    expect(bucketOf({ window_open: false, own_quote: { status: "accepted" } })).toBe("won");
  });

  it("a submitted quote after the window closed stays quoted", () => {
    expect(bucketOf({ window_open: false, own_quote: { status: "submitted" } })).toBe("quoted");
  });

  it("a closed window with no quote, or a not-selected quote, is closed", () => {
    expect(bucketOf({ window_open: false, own_quote: null })).toBe("closed");
    expect(bucketOf({ window_open: true, own_quote: { status: "not_selected" } })).toBe("closed");
  });
});

describe("countAwaiting", () => {
  it("counts only the items still awaiting this firm's quote", () => {
    const items = [
      { window_open: true, own_quote: null },
      { window_open: true, own_quote: null },
      { window_open: true, own_quote: { status: "submitted" } },
      { window_open: false, own_quote: null },
      { window_open: true, own_quote: { status: "accepted" } },
    ];
    expect(countAwaiting(items)).toBe(2);
  });

  it("is 0 for an empty inbox", () => {
    expect(countAwaiting([])).toBe(0);
  });
});
