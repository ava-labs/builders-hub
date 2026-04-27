import type { AcpEntry } from './parser';

export interface ListOptions {
  status?: string;
  track?: string;
  limit?: number;
}

/**
 * Pure filter helper used by listAcps. Track matching is case-insensitive and
 * matches if any of the entry's tracks starts with the requested value, so
 * callers can pass "Standards" to also pick up the combined "Standards,
 * Subnet" tracks.
 */
export function filterAcps(entries: readonly AcpEntry[], options: ListOptions = {}): AcpEntry[] {
  const { status, track, limit } = options;
  const lowerStatus = status?.toLowerCase().trim();
  const lowerTrack = track?.toLowerCase().trim();

  const filtered = entries.filter((entry) => {
    if (lowerStatus && entry.status.toLowerCase() !== lowerStatus) return false;
    if (lowerTrack && !entry.tracks.some((t) => t.toLowerCase().startsWith(lowerTrack))) return false;
    return true;
  });

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return filtered.slice(0, Math.floor(limit));
  }
  return filtered;
}
