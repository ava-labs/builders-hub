// Shared cache for Dune labels using globalThis to persist across API routes
// TTL: 1 hour for labels, 5 minutes for pending executions
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const PENDING_TTL = 5 * 60 * 1000; // 5 minutes for pending executions

export interface DuneLabel {
  blockchain: string;
  name: string;
  category: string;
  source: string;
  chainId?: string;
  chainName?: string;
  chainLogoURI?: string;
  chainSlug?: string;
  chainColor?: string;
}

interface CachedLabels {
  labels: DuneLabel[];
  timestamp: number;
}

interface PendingExecution {
  executionId: string;
  timestamp: number;
}

// Extend globalThis type for our cache
declare global {
  // eslint-disable-next-line no-var
  var duneLabelCache: Map<string, CachedLabels> | undefined;
  // eslint-disable-next-line no-var
  var dunePendingExecutions: Map<string, PendingExecution> | undefined;
}

// Use globalThis to persist cache across API route invocations
const labelCache = globalThis.duneLabelCache ?? new Map<string, CachedLabels>();
globalThis.duneLabelCache = labelCache;

const pendingExecutions = globalThis.dunePendingExecutions ?? new Map<string, PendingExecution>();
globalThis.dunePendingExecutions = pendingExecutions;

// Get cached labels for an address (returns null if not cached or expired)
export function getCachedLabels(address: string): DuneLabel[] | null {
  const key = address.toLowerCase();
  const cached = labelCache.get(key);
  
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    labelCache.delete(key);
    return null;
  }
  
  return cached.labels;
}

// Store completed labels for an address
export function setCachedLabels(address: string, labels: DuneLabel[]): void {
  const key = address.toLowerCase();
  labelCache.set(key, {
    labels,
    timestamp: Date.now(),
  });
  // Clear any pending execution
  pendingExecutions.delete(key);
  console.log(`[Dune] Cached ${labels.length} labels for ${address}`);
}

// Get pending execution for an address
export function getPendingExecution(address: string): string | null {
  const key = address.toLowerCase();
  const pending = pendingExecutions.get(key);
  
  if (!pending) return null;
  
  // Check if expired
  if (Date.now() - pending.timestamp > PENDING_TTL) {
    pendingExecutions.delete(key);
    return null;
  }
  
  return pending.executionId;
}

// Store pending execution for an address
export function setPendingExecution(address: string, executionId: string): void {
  const key = address.toLowerCase();
  pendingExecutions.set(key, {
    executionId,
    timestamp: Date.now(),
  });
  console.log(`[Dune] Set pending execution ${executionId} for ${address}`);
}

// Clear pending execution for an address
export function clearPendingExecution(address: string): void {
  const key = address.toLowerCase();
  pendingExecutions.delete(key);
}
