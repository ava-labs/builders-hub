import { describe, it, expect } from "vitest";
import { deriveStatus } from "@/lib/grants/status";

describe("deriveStatus", () => {
  it("approves on a top/strong final verdict", () => {
    expect(deriveStatus("top", 3)).toBe("approved");
    expect(deriveStatus("strong", 1)).toBe("approved");
  });
  it("rejects on a weak/reject final verdict", () => {
    expect(deriveStatus("weak", 3)).toBe("rejected");
    expect(deriveStatus("reject", 1)).toBe("rejected");
  });
  it("stays under_review on 'maybe' or no verdict once evaluated", () => {
    expect(deriveStatus("maybe", 2)).toBe("under_review");
    expect(deriveStatus(null, 2)).toBe("under_review");
  });
  it("is submitted with no verdict and no evaluations", () => {
    expect(deriveStatus(null, 0)).toBe("submitted");
  });
});
