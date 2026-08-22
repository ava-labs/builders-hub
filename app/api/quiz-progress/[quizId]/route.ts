import { NextResponse } from "next/server";
import { withAuth, type RouteParams } from "@/lib/protectedRoute";
import { rateLimit } from "@/lib/rateLimit";
import {
  upsertQuizResponse,
  QuizProgressValidationError,
} from "@/server/services/quizProgress";
import { quizResponseSchema } from "../schema";

export const PUT = rateLimit(
  withAuth<RouteParams<{ quizId: string }>>(async (request, context, session) => {
    const { quizId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = quizResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quiz response", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    try {
      const response = await upsertQuizResponse(session.user.id, quizId, parsed.data);
      return NextResponse.json({ response });
    } catch (error) {
      if (error instanceof QuizProgressValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }),
  { windowMs: 60 * 1000, maxRequests: 30 }
);
