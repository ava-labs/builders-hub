import { isRetryableError } from "./error-parser";

/**
 * Retry an async function with exponential backoff + jitter.
 * Only retries on errors that match `isRetryableError()` — user rejections
 * and contract errors are thrown immediately.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelay = 2000 }: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delay = baseDelay * 2 ** attempt + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
