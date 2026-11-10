import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {} }) }));

import { deleteWarning } from "@/components/audits/admin/DeleteRequest";

/** The admin's double check names what goes and says nothing brings it back. */
describe("deleteWarning", () => {
  it("names the quotes and the firms a collecting request takes with it", () => {
    expect(deleteWarning(8, 9)).toBe(
      "This deletes the request, its 8 quotes and its activity trail. The 9 firms that received it will no longer see it. This can't be undone.",
    );
  });

  it("speaks of one quote and one firm in the singular", () => {
    expect(deleteWarning(1, 1)).toBe(
      "This deletes the request, its 1 quote and its activity trail. The firm that received it will no longer see it. This can't be undone.",
    );
  });

  it("leaves the firms out while no firm has received the request", () => {
    expect(deleteWarning(0, 0)).toBe(
      "This deletes the request and its activity trail. This can't be undone.",
    );
  });

  it("always ends on the request being gone for good", () => {
    for (const [quotes, firms] of [
      [0, 0],
      [0, 4],
      [3, 4],
    ]) {
      expect(deleteWarning(quotes, firms)).toMatch(/This can't be undone\.$/);
    }
  });
});
