/**
 * Type-safe API client that auto-unwraps the { success, data } envelope.
 * ALL client-side code MUST use this instead of raw fetch('/api/...').
 * Enforced by ESLint + CI.
 */

/** Error thrown when an API request fails. */
export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serializable request body. Automatically stringified + Content-Type set. */
  body?: unknown;
  /** Skip envelope unwrapping — returns the raw Response. Use for streaming/blob endpoints. */
  raw?: boolean;
}

/**
 * Fetch an API route with automatic envelope unwrapping.
 *
 * Returns `data` from `{ success: true, data: T }` on success.
 * Throws `ApiClientError` with `{ code, message, status }` on failure.
 *
 * @example
 * ```ts
 * const projects = await apiFetch<Project[]>('/api/projects');
 * const project = await apiFetch<Project>('/api/projects', { method: 'POST', body: { name: 'Test' } });
 * ```
 */
export async function apiFetch<T = unknown>(url: string, options?: ApiFetchOptions): Promise<T> {
  const { body, raw, ...fetchOptions } = options ?? {};

  const headers = new Headers(fetchOptions.headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  // Auto-set Content-Type for JSON bodies (skip for FormData — browser sets boundary)
  if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: isFormData ? fetchOptions.headers : headers, // Let browser handle FormData headers
    body: isFormData ? (body as BodyInit) : (body !== undefined ? JSON.stringify(body) : undefined),
  });

  // Raw mode: return the Response as-is (for streaming, blobs, etc.)
  if (raw) {
    if (!response.ok) {
      // Try to parse error envelope, fall back to status text
      try {
        const json = await response.json();
        if (json?.error?.message) {
          throw new ApiClientError(json.error.code ?? 'REQUEST_FAILED', json.error.message, response.status);
        }
      } catch (e) {
        if (e instanceof ApiClientError) throw e;
      }
      throw new ApiClientError('REQUEST_FAILED', response.statusText || `Request failed: ${response.status}`, response.status);
    }
    return response as unknown as T;
  }

  // Parse JSON
  let json: any;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiClientError('REQUEST_FAILED', response.statusText || `Request failed: ${response.status}`, response.status);
    }
    // 204 No Content or empty body
    return undefined as T;
  }

  // Error envelope: { success: false, error: { code, message } }
  if (!response.ok || json.success === false) {
    throw new ApiClientError(
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.message ?? json?.message ?? 'An unexpected error occurred',
      response.status,
    );
  }

  // Success envelope: { success: true, data: T }
  // Return .data if it exists, otherwise return the whole body (for non-enveloped responses during migration)
  return (json.data !== undefined ? json.data : json) as T;
}
