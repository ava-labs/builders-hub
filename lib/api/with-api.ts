import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { AuthError, ForbiddenError, InternalError, RateLimitError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { checkPrismaRateLimit, getRateLimitIdentifier } from '@/lib/api/rate-limit';
import type { ApiHandlerContext, WithApiOptions, NextRouteHandler } from '@/lib/api/types';

/**
 * Core API wrapper that composes auth, validation, rate limiting, and error handling.
 *
 * Every route handler wrapped with withApi gets a consistent context object,
 * automatic error envelope formatting, and opt-in middleware via options.
 */
export function withApi<TBody = unknown>(
  handler: (req: NextRequest, ctx: ApiHandlerContext<TBody>) => Promise<NextResponse>,
  options: WithApiOptions<TBody> = {}
): NextRouteHandler {
  return async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      // 1. Extract route params (Next.js 15+ returns a Promise)
      const params = context?.params ? await context.params : {};

      // 2. Authentication & authorization
      let session: any = null;

      if (options.auth || options.roles) {
        session = await getAuthSession();

        if (!session) {
          throw new AuthError();
        }

        if (options.roles && options.roles.length > 0) {
          const userAttrs: string[] = session.user?.custom_attributes ?? [];

          const hasRole = options.roles.some((role) => {
            if (userAttrs.includes(role)) return true;
            // Super-admin pattern: "devrel" can act as badge_admin or showcase
            if ((role === 'badge_admin' || role === 'showcase') && userAttrs.includes('devrel')) {
              return true;
            }
            return false;
          });

          if (!hasRole) {
            throw new ForbiddenError();
          }
        }
      } else {
        // Still fetch session opportunistically (useful for rate limit identifier)
        session = await getAuthSession();
      }

      // 3. Rate limiting
      let rateLimitHeaders: Record<string, string> | undefined;

      if (options.rateLimit) {
        const identifier = getRateLimitIdentifier(req, session, options.rateLimit);
        const endpoint = req.nextUrl.pathname;
        const result = await checkPrismaRateLimit(identifier, endpoint, {
          windowMs: options.rateLimit.windowMs,
          maxRequests: options.rateLimit.maxRequests,
        });

        rateLimitHeaders = result.headers;

        if (!result.allowed) {
          throw new RateLimitError('Rate limit exceeded', result.resetAt);
        }
      }

      // 4. Body validation
      let body: TBody = undefined as TBody;
      if (options.schema) {
        body = await validateBody(req, options.schema);
      }

      // 5. Execute the handler
      const response = await handler(req, { session, body, params });

      // 6. Attach rate limit headers to response if present
      if (rateLimitHeaders) {
        for (const [key, value] of Object.entries(rateLimitHeaders)) {
          response.headers.set(key, value);
        }
      }

      return response;
    } catch (error) {
      // Rate limit errors need their headers on the error response too
      if (error instanceof RateLimitError) {
        return errorResponse(error);
      }

      if (error instanceof Error && 'statusCode' in error) {
        return errorResponse(error);
      }

      console.error('[API Error]', error);
      return errorResponse(new InternalError());
    }
  };
}
