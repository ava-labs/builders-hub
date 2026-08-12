/**
 * Retry policy for BLS signature aggregation calls.
 *
 * Below-quorum failures are usually transient: right after a P-Chain
 * transaction, some validators' own P-Chain replicas have not seen it yet
 * and refuse to sign, so the aggregate lands under the 67% threshold and
 * heals by itself within seconds to minutes. A bounded retry turns most of
 * those "failures" into successes. Malformed requests never retry.
 *
 * Permanent quorum shortfalls (offline legacy Subnet validators still in
 * the signing set) look identical per attempt: those exhaust the retries
 * and surface through parseAggregationError with remediation links.
 */

export type AggErrorKind = 'below-quorum' | 'transient' | 'invalid-request' | 'unknown';

export interface AggregationErrorClass {
  kind: AggErrorKind;
  retryable: boolean;
  /** Share of stake that actually signed, when the error message carries it. */
  achievedPercent?: number;
}

const DEFAULT_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [5000, 10000, 20000];

function extractStatusCode(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const candidate = (err as { statusCode?: unknown }).statusCode ?? (err as { status?: unknown }).status;
    if (typeof candidate === 'number') return candidate;
  }
  return null;
}

export function classifyAggregationError(err: unknown): AggregationErrorClass {
  const message = err instanceof Error ? err.message : String(err);

  // The aggregator's below-quorum shapes: icm-services' "failed to connect
  // to a threshold of stake" and the P-Chain's "signature weight is
  // insufficient: 67*<total> > 100*<signed>".
  if (/threshold of stake/i.test(message) || /signature weight is insufficient/i.test(message)) {
    const match = message.match(/(\d+)\s*\*\s*(\d+)\s*>\s*100\s*\*\s*(\d+)/);
    let achievedPercent: number | undefined;
    if (match) {
      const total = Number(match[2]);
      const signed = Number(match[3]);
      if (total > 0) achievedPercent = Math.round((signed / total) * 1000) / 10;
    }
    return { kind: 'below-quorum', retryable: true, achievedPercent };
  }

  // Our own per-attempt timeout races the SDK call but cannot cancel it, so
  // the request may still be in flight. Retrying would stack concurrent
  // aggregations against the service: transient, but never retried.
  if (/signature aggregation attempt timed out/i.test(message)) {
    return { kind: 'transient', retryable: false };
  }

  const statusCode = extractStatusCode(err);
  if (statusCode !== null) {
    if (statusCode >= 500 || statusCode === 408 || statusCode === 429) {
      return { kind: 'transient', retryable: true };
    }
    if (statusCode >= 400) return { kind: 'invalid-request', retryable: false };
  }

  // These shapes mean the request itself terminated, so a retry cannot
  // stack a duplicate in-flight call.
  if (/failed to fetch|fetch failed|network|timed out|timeout|aborted|econnreset|socket/i.test(message)) {
    return { kind: 'transient', retryable: true };
  }

  return { kind: 'unknown', retryable: false };
}

export async function aggregateWithRetry<T>(
  run: () => Promise<T>,
  opts: {
    attempts?: number;
    delaysMs?: number[];
    /** Fires before each retry with the upcoming attempt number and the error that caused it. */
    onAttempt?: (attempt: number, maxAttempts: number, lastError: unknown) => void;
    /** Injectable for tests. */
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const {
    attempts = DEFAULT_ATTEMPTS,
    delaysMs = RETRY_DELAYS_MS,
    onAttempt,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = opts;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) onAttempt?.(attempt, attempts, lastError);
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (!classifyAggregationError(err).retryable || attempt === attempts) throw err;
      await sleep(delaysMs[Math.min(attempt - 1, delaysMs.length - 1)]);
    }
  }
  throw lastError;
}
