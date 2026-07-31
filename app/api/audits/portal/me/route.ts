import { NextResponse } from "next/server";
import { withAuditor } from "@/app/api/audits/portal/utils";

export const GET = withAuditor(
  async (_request, _context, auditor) => {
    return NextResponse.json({
      success: true,
      auditor: {
        firm_name: auditor.firm_name,
        quote_email: auditor.quote_email,
        services: auditor.services,
      },
    });
  },
  { allowInactive: true },
);
