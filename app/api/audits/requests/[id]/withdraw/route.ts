import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { withdraw } from "@/server/services/audits/requests";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

export async function POST(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("withdraw", caller.email, {
    windowMs: DAY_MS,
    maxRequests: 10,
  });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await withdraw(caller.userId, id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Only a request that is collecting quotes can be withdrawn." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] withdraw failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't withdraw this request right now." },
      { status: 500 },
    );
  }
}
