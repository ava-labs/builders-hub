/**
 * Input validators for gateway-bound on-chain query params.
 *
 * The MCP holds NO ClickHouse connection — every indexed-data query goes to the
 * hardened query gateway (typed DSL, HMAC-signed; see gateway-client.ts), which
 * validates again authoritatively. These validators are the cheap UX pre-filter:
 * they turn obviously-bad input (unknown chain, malformed address, out-of-range
 * window) into an immediate, clear error instead of a gateway round trip.
 */

import { ALLOWED_CHAIN_IDS } from './constants';

export class ClickHouseSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClickHouseSafeError';
  }
}

// --- Validators (every value that ever touches SQL goes through one) --------

export function assertChainId(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ClickHouseSafeError('invalid chainId (must be a positive integer EVM chain ID)');
  if (!ALLOWED_CHAIN_IDS.has(n)) throw new ClickHouseSafeError(`chainId ${n} is not indexed for on-chain queries`);
  return n;
}

export function toSafeHexAddr(address: string): string {
  const hex = String(address).toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new ClickHouseSafeError('invalid EVM address');
  return hex;
}

export function assertSafeHours(h: unknown, max = 24 * 30): number {
  const n = typeof h === 'number' ? h : Number(h);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ClickHouseSafeError(`hours must be an integer 1..${max}`);
  return n;
}

export function assertSafeDays(d: unknown, max = 365): number {
  const n = typeof d === 'number' ? d : Number(d);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ClickHouseSafeError(`days must be an integer 1..${max}`);
  return n;
}

export function clampLimit(n: unknown, max = 100, fallback = 20): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return Math.min(fallback, max);
  return Math.max(1, Math.min(Math.floor(v), max));
}
