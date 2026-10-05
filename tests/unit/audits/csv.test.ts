import { describe, expect, it } from "vitest";
import { toCsv } from "@/server/services/audits/csv";

describe("escapeCsv formula-prefix guard (S-15)", () => {
  it("prefixes and quotes a cell starting with =, +, - or @", () => {
    const csv = toCsv(["h"], [["=1+1"], ["+1"], ["-1"], ["@x"], ["ok"]]);
    const rows = csv.trim().split("\n");
    for (const bad of ['"\'=1+1"', '"\'+1"', '"\'-1"', '"\'@x"']) expect(csv).toContain(bad);
    expect(rows[rows.length - 1]).toBe("ok");
  });
});
