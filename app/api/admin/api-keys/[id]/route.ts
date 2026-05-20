import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";
import { withAuth, RouteParams } from "@/lib/protectedRoute";
import { hasAnyAttribute } from "@/lib/auth/permissions";
import { revokeApiKey } from "@/server/services/apiKeys";

/**
 * DELETE /api/admin/api-keys/[id] → revoke key (devrel-only).
 * Revocation is non-destructive (sets revoked_at) so the audit trail survives.
 */
export const DELETE = withAuth<RouteParams<{ id: string }>>(async (
  _req: NextRequest,
  { params },
  session: Session,
) => {
  const customAttributes: string[] | undefined = (session.user as { custom_attributes?: string[] })
    ?.custom_attributes;
  if (!hasAnyAttribute(customAttributes, ["devrel"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await revokeApiKey(id);
  return NextResponse.json({ revoked: true });
});
