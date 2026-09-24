import type { Prisma } from '@prisma/client';

/**
 * Transaction-scoped advisory locks.
 *
 * Several limits in this codebase are "read a count, decide, then insert".
 * Under Postgres' default READ COMMITTED isolation both halves of that can run
 * concurrently: two transactions read the same count, both decide they are
 * under the limit, and both insert. The check passes twice and the limit is
 * exceeded once.
 *
 * These limits span tables (a faucet cap keyed on claims-per-user, a
 * one-project-per-hackathon rule spanning Project and Member), so no single
 * unique constraint can express them. An advisory lock keyed on the same
 * identity the limit is about serialises just those transactions and leaves
 * the rest of the workload untouched.
 *
 * The lock is released when the transaction ends, including on rollback, so
 * there is no unlock path to forget.
 */

/**
 * Postgres advisory locks take bigints, so the key is hashed. `hashtext` is
 * stable within a major version, and a collision only means two unrelated
 * operations serialise against each other — a performance cost, never a
 * correctness one.
 */
export async function acquireAdvisoryLock(
  tx: Prisma.TransactionClient,
  ...keyParts: string[]
): Promise<void> {
  // Sorting makes lock order deterministic, so two transactions taking the
  // same pair of locks cannot take them in opposite orders and deadlock.
  const keys = [...new Set(keyParts)].sort();
  for (const key of keys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}
