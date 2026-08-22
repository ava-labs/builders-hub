import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { getAdminRequestDetail } from "@/server/services/audits/visibility";
import { requireAuditAdmin } from "@/app/api/audits/utils";

export async function GET(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { error } = await requireAuditAdmin();
  if (error) return error;
  const { id } = await context.params;

  try {
    const request = await getAdminRequestDetail(id);
    if (!request) {
      return NextResponse.json({ success: false, message: "Request not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, request });
  } catch (err) {
    console.error("[Audits] admin drill-down failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load this request right now." },
      { status: 500 },
    );
  }
}
