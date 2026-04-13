import { NextResponse } from 'next/server';
import { ApiError, RateLimitError, InternalError } from '@/lib/api/errors';

/** Return a success envelope with data and optional status code. */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/** Return a success envelope with paginated data. */
export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; pageSize: number; total: number }
): NextResponse {
  return NextResponse.json({ success: true, data, pagination });
}

/** Convert an error into a standardized error envelope response. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const body = {
      success: false as const,
      error: { code: error.code, message: error.message },
    };

    const headers: Record<string, string> = {};

    if (error instanceof RateLimitError && error.resetAt) {
      headers['X-RateLimit-Reset'] = Math.floor(error.resetAt.getTime() / 1000).toString();
      headers['Retry-After'] = Math.max(0, Math.ceil((error.resetAt.getTime() - Date.now()) / 1000)).toString();
    }

    return NextResponse.json(body, { status: error.statusCode, headers });
  }

  // Unknown error -- log but never expose details to the client
  console.error('[API Error]', error);

  const fallback = new InternalError();
  return NextResponse.json(
    { success: false, error: { code: fallback.code, message: fallback.message } },
    { status: fallback.statusCode }
  );
}

/** Return an empty 204 No Content response. */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
