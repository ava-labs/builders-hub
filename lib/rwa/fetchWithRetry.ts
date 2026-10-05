const DEFAULT_MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = DEFAULT_MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response | null = null
    try {
      response = await fetch(url, options)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Network error')
    }

    if (response) {
      if (response.ok) return response
      // a client error (4xx, a 429 included) will not change on a retry, so it is the answer
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Request failed: ${response.status}`)
      }
      lastError = new Error(`Request failed: ${response.status}`)
    }

    if (attempt < maxRetries) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('Request failed after retries')
}
