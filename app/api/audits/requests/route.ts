import { NextRequest, NextResponse } from "next/server";
import { auditDraftSchema } from "@/types/audits";
import { createDraft } from "@/server/services/audits/requests";
import { getOwnerRequests } from "@/server/services/audits/visibility";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

export async function GET() {
  // pending_ sessions get an empty list (their id matches no rows), which is
  // the designed first-run state rather than an error.
  const { caller, error } = await requireProjectUser({ allowPending: true });
  if (error) return error;

  try {
    const requests = await getOwnerRequests(caller.userId);
    return NextResponse.json({ success: true, requests });
  } catch (err) {
    console.error("[Audits] list failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load your requests right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("draft-create", caller.email, {
    windowMs: DAY_MS,
    maxRequests: 20,
  });
  if (limited) return limited;

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
    const draft = await createDraft(caller.userId, parsed.data);
    return NextResponse.json({ success: true, id: draft.id }, { status: 201 });
  } catch (err) {
    console.error("[Audits] draft create failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't save your draft right now." },
      { status: 500 },
    );
  }
}
