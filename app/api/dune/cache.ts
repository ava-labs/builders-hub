// Shared cache for Dune labels using globalThis to persist across API routes
// TTL: 1 hour (labels don't change frequently)
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface DuneLabel {
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

// Extend globalThis type for our cache
declare global {
  // eslint-disable-next-line no-var
  var duneLabelCache: Map<string, CachedLabels> | undefined;
  // eslint-disable-next-line no-var
  var duneExecutionToAddress: Map<string, string> | undefined;
}

// Use globalThis to persist cache across API route invocations
// Cache: address (lowercase) → cached labels
const labelCache = globalThis.duneLabelCache ?? new Map<string, CachedLabels>();
globalThis.duneLabelCache = labelCache;

// Reverse lookup: executionId → address (lowercase)
const executionToAddress = globalThis.duneExecutionToAddress ?? new Map<string, string>();
globalThis.duneExecutionToAddress = executionToAddress;

export function getCachedLabels(address: string): DuneLabel[] | null {
  const key = address.toLowerCase();
  const cached = labelCache.get(key);
  
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    labelCache.delete(key);
    return null;
  }
  
  console.log(`[Dune] Cache hit for ${address}`);
  return cached.labels;
}

export function setCachedLabels(address: string, labels: DuneLabel[]): void {
  const key = address.toLowerCase();
  labelCache.set(key, {
    labels,
    timestamp: Date.now(),
  });
  console.log(`[Dune] Cached ${labels.length} labels for ${address}`);
}

export function registerExecution(executionId: string, address: string): void {
  executionToAddress.set(executionId, address.toLowerCase());
  console.log(`[Dune] Registered execution ${executionId} for ${address} (cache size: ${labelCache.size}, executions: ${executionToAddress.size})`);
}

export function getAddressForExecution(executionId: string): string | null {
  const address = executionToAddress.get(executionId) || null;
  console.log(`[Dune] Lookup execution ${executionId} → ${address || 'not found'}`);
  return address;
}

export function cleanupExecution(executionId: string): void {
  executionToAddress.delete(executionId);
  console.log(`[Dune] Cleaned up execution ${executionId}`);
}

