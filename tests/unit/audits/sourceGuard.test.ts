import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The structural half of "competitors' quotes are provably not queryable":
 * every READ of AuditQuote must live in visibility.ts (whose auditor scope
 * pins auditor_id unconditionally), and WRITES are enumerated. Any future
 * bypass, a route or service touching prisma.auditQuote directly, fails this
 * suite before it can ship.
 */
const ROOTS = ["server/services/audits", "app/api/audits"];
const READ_RE = /auditQuote\s*\.\s*(findMany|findFirst|findUnique|count|aggregate|groupBy)/;
const WRITE_RE = /auditQuote\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)/;
const READ_ALLOWLIST = new Set(["server/services/audits/visibility.ts"]);
const WRITE_ALLOWLIST = new Set([
  "server/services/audits/quotes.ts",
  "server/services/audits/acceptance.ts",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("AuditQuote source guard", () => {
  const files = ROOTS.flatMap((root) => walk(join(process.cwd(), root))).map((path) =>
    relative(process.cwd(), path),
  );

  it("scans a non-trivial audit source tree", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("only visibility.ts reads AuditQuote", () => {
    const offenders = files.filter(
      (file) => !READ_ALLOWLIST.has(file) && READ_RE.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("only the enumerated writers touch AuditQuote", () => {
    const offenders = files.filter(
      (file) => !WRITE_ALLOWLIST.has(file) && WRITE_RE.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});