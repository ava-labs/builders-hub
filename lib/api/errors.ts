/** Base API error class with HTTP status code and machine-readable error code. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Thrown when request body or query params fail Zod validation (400). */
export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

/** Thrown for generic malformed requests (400). */
export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, 'BAD_REQUEST', message);
    this.name = 'BadRequestError';
  }
}

/** Thrown when authentication is missing or invalid (401). */
export class AuthError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, 'AUTH_REQUIRED', message);
    this.name = 'AuthError';
  }
}

/** Thrown when the user lacks the required role or permission (403). */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

/** Thrown when the requested resource does not exist (404). */
export class NotFoundError extends ApiError {
  constructor(entity?: string) {
    super(404, 'NOT_FOUND', entity ? `${entity} not found` : 'Not found');
    this.name = 'NotFoundError';
  }
}

/** Thrown when the request conflicts with existing state (409). */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

/** Thrown when the client exceeds the rate limit (429). */
export class RateLimitError extends ApiError {
  public readonly resetAt?: Date;

  constructor(message = 'Rate limit exceeded', resetAt?: Date) {
    super(429, 'RATE_LIMITED', message);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

/** Thrown for unexpected internal failures (500). */
export class InternalError extends ApiError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
    this.name = 'InternalError';
  }
}

/** Type guard to check if an unknown value is an ApiError. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
