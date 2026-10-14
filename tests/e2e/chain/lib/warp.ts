// deliverWithRetry: one Warp delivery from the Console, retried until the chain shows that it landed.
//
// Right after a P-Chain tx, Glacier can aggregate a signature over a stale validator set, and the delivery reverts
// (quick-l1 needs up to 4 attempts: src/steps/initValidatorSet.ts). The Console keeps the signature it aggregated
// and reuses it on the next click of the deliver button (InitValidatorSet.tsx). So each attempt clicks
// 'Aggregate Signatures' again, then the deliver button. A reverted delivery changes no state, so a retry is safe.
//
// Before each attempt it reads the chain and stops when the action landed: a slow receipt of an earlier attempt can
// have delivered it already, and a second delivery would revert or, worse, act twice.

import { isRateLimited, sleep } from './chain.ts';

export interface DeliverOptions {
  /** Names the delivery in logs and errors, for example 'Initialize Validator Set'. */
  label: string;
  /** Reads the chain: true when the action landed (for example isValidatorSetInitialized). */
  landed: () => Promise<boolean>;
  /** Clicks 'Aggregate Signatures' and waits until the page shows the new signature. Omit when the page has none. */
  aggregate?: (attempt: number) => Promise<void>;
  /** Clicks the deliver button and waits until the page shows that the tx finished, with success or an error. */
  deliver: (attempt: number) => Promise<void>;
  /** Default 4. */
  attempts?: number;
  /** The wait between attempts. Default 15 s. */
  intervalMs?: number;
  /** Default console.log. The output goes to the report, where the framework masks secrets. */
  log?: (message: string) => void;
}

export interface DeliverResult {
  /** The attempts that clicked. 0 when the action had landed before the first one. */
  attempts: number;
  /** One message per attempt that failed in the page or did not land. */
  errors: string[];
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0];

/**
 * Runs up to `attempts` deliveries, `intervalMs` apart, and returns as soon as `landed()` is true. After the last
 * attempt it waits one more interval for the chain. Throws when the action never landed. A RateLimitedError from
 * any callback stops it at once.
 */
export async function deliverWithRetry(options: DeliverOptions): Promise<DeliverResult> {
  const { label, landed, aggregate, deliver, attempts = 4, intervalMs = 15_000, log = console.log } = options;
  const errors: string[] = [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await sleep(intervalMs);
    if (await landed()) {
      log(`${label}: landed${attempt > 1 ? ` after attempt ${attempt - 1}` : ' before the first attempt'}.`);
      return { attempts: attempt - 1, errors };
    }
    log(`${label}: attempt ${attempt} of ${attempts}.`);
    try {
      if (aggregate) await aggregate(attempt);
      await deliver(attempt);
    } catch (error) {
      if (isRateLimited(error)) throw error;
      errors.push(`attempt ${attempt}: ${message(error)}`);
      log(`${label}: attempt ${attempt} failed: ${message(error)}`);
      continue;
    }
    if (await landed()) {
      log(`${label}: landed on attempt ${attempt}.`);
      return { attempts: attempt, errors };
    }
    errors.push(`attempt ${attempt}: the page finished, but the chain does not show the result`);
  }

  // A tx of the last attempt can still be in the mempool.
  await sleep(intervalMs);
  if (await landed()) {
    log(`${label}: landed after attempt ${attempts}.`);
    return { attempts, errors };
  }
  throw new Error(`${label} did not land after ${attempts} attempts.\n${errors.join('\n')}`);
}
