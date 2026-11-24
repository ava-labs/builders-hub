import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

const bodySchema = z.object({
  formDataIds: z.array(z.string().min(1)).optional(),
  formDataId: z.string().optional(),
  stage: z.number(),
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
    const { formDataIds, formDataId, stage } = body;

    const ids = formDataIds ?? (formDataId ? [formDataId] : []);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "formDataId or formDataIds required" },
        { status: 400 }
      );
    }

    if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 0 || stage > 4) {
      return NextResponse.json(
        { error: "stage must be an integer between 0 and 4" },
        { status: 400 }
      );
    }

    const result = await prisma.formData.updateMany({
      where: { id: { in: ids } },
      data: { current_stage: stage },
    });

    return NextResponse.json({
      updated: result.count,
      stage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
