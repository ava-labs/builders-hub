import { describe, expect, it } from "vitest";
import { activeRoleWhere, revokerForClose } from "@/lib/auth/permissions";

/**
 * UserRole keeps history: revoked and expired rows stay in the table. Every
 * read of a user's roles goes through activeRoleWhere(), so this is the single
 * place the "still in force" rule is pinned. A query that drops `revoked_at`
 * hands out roles an admin already took away — the failure this guards.
 */
describe("activeRoleWhere", () => {
  const NOW = new Date("2026-09-05T12:00:00.000Z");

  /** Mirrors what Postgres would do with the generated where clause. */
  function matches(
    row: { expires_at: Date | null; revoked_at: Date | null },
    now = NOW,
  ): boolean {
    const where = activeRoleWhere(now);
    if (row.revoked_at !== where.revoked_at) return false;
    const [never, future] = where.OR as [
      { expires_at: null },
      { expires_at: { gt: Date } },
    ];
    return (
      row.expires_at === never.expires_at ||
      (row.expires_at !== null && row.expires_at > future.expires_at.gt)
    );
  }

  it("keeps an open grant with no expiry", () => {
    expect(matches({ expires_at: null, revoked_at: null })).toBe(true);
  });

  it("keeps an open grant that has not expired yet", () => {
    expect(matches({ expires_at: new Date("2026-12-01"), revoked_at: null })).toBe(true);
  });

  it("drops a grant whose expiry has passed", () => {
    expect(matches({ expires_at: new Date("2026-01-01"), revoked_at: null })).toBe(false);
  });

  it("drops a revoked grant even when its expiry is still in the future", () => {
    expect(
      matches({ expires_at: new Date("2026-12-01"), revoked_at: new Date("2026-09-04") }),
    ).toBe(false);
  });

  it("drops a revoked grant that never had an expiry", () => {
    expect(matches({ expires_at: null, revoked_at: new Date("2026-09-04") })).toBe(false);
  });

  it("evaluates the expiry cutoff per call, not once at import", () => {
    const early = activeRoleWhere(new Date("2026-01-01")).OR as [unknown, { expires_at: { gt: Date } }];
    const late = activeRoleWhere(new Date("2026-12-31")).OR as [unknown, { expires_at: { gt: Date } }];
    expect(early[1].expires_at.gt).not.toEqual(late[1].expires_at.gt);
  });
});

/**
 * Re-granting a role that had lapsed must not be recorded as a revocation by
 * the admin doing the re-grant — the reported bug.
 */
describe("revokerForClose", () => {
  const NOW = new Date("2026-09-05T12:00:00.000Z");
  const ADMIN = "admin-1";

  it("blames nobody when the episode had already expired", () => {
    expect(revokerForClose({ expires_at: new Date("2026-09-04") }, ADMIN, NOW)).toBeNull();
  });

  it("blames nobody when the expiry is exactly now", () => {
    expect(revokerForClose({ expires_at: NOW }, ADMIN, NOW)).toBeNull();
  });

  it("records the admin when the episode was still in force", () => {
    expect(revokerForClose({ expires_at: new Date("2026-12-01") }, ADMIN, NOW)).toBe(ADMIN);
  });

  it("records the admin when the episode had no expiry at all", () => {
    expect(revokerForClose({ expires_at: null }, ADMIN, NOW)).toBe(ADMIN);
  });
});
