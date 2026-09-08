import { NextResponse } from "next/server";
import { getAuditorInbox } from "@/server/services/audits/visibility";
import { withAuditor } from "@/app/api/audits/portal/utils";

export const GET = withAuditor(
  async (_request, _context, auditor) => {
    try {
      const items = await getAuditorInbox(auditor.id);
      return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[Audits] portal inbox failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load your inbox right now." },
      { status: 500 },
    );
    }
  },
  { allowInactive: true },
);
