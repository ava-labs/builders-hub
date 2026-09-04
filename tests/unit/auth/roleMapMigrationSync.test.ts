import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '@/lib/auth/rolePermissions';

/**
 * The UserRole migration ends with a cleanup DELETE whose allow-list must
 * mirror ROLE_PERMISSIONS. It is a hand-maintained duplication, and it has
 * already drifted once: `team1_event_admin` and `notify_all` were in the map
 * but missing from the SQL, so the migration would have deleted those rows and
 * silently stripped the roles from every user holding them.
 */
const MIGRATION = join(
  process.cwd(),
  'prisma/migrations/20260525000000_add_user_role_table/migration.sql',
);

function sqlAllowList(): Set<string> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const deleteStmt = sql.split('DELETE FROM "UserRole"').pop() ?? '';
  return new Set([...deleteStmt.matchAll(/'([A-Za-z0-9_-]+)'/g)].map((m) => m[1]));
}

describe('migration cleanup allow-list vs ROLE_PERMISSIONS', () => {
  it('deletes no role that the app actually grants', () => {
    const allow = sqlAllowList();
    const missing = Object.keys(ROLE_PERMISSIONS).filter((r) => !allow.has(r));
    expect(missing, `roles in ROLE_PERMISSIONS but absent from the migration's
allow-list — the migration would DELETE these rows and revoke the role from
every user holding it`).toEqual([]);
  });

  it('allows no role the app does not define', () => {
    const allow = [...sqlAllowList()];
    const unknown = allow.filter((r) => !Object.hasOwn(ROLE_PERMISSIONS, r));
    expect(unknown, `roles kept by the migration that grant nothing — either add
them to ROLE_PERMISSIONS or drop them from the allow-list`).toEqual([]);
  });

  it('has no prefix escape hatch that would preserve retired team1 tags', () => {
    // The consolidation folds Team1-Leader/team1-leader → team1_lead and
    // Team1-member/T1-Technical/... → team1. A `LIKE 'team1%'` clause in the
    // DELETE would keep the retired rows alive and undo that.
    const sql = readFileSync(MIGRATION, 'utf8');
    const deleteStmt = sql.split('DELETE FROM "UserRole"').pop() ?? '';
    expect(deleteStmt).not.toMatch(/LIKE\s+'team1%'/i);
  });

  it('folds every legacy team1 tag into a role the map defines', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    // Legacy tags enumerated by the 20260505 migration as present in production.
    for (const legacy of [
      'Team1-Leader', 'team1-leader',
      'Team1-member', 'team1-member',
      'T1-Technical', 't1-technical',
      // hyphenated names this branch introduced, now renamed to underscores
      'team1-admin', 'team1-event-admin',
    ]) {
      expect(sql, `legacy tag ${legacy} is neither remapped nor accounted for`)
        .toContain(`'${legacy}'`);
    }
    expect(ROLE_PERMISSIONS['team1_lead']).toBeDefined();
    expect(ROLE_PERMISSIONS['team1']).toBeDefined();
  });
});
