import { NextRequest, NextResponse } from "next/server";
import { adminRequestFiltersSchema } from "@/types/audits";
import { getAdminRequests } from "@/server/services/audits/visibility";
import { requireAuditAdmin } from "@/app/api/audits/utils";

export async function GET(request: NextRequest) {
  const { error } = await requireAuditAdmin();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const parsed = adminRequestFiltersSchema.safeParse({
    status: params.get("status") ?? undefined,
    subsidy: params.get("subsidy") ?? undefined,
    deadline_before: params.get("deadline_before") ?? undefined,
    deadline_after: params.get("deadline_after") ?? undefined,
    take: params.get("take") ?? undefined,
    skip: params.get("skip") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid filters", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const requests = await getAdminRequests(parsed.data);
    return NextResponse.json({ success: true, requests });
  } catch (err) {
    console.error("[Audits] admin requests failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load the requests right now." },
      { status: 500 },
    );
  }
}
