import { NextResponse } from "next/server";
import { withAuditor } from "@/app/api/audits/portal/utils";
import { applyRateLimit, DAY_MS } from "@/app/api/audits/utils";
import { auditorSelfUpdateSchema } from "@/types/audits";
import { updateAuditor } from "@/server/services/audits/auditors";

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

/**
 * A firm edits its own services and website (any active identity). No
 * allowInactive, so a deactivated firm's write fails 403. The response is
 * built from the ACCEPTED fields, never result.auditor, which carries
 * attio_ref (S-5).
 */
export const PATCH = withAuditor(async (request, _context, auditor, actorEmail) => {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ success: false, message: "Send JSON." }, { status: 415 });
  }
  const limited = applyRateLimit("firm-update", auditor.quote_email, {
    windowMs: DAY_MS,
    maxRequests: 50,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = auditorSelfUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await updateAuditor(auditor.id, parsed.data, {
    type: "auditor",
    id: auditor.id,
    email: actorEmail,
  });
  if (!result.success) {
    return NextResponse.json({ success: false, message: "Firm not found." }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    auditor: {
      ...(parsed.data.services !== undefined ? { services: parsed.data.services } : {}),
      ...(parsed.data.website !== undefined ? { website: parsed.data.website } : {}),
    },
  });
});
