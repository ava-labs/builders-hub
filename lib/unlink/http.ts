const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};

export function withNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/**
 * Preserves actionable SDK 4xx responses but never forwards unexpected
 * upstream 5xx bodies, which may contain internal service details.
 */
export function safeSdkResponse(response: Response): Response {
  return response.status >= 500 ? backendFailure() : withNoStore(response);
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function serviceUnavailable(): Response {
  return jsonError(503, 'SERVICE_UNAVAILABLE', 'service unavailable');
}

export function unauthorized(): Response {
  return jsonError(401, 'UNAUTHORIZED', 'authorization failed');
}

export function forbidden(): Response {
  return jsonError(403, 'FORBIDDEN', 'cross-origin request rejected');
}

export function backendFailure(): Response {
  return jsonError(502, 'BACKEND_ERROR', 'backend request failed');
}

/**
 * Browsers attach Origin to cross-origin POST requests. Reject a supplied
 * foreign origin while allowing non-browser callers that omit the header.
 */
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
