import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { getAuthSession } from "@/lib/auth/authSession";
import { PlanError } from "@/lib/studio/executor";
import { StudioError } from "@/server/services/studio/errors";

export interface StudioContext<P> {
  request: NextRequest;
  params: P;
  userId: string;
}

/** Signed-in Studio handler: returns JSON for plain values, passes Responses through, maps errors to statuses. */
export function studioRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (ctx: StudioContext<P>) => Promise<unknown>,
) {
  return async (request: NextRequest, context: { params: Promise<P> }) => {
    try {
      const session = await getAuthSession();
      const userId = session?.user?.id;
      if (!userId) throw new StudioError(401, "Sign in to use Studio", "unauthenticated");
      const result = await handler({ request, params: await context.params, userId });
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new StudioError(400, "Send a JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new StudioError(400, parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), "invalid");
  }
  return parsed.data;
}

export function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.code ?? "error", message: error.message }, { status: error.status });
  }
  if (error instanceof PlanError) return NextResponse.json({ error: "plan", message: error.message }, { status: 409 });
  console.error("[studio]", error);
  return NextResponse.json({ error: "error", message: "Something went wrong in Studio. Try again." }, { status: 500 });
}
