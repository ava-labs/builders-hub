import { NextResponse } from "next/server";
import { withAuth, type RouteParams } from "@/lib/protectedRoute";
import {
  upsertQuizResponse,
  QuizProgressValidationError,
} from "@/server/services/quizProgress";

export const PUT = withAuth<RouteParams<{ quizId: string }>>(
  async (request, context, session) => {
    const { quizId } = await context.params;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const response = await upsertQuizResponse(session.user.id, quizId, {
        selectedAnswers: body?.selectedAnswers ?? [],
        isAnswerChecked: Boolean(body?.isAnswerChecked),
        isCorrect: Boolean(body?.isCorrect),
        attemptCount: body?.attemptCount ?? 0,
        lastAttemptAt: body?.lastAttemptAt ?? null,
      });
      return NextResponse.json({ response });
    } catch (error) {
      if (error instanceof QuizProgressValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }
);
