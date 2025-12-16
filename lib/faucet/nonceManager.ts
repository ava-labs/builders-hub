const chainLocks = new Map<number, Promise<void>>();

export async function withChainLock<T>(
  chainId: number,
  fn: () => Promise<T>
): Promise<T> {
  const existingLock = chainLocks.get(chainId);
  if (existingLock) {
    await existingLock;
  }

  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  chainLocks.set(chainId, lockPromise);

  try {
    return await fn();
  } finally {
    releaseLock!();
    if (chainLocks.get(chainId) === lockPromise) {
      chainLocks.delete(chainId);
    }
  }
}

export async function getNextNonce(
  publicClient: { getTransactionCount: (args: { address: `0x${string}`; blockTag: 'pending' }) => Promise<number> },
  address: `0x${string}`
): Promise<number> {
  return publicClient.getTransactionCount({ address, blockTag: 'pending' });
}

export async function withNonceRetry<T>(
  fn: (nonce?: number) => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isNonceError = 
        lastError.message.toLowerCase().includes('nonce') ||
        lastError.message.toLowerCase().includes('replacement transaction underpriced') ||
        lastError.message.toLowerCase().includes('already known');
      
      if (!isNonceError || attempt === maxRetries - 1) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  
  throw lastError;
}
