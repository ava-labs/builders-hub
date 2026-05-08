import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { canAccessEvaluationTools } from "@/lib/auth/permissions";

const ALLOWED_VERDICTS = ["top", "strong", "maybe", "weak", "reject"];

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id || !canAccessEvaluationTools(session.user.custom_attributes)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 401 });
    }

    const body = await request.json();
    const { formDataId, verdict, comment, scoreOverall, scores, stage = 0 } = body as {
      formDataId: string;
      verdict: string;
      comment?: string;
      scoreOverall?: number;
      scores?: Record<string, number>;
      stage?: number;
    };

    if (!formDataId || !verdict) {
      return NextResponse.json(
        { error: "formDataId and verdict are required" },
        { status: 400 }
      );
    }

    if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 0 || stage > 4) {
      return NextResponse.json(
        { error: "stage must be an integer between 0 and 4" },
        { status: 400 }
      );
    }

    if (!ALLOWED_VERDICTS.includes(verdict)) {
      return NextResponse.json(
        { error: `verdict must be one of: ${ALLOWED_VERDICTS.join(", ")}` },
        { status: 400 }
      );
    }

    if (
      scoreOverall !== undefined &&
      (typeof scoreOverall !== "number" ||
        scoreOverall < 1 ||
        scoreOverall > 5 ||
        scoreOverall % 0.5 !== 0)
    ) {
      return NextResponse.json(
        { error: "scoreOverall must be between 1 and 5 in 0.5 increments" },
        { status: 400 }
      );
    }

    if (scores) {
      const vals = Object.values(scores);
      if (vals.some((v) => typeof v !== "number" || v < 1 || v > 5)) {
        return NextResponse.json(
          { error: "All score values must be numbers between 1 and 5" },
          { status: 400 }
        );
      }
    }

    const evaluation = await prisma.evaluation.upsert({
      where: {
        form_data_id_evaluator_id_stage: {
          form_data_id: formDataId,
          evaluator_id: session.user.id,
          stage,
        },
      },
      update: {
        verdict,
        comment: comment ?? null,
        score_overall: scoreOverall ?? null,
        scores: scores ?? undefined,
      },
      create: {
        form_data_id: formDataId,
        evaluator_id: session.user.id,
        stage,
        verdict,
        comment: comment ?? null,
        score_overall: scoreOverall ?? null,
        scores: scores ? (scores as Record<string, number>) : undefined,
      },
    });

    return NextResponse.json({
      id: evaluation.id,
      verdict: evaluation.verdict,
      comment: evaluation.comment,
      stage: evaluation.stage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
