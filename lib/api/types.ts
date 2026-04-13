import type { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';

/** Envelope for successful single-entity responses. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Envelope for successful paginated list responses. */
export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/** Envelope for error responses. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** Union of all possible API response shapes. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiPaginatedResponse<T> | ApiErrorResponse;

/** Context object passed to withApi handler functions. */
export interface ApiHandlerContext<TBody = unknown> {
  session: any;
  body: TBody;
  params: Record<string, string>;
}

/** Rate limit configuration for withApi. */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  identifier?: 'user' | 'ip' | ((req: NextRequest, session: any) => string);
}

/** Options for the withApi wrapper. */
export interface WithApiOptions<TBody = unknown> {
  auth?: boolean;
  roles?: string[];
  schema?: ZodType<TBody>;
  rateLimit?: RateLimitConfig;
  maxBodySize?: number;
}

/** The function signature Next.js expects for route handlers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NextRouteHandler = (req: NextRequest, context?: any) => Promise<NextResponse>;
