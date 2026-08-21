/**
 * ProposerVM epoch staleness primitives.
 *
 * Every block an L1 produces carries an ACP-181 epoch (number, start time,
 * pinned P-Chain height). Warp message delivery verifies signatures against
 * the validator set at the CURRENT epoch's pinned height, and that height
 * only advances when the chain produces blocks: the first block at or past
 * `startTime + D` seals the epoch, and the next block adopts the sealer's
 * embedded height. An idle chain's view therefore stands still while the
 * P-Chain moves on, and deliveries (initializeValidatorSet,
 * completeValidatorRegistration, ...) fail until blocks are produced.
 * Reference: /docs/nodes/architecture/proposervm
 *
 * These helpers only diagnose DELIVERY readiness (the epoch's pinned
 * height). They say nothing about signature AGGREGATION, which depends on
 * each validator's own P-Chain view and the signing set's online quorum.
 */

/** Epoch duration D on both Fuji and Mainnet (ACP-181, Granite activation).
 *  Changing D requires a network upgrade. Used for countdown UX only; the
 *  advance loop's correctness never depends on it. */
export const EPOCH_DURATION_MS = 5 * 60_000;

export interface ProposerVMEpoch {
  number: bigint;
  startTimeSec: number;
  pChainHeight: bigint;
}

export type EpochAdvanceState = 'satisfied' | 'stale-sealable' | 'stale-waiting' | 'unknown';

export interface EpochStatus {
  state: EpochAdvanceState;
  /** Live P-Chain height minus the epoch's pinned height, clamped at zero. */
  heightLag: bigint | null;
  tipAgeSec: number | null;
  /** The moment a new block may seal the current epoch (startTime + D). */
  sealableAtMs: number | null;
}

/**
 * Derive the chain's proposervm API URL from its JSON-RPC URL. Both live on
 * the same host: `/ext/bc/<blockchainID>/rpc` vs `/ext/bc/<blockchainID>/proposervm`.
 * Returns null when the URL does not end in an `rpc` segment; callers treat
 * that as "epoch state unreadable", not as an error.
 */
export function deriveProposerVMUrl(rpcUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch {
    return null;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0 || segments[segments.length - 1] !== 'rpc') return null;
  const swapped = [...segments.slice(0, -1), 'proposervm'];
  return `${url.origin}/${swapped.join('/')}${url.search}`;
}

function toBigIntField(value: unknown, field: string): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`proposervm.getCurrentEpoch: missing ${field}`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(`proposervm.getCurrentEpoch: non-numeric ${field} "${String(value)}"`);
  }
}

function toIntField(value: unknown, field: string): number {
  const parsed = Number(value);
  if (typeof value === 'undefined' || value === null || !Number.isFinite(parsed)) {
    throw new Error(`proposervm.getCurrentEpoch: non-numeric ${field} "${String(value)}"`);
  }
  return parsed;
}

/** avalanchego returns number/startTime/pChainHeight as string-encoded ints. */
export function parseCurrentEpochResponse(body: unknown): ProposerVMEpoch {
  const envelope = body as {
    result?: { number?: unknown; startTime?: unknown; pChainHeight?: unknown };
    error?: { message?: string };
  } | null;
  if (envelope?.error) {
    throw new Error(envelope.error.message || 'proposervm.getCurrentEpoch returned an error');
  }
  const result = envelope?.result;
  if (!result) throw new Error('proposervm.getCurrentEpoch returned no result');
  return {
    number: toBigIntField(result.number, 'number'),
    startTimeSec: toIntField(result.startTime, 'startTime'),
    pChainHeight: toBigIntField(result.pChainHeight, 'pChainHeight'),
  };
}

/** `platform.getHeight` also returns its height as a string-encoded int. */
export function parsePlatformHeightResponse(body: unknown): bigint {
  const envelope = body as { result?: { height?: unknown }; error?: { message?: string } } | null;
  if (envelope?.error) {
    throw new Error(envelope.error.message || 'platform.getHeight returned an error');
  }
  const height = envelope?.result?.height;
  if (typeof height !== 'string' && typeof height !== 'number') {
    throw new Error('platform.getHeight returned no height');
  }
  try {
    return BigInt(height);
  } catch {
    throw new Error(`platform.getHeight returned a non-numeric height "${String(height)}"`);
  }
}

async function postJsonRpc(url: string, method: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${method} request failed with HTTP ${res.status}`);
  return res.json();
}

export async function fetchCurrentEpoch(proposerVMUrl: string, timeoutMs = 8000): Promise<ProposerVMEpoch> {
  return parseCurrentEpochResponse(await postJsonRpc(proposerVMUrl, 'proposervm.getCurrentEpoch', timeoutMs));
}

export async function fetchLivePChainHeight(pChainRpcUrl: string, timeoutMs = 8000): Promise<bigint> {
  return parsePlatformHeightResponse(await postJsonRpc(pChainRpcUrl, 'platform.getHeight', timeoutMs));
}

/**
 * The one decision function.
 *
 * With `requiredHeight` (the P-Chain height a pending warp delivery needs
 * the epoch to cover): satisfied iff the pinned height already covers it;
 * otherwise the chain needs blocks, and the state says whether a block sent
 * now could seal the epoch or the seal moment is still in the future.
 *
 * Without `requiredHeight` (display only): a chain gets one full epoch of
 * grace past its seal moment before it reads as stale, so an actively
 * producing chain never flashes a false warning between D elapsing and the
 * next block landing.
 */
export function computeEpochStatus(input: {
  epoch: ProposerVMEpoch | null;
  liveHeight: bigint | null;
  tipTimestampSec: number | null;
  nowMs: number;
  requiredHeight?: bigint | null;
}): EpochStatus {
  const { epoch, liveHeight, tipTimestampSec, nowMs, requiredHeight } = input;
  const tipAgeSec = tipTimestampSec == null ? null : Math.max(0, Math.floor(nowMs / 1000) - tipTimestampSec);

  if (!epoch) return { state: 'unknown', heightLag: null, tipAgeSec, sealableAtMs: null };

  const rawLag = liveHeight == null ? null : liveHeight - epoch.pChainHeight;
  const heightLag = rawLag == null ? null : rawLag < 0n ? 0n : rawLag;
  const sealableAtMs = epoch.startTimeSec * 1000 + EPOCH_DURATION_MS;

  if (requiredHeight != null) {
    if (epoch.pChainHeight >= requiredHeight) {
      return { state: 'satisfied', heightLag, tipAgeSec, sealableAtMs };
    }
    const state = nowMs >= sealableAtMs ? 'stale-sealable' : 'stale-waiting';
    return { state, heightLag, tipAgeSec, sealableAtMs };
  }

  const state = nowMs - sealableAtMs >= EPOCH_DURATION_MS ? 'stale-sealable' : 'satisfied';
  return { state, heightLag, tipAgeSec, sealableAtMs };
}

export type AdvanceAction =
  | { action: 'done-verified' }
  | { action: 'done-unverified' }
  | { action: 'wait'; untilMs: number }
  | { action: 'send' }
  | { action: 'give-up' };

/**
 * One iteration of the advance loop, as a pure decision.
 *
 * `blindRun` is latched from the run's FIRST snapshot: a run that started
 * with a readable epoch must never downgrade to blind completion because a
 * single mid-run read failed. Such a failure keeps producing blocks (they
 * are what the chain needs anyway) and verifies on a later read; if reads
 * never recover before the send cap, the run gives up instead of claiming
 * success.
 */
export function decideAdvanceAction(input: {
  epoch: ProposerVMEpoch | null;
  liveHeight: bigint | null;
  tipTimestampSec: number | null;
  nowMs: number;
  requiredHeight: bigint | null;
  blindRun: boolean;
  sends: number;
  maxSends: number;
  blindSends: number;
}): AdvanceAction {
  const { epoch, liveHeight, tipTimestampSec, nowMs, requiredHeight, blindRun, sends, maxSends, blindSends } = input;

  if (blindRun) {
    return sends >= blindSends ? { action: 'done-unverified' } : { action: 'send' };
  }

  const status = computeEpochStatus({ epoch, liveHeight, tipTimestampSec, nowMs, requiredHeight });
  if (epoch !== null && status.state === 'satisfied') return { action: 'done-verified' };
  if (sends >= maxSends) return { action: 'give-up' };
  if (epoch === null) return { action: 'send' };
  if (status.state === 'stale-waiting' && status.sealableAtMs !== null && status.sealableAtMs > nowMs) {
    return { action: 'wait', untilMs: status.sealableAtMs };
  }
  return { action: 'send' };
}
