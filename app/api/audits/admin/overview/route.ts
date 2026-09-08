import { NextResponse } from "next/server";
import { getAdminOverview } from "@/server/services/audits/visibility";
import { requireAuditAdmin } from "@/app/api/audits/utils";

export async function GET() {
  const { error } = await requireAuditAdmin();
  if (error) return error;

  try {
    const overview = await getAdminOverview();
    return NextResponse.json({ success: true, overview });
  } catch (err) {
    console.error("[Audits] admin overview failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load the overview right now." },
      { status: 500 },
    );
  }
}
