import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { auditDraftSchema } from "@/types/audits";
import { deleteDraft, patchDraft } from "@/server/services/audits/requests";
import { getOwnerRequestDetail } from "@/server/services/audits/visibility";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

type Context = RouteParams<{ id: string }>;

export async function GET(_request: NextRequest, context: Context) {
  const { caller, error } = await requireProjectUser({ allowPending: true });
  if (error) return error;
  const { id } = await context.params;

  try {
    const request = await getOwnerRequestDetail(caller.userId, id);
    if (!request) {
      return NextResponse.json({ success: false, message: "Request not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, request });
  } catch (err) {
    console.error("[Audits] detail failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load this request right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  // Autosave fires on typing pauses; the window is deliberately short + roomy.
  const limited = applyRateLimit("autosave", caller.email, {
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (limited) return limited;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = auditDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await patchDraft(caller.userId, id, parsed.data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Draft not found or no longer editable." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] autosave failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't save your draft right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("draft-delete", caller.email, {
    windowMs: DAY_MS,
    maxRequests: 20,
  });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await deleteDraft(caller.userId, id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Draft not found or no longer deletable." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] draft delete failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't delete this draft right now." },
      { status: 500 },
    );
  }
}
