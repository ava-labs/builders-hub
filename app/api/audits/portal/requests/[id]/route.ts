import { NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { getRequestForAuditor } from "@/server/services/audits/visibility";
import { withAuditor } from "@/app/api/audits/portal/utils";

export const GET = withAuditor<RouteParams<{ id: string }>>(
  async (_request, context, auditor) => {
    const { id } = await context.params;
    try {
      const request = await getRequestForAuditor(auditor.id, id);
      if (!request) {
        // No fan-out row for this firm: the request does not exist for it.
        return NextResponse.json(
          { success: false, message: "Request not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true, request });
    } catch (err) {
      console.error("[Audits] portal request failed:", err);
      return NextResponse.json(
        { success: false, message: "We couldn't load this request right now." },
        { status: 500 },
      );
    }
  },
  { allowInactive: true },
);
