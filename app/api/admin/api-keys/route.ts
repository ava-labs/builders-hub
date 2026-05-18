import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";
import { withAuth } from "@/lib/protectedRoute";
import { hasAnyAttribute } from "@/lib/auth/permissions";
import { createApiKey, listApiKeys } from "@/server/services/apiKeys";

/**
 * GET  /api/admin/api-keys?hackathon_id=...  → list keys (devrel-only)
 * POST /api/admin/api-keys                   → create key (devrel-only)
 *
 * The plaintext secret is returned only on POST. Subsequent reads expose just
 * the prefix.
 */
export const GET = withAuth(async (
  req: NextRequest,
  _context: unknown,
  session: Session,
) => {
  const customAttributes: string[] | undefined = (session.user as { custom_attributes?: string[] })
    ?.custom_attributes;
  if (!hasAnyAttribute(customAttributes, ["devrel"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hackathonId = req.nextUrl.searchParams.get("hackathon_id");
  if (!hackathonId) {
    return NextResponse.json({ error: "hackathon_id required" }, { status: 400 });
  }

  const keys = await listApiKeys(hackathonId);
  return NextResponse.json({ keys });
});

export const POST = withAuth(async (
  req: NextRequest,
  _context: unknown,
  session: Session,
) => {
  const customAttributes: string[] | undefined = (session.user as { custom_attributes?: string[] })
    ?.custom_attributes;
  if (!hasAnyAttribute(customAttributes, ["devrel"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const hackathonId = typeof body?.hackathon_id === "string" ? body.hackathon_id : "";

  if (!label || !hackathonId) {
    return NextResponse.json(
      { error: "label and hackathon_id required" },
      { status: 400 },
    );
  }

  const created = await createApiKey({
    label,
    hackathonId,
    createdBy: session.user.id,
  });

  return NextResponse.json({ key: created }, { status: 201 });
});
