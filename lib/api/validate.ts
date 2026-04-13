import type { NextRequest } from 'next/server';
import { ZodType } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { ValidationError } from '@/lib/api/errors';

/** Format a Zod error into a human-readable string using zod-validation-error. */
function formatZodError(error: unknown): string {
  return fromZodError(error as Parameters<typeof fromZodError>[0]).message;
}

/** Parse and validate the JSON request body against a Zod schema. */
export async function validateBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}

/** Parse and validate URL search params against a Zod schema. */
export function validateQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    obj[key] = value;
  });

  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}

/** Validate route params against a Zod schema. */
export function validateParams<T>(params: Record<string, string>, schema: ZodType<T>): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}
