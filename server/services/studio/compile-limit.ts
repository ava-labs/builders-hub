import 'server-only';
import { compileSources } from '@/lib/studio/compile';
import { acquireCompileSlot, consumeQuota } from '@/lib/verification/limits';
import { StudioError } from './errors';

/*
 * A compile forks the compiler for up to three minutes. The contract verifier
 * bounds that work with a quota for each caller and a count of compiles that
 * run at once (lib/verification/limits.ts). A Studio compile takes one of the
 * same slots, and each builder has a quota of their own.
 */

const COMPILE_QUOTA = { limit: 30, windowMs: 10 * 60 * 1000 };
const SLOT_WAIT_MS = 20_000;
const SLOT_POLL_MS = 1_000;

async function waitForCompileSlot() {
  const deadline = Date.now() + SLOT_WAIT_MS;
  for (;;) {
    const slot = await acquireCompileSlot();
    if (slot) return slot;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, SLOT_POLL_MS));
  }
}

/** Compiles a builder's sources, counted against that builder's quota and the compiles that run at once. */
export async function compileForBuilder(userId: string, entries: Record<string, string>) {
  const quota = await consumeQuota(`studio-compile:${userId}`, COMPILE_QUOTA);
  if (!quota.allowed) {
    throw new StudioError(429, `Too many builds. Try again in ${quota.retryAfterSeconds} seconds.`, 'quota_builds');
  }
  const slot = await waitForCompileSlot();
  if (!slot) throw new StudioError(503, 'The compiler is busy. Try again in a moment.', 'compiler_busy');
  try {
    return await compileSources(entries);
  } finally {
    await slot.release();
  }
}
