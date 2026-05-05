const DEFAULT_MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = DEFAULT_MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Request failed: ${response.status}`)
      }

      lastError = new Error(`Request failed: ${response.status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Network error')
    }

    if (attempt < maxRetries) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('Request failed after retries')
}
