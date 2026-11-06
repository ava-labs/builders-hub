/**
 * Pure checks for scripts/migrate.mjs. No I/O, so the unit tests import them directly.
 */

/** The line that lets a migration with a destructive statement run in a build. */
export const APPROVAL_MARKER = '-- destructive: approved';

/**
 * Statements that can break the deployment that is live while the build runs:
 * it still reads the old table, column or type. Write these in a later PR
 * (expand, then contract), or approve them with APPROVAL_MARKER.
 */
const DESTRUCTIVE = [
  /\bDROP\s+(TABLE|COLUMN|SCHEMA|TYPE)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i,
  /\bRENAME\s+(COLUMN|TO)\b/i,
];

/**
 * Migration folder names that the database has not applied, in folder order.
 * `applied` holds the names of finished, not rolled back rows of _prisma_migrations.
 */
export function pendingMigrations(folders, applied) {
  const done = new Set(applied);
  return [...folders].sort().filter((name) => !done.has(name));
}

/** The first destructive statement in `sql`, or null. SQL comments do not count. */
export function destructiveStatement(sql) {
  const lines = sql.split('\n');
  if (lines.some((line) => line.trim().toLowerCase() === APPROVAL_MARKER)) return null;
  const code = lines.map((line) => line.replace(/--.*$/, '')).join('\n');
  for (const pattern of DESTRUCTIVE) {
    const match = code.match(pattern);
    if (match) return match[0].replace(/\s+/g, ' ').toUpperCase();
  }
  return null;
}
