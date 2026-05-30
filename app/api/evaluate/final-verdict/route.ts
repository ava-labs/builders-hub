import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";

const ALLOWED_VERDICTS = ["top", "strong", "maybe", "weak", "reject"];

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (
      !session?.user?.id ||
      !session.user.custom_attributes?.includes("devrel")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 401 });
    }

    const body = await request.json();
    const { formDataId, verdict } = body as {
      formDataId: string;
      verdict: string | null;
    };

    if (!formDataId) {
      return NextResponse.json(
        { error: "formDataId is required" },
        { status: 400 }
      );
    }

    if (verdict !== null && !ALLOWED_VERDICTS.includes(verdict)) {
      return NextResponse.json(
        { error: `verdict must be one of: ${ALLOWED_VERDICTS.join(", ")} or null` },
        { status: 400 }
      );
    }

    const updated = await prisma.formData.update({
      where: { id: formDataId },
      data: { final_verdict: verdict },
      select: { id: true, final_verdict: true },
    });

    return NextResponse.json({
      id: updated.id,
      finalVerdict: updated.final_verdict,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
