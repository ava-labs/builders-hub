import { NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";
import { rateLimit } from "@/lib/rateLimit";
import {
  getQuizProgressForUser,
  upsertQuizResponse,
  QuizProgressValidationError,
  type QuizResponseDTO,
} from "@/server/services/quizProgress";
import { bulkQuizResponseSchema } from "./schema";

export const GET = withAuth(async (_request, _context, session) => {
  const responses = await getQuizProgressForUser(session.user.id);
  // userId lets the client-side sync detect an account switch on a shared
  // browser and drop the previous account's local rows instead of
  // backfilling them into this one.
  return NextResponse.json({ responses, userId: session.user.id });
});

/**
 * Bulk upsert, used by the client-side backfill that pushes pre-existing
 * IndexedDB progress up on the first signed-in visit. Items that fail
 * quiz-content validation are skipped (old browser data may reference
 * quizzes that no longer exist) — a backfill must not fail wholesale
 * because one row went stale. Rate limited: the legitimate flow runs once
 * per page load, and each item costs DB writes.
 */
export const POST = rateLimit(
  withAuth(async (request, _context, session) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bulkQuizResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quiz responses", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const saved: QuizResponseDTO[] = [];
    const skipped: { quizId: string; reason: string }[] = [];

    for (const { quizId, ...payload } of parsed.data) {
      try {
        saved.push(await upsertQuizResponse(session.user.id, quizId, payload));
      } catch (error) {
        if (error instanceof QuizProgressValidationError) {
          skipped.push({ quizId, reason: error.message });
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({ saved, skipped });
  }),
  { windowMs: 5 * 60 * 1000, maxRequests: 10 }
);
