import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * S-1 hotfix guard. The four /audits/admin pages must each re-assert the
 * admin role before any read: Next 16 can render a page segment without its
 * ancestor layout when a client sends a crafted next-router-state-tree
 * header, so the layout check is not sufficient on its own. Any admin page
 * that forgets the guard, or a guard that no longer runs the real role check,
 * fails here before it can ship.
 */
const ADMIN_ROOT = "app/(home)/audits/admin";
const GUARD_RE = /denyIfNotAuditAdmin/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith("page.tsx") ? [path] : [];
  });
}

describe("audit admin page gate", () => {
  const pages = walk(join(process.cwd(), ADMIN_ROOT));

  it("scans every admin page (overview, auditors, requests, drilldown)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(4);
  });

  it("every admin page re-asserts the admin role before reading", () => {
    const offenders = pages
      .filter((file) => !GUARD_RE.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it("the guard itself runs the real session and permission check", () => {
    const guard = readFileSync(
      join(process.cwd(), ADMIN_ROOT, "require-admin.tsx"),
      "utf8",
    );
    expect(guard).toContain("getAuthSession");
    expect(guard).toContain("canAdministerAuditProgram");
  });
});
