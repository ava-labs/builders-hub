import type { ZodType } from 'zod';

/**
 * Reads the JSON body of a request and checks it against a schema.
 *
 * Returns null when the body is not JSON or does not match the schema. The
 * route then sends its own 400 answer. Use the returned value only: it holds
 * the fields of the schema, each with the type the schema names.
 */
export async function readJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}
