/**
 * Applies pending Prisma migrations in the Vercel build, before next build.
 *
 * - Not a Vercel build (local `yarn build`): does nothing.
 * - Production: needs DATABASE_URL_UNPOOLED (the direct Neon URL, not the pooler).
 *   Without it the build fails, so new code never ships before its schema.
 * - Preview: migrates only when DATABASE_URL_UNPOOLED is set. The Neon Vercel
 *   integration sets it to the preview's own Neon branch. Never set it by hand for
 *   Preview: then every PR would migrate one shared database.
 * - A pending migration with a destructive statement stops the build, unless the
 *   file has the line `-- destructive: approved` (see scripts/lib/migration-guard.mjs).
 *
 * Every migration must work with the deployment that is live during the build.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { destructiveStatement, pendingMigrations } from './lib/migration-guard.mjs';

const MIGRATIONS_DIR = path.join('prisma', 'migrations');
const log = (message) => console.log(`[migrate] ${message}`);
function fail(message) {
  console.error(`[migrate] ${message}`);
  process.exit(1);
}

const target = process.env.VERCEL_ENV;
if (!process.env.VERCEL) {
  log('Not a Vercel build. Skipped.');
  process.exit(0);
}

const direct = process.env.DATABASE_URL_UNPOOLED;
if (!direct) {
  if (target === 'production') {
    fail('DATABASE_URL_UNPOOLED is not set for Production. Set it to the direct (non-pooler) Neon URL.');
  }
  log(`No DATABASE_URL_UNPOOLED in ${target}: this deployment has no Neon branch of its own. Skipped.`);
  process.exit(0);
}

// A Neon branch that scaled to zero wakes on the first connection.
const url = new URL(direct);
if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');

const folders = fs
  .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const prisma = new PrismaClient({ datasourceUrl: url.toString() });
let applied;
try {
  const rows = await prisma.$queryRaw`
    SELECT migration_name FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  applied = rows.map((row) => row.migration_name);
} catch (error) {
  const noTable = /_prisma_migrations.*does not exist|42P01/s.test(String(error.message));
  fail(
    noTable
      ? 'The database has no _prisma_migrations table. Baseline it first (AGENTS.md, "Database migrations").'
      : `Cannot read _prisma_migrations: ${error.message}`,
  );
} finally {
  await prisma.$disconnect();
}

const pending = pendingMigrations(folders, applied);
if (pending.length === 0) {
  log(`${target}: no pending migrations.`);
  process.exit(0);
}

for (const name of pending) {
  const statement = destructiveStatement(fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'));
  if (statement) {
    fail(`${name} has "${statement}". It can break the live deployment. Split it, or add "-- destructive: approved".`);
  }
}

log(`${target}: applying ${pending.length} migration(s): ${pending.join(', ')}`);
const result = spawnSync(path.join('node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL_UNPOOLED: url.toString() },
});
process.exit(result.status ?? 1);
