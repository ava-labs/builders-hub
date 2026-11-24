import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { VERDICTS as ALLOWED_VERDICTS, isVerdict } from "@/lib/evaluate/verdicts";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

const bodySchema = z.object({
  formDataId: z.string().optional(),
  verdict: z.string().nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (
      !session?.user?.id ||
      !session.user.custom_attributes?.includes("devrel")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 401 });
    }

    const body = await readJsonBody(request, bodySchema);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { formDataId, verdict } = body;

    if (!formDataId) {
      return NextResponse.json(
        { error: "formDataId is required" },
        { status: 400 }
      );
    }

    if (verdict !== null && !isVerdict(verdict)) {
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
