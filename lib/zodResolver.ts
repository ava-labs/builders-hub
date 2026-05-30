/**
 * Zod resolver compatible with both Zod v3 (error.errors) and Zod v4 (error.issues).
 * @hookform/resolvers zod only checks error.errors, so Zod v4 validation errors were
 * thrown instead of being mapped to form field errors. This wrapper ensures all Zod
 * validation errors are converted to react-hook-form errors and shown in FormMessage.
 */
import { toNestErrors, validateFieldsNatively } from "@hookform/resolvers";
import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Resolver,
  ResolverOptions,
} from "react-hook-form";
import { appendErrors } from "react-hook-form";

const DEFAULT_ERROR_TYPE = "validate" as const;

type ZodIssueLike = {
  path: (string | number)[];
  message: string;
  code?: string;
  unionErrors?: Array<{ errors: ZodIssueLike[] }>;
  errors?: ZodIssueLike[][];
};

function isZodError(error: unknown): error is { errors?: unknown[]; issues?: unknown[] } {
  const e = error as { errors?: unknown[]; issues?: unknown[] } | null;
  return Boolean(e && (Array.isArray(e.errors) || Array.isArray(e.issues)));
}

function getIssues(error: { errors?: ZodIssueLike[]; issues?: ZodIssueLike[] }): ZodIssueLike[] {
  return error.issues ?? error.errors ?? [];
}

/** Flatten union/nested errors so we have a single list of issues with path, message, code. */
function flattenIssues(issues: ZodIssueLike[]): ZodIssueLike[] {
  const out: ZodIssueLike[] = [];
  for (const issue of issues) {
    if ("unionErrors" in issue && Array.isArray(issue.unionErrors)) {
      for (const u of issue.unionErrors) {
        if (Array.isArray(u?.errors)) out.push(...flattenIssues(u.errors));
      }
    } else if ("errors" in issue && Array.isArray(issue.errors) && issue.errors.length > 0) {
      issue.errors[0] && out.push(...flattenIssues(issue.errors[0]));
    } else {
      out.push(issue);
    }
  }
  return out;
}

function parseErrorSchema(
  zodErrors: ZodIssueLike[],
  validateAllFieldCriteria: boolean
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  const queue = [...zodErrors];

  while (queue.length > 0) {
    const error = queue[0];
    const { code, message, path } = error;
    const _path = path.map(String).join(".");

    if (!errors[_path]) {
      const type = (code ?? DEFAULT_ERROR_TYPE) as FieldError["type"];
      if ("unionErrors" in error && Array.isArray(error.unionErrors) && error.unionErrors[0]) {
        const first = error.unionErrors[0].errors?.[0];
        errors[_path] = {
          message: first?.message ?? message,
          type: (first?.code ?? DEFAULT_ERROR_TYPE) as FieldError["type"],
        };
      } else if ("errors" in error && Array.isArray(error.errors)) {
        const branch = error.errors[0];
        const first = Array.isArray(branch) ? branch[0] : undefined;
        errors[_path] = first
          ? { message: first?.message ?? message, type: (first?.code ?? DEFAULT_ERROR_TYPE) as FieldError["type"] }
          : { message, type };
      } else {
        errors[_path] = { message, type };
      }
    }

    if ("unionErrors" in error && Array.isArray(error.unionErrors)) {
      error.unionErrors.forEach((u) => {
        if (Array.isArray(u?.errors)) u.errors.forEach((e) => queue.push(e));
      });
    }
    if ("errors" in error && Array.isArray(error.errors)) {
      const errs = error.errors;
      errs.forEach((branch) => {
        if (Array.isArray(branch)) branch.forEach((e) => queue.push(e));
      });
    }

    if (validateAllFieldCriteria && code) {
      const typeKey = code ?? DEFAULT_ERROR_TYPE;
      const types = errors[_path].types;
      const messages = types && (types as Record<string, string[]>)[typeKey];
      errors[_path] = appendErrors(
        _path,
        validateAllFieldCriteria,
        errors,
        typeKey as FieldError["type"],
        messages ? ([] as string[]).concat(messages, message) : message
      ) as FieldError;
    }

    queue.shift();
  }

  return errors;
}

/** Zod v3/v4 schema shape; cast used so both versions are accepted. */
type SchemaLike = {
  parse: (data: unknown, params?: unknown) => unknown;
  parseAsync: (data: unknown, params?: unknown) => Promise<unknown>;
};

export function zodResolver<TFieldValues extends FieldValues>(
  schema: unknown,
  schemaOptions?: Record<string, unknown>,
  resolverOptions: { mode?: "async" | "sync"; raw?: boolean } = {}
): Resolver<TFieldValues> {
  const s = schema as SchemaLike;
  return (async (values, _context, options: ResolverOptions<TFieldValues>) => {
    try {
      const parse = resolverOptions.mode === "sync" ? s.parse : s.parseAsync;
      const data = (await parse(values, schemaOptions)) as TFieldValues;

      if (options.shouldUseNativeValidation) {
        validateFieldsNatively({}, options);
      }

      return {
        errors: {} as FieldErrors<TFieldValues>,
        values: resolverOptions.raw ? (Object.assign({}, values) as TFieldValues) : data,
      };
    } catch (error: unknown) {
      if (isZodError(error)) {
        const issues = getIssues(error as { errors?: ZodIssueLike[]; issues?: ZodIssueLike[] });
        const flat = flattenIssues(issues);
        const fieldErrors = parseErrorSchema(
          flat,
          !options.shouldUseNativeValidation && options.criteriaMode === "all"
        );
        return {
          values: {},
          errors: toNestErrors(fieldErrors, options) as FieldErrors<TFieldValues>,
        };
      }
      throw error;
    }
  }) as Resolver<TFieldValues>;
}
