import { NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";
import {
  getQuizProgressForUser,
  upsertQuizResponse,
  QuizProgressValidationError,
  type QuizResponseDTO,
} from "@/server/services/quizProgress";

// A user can hold at most one row per quiz; the whole catalog is a few
// hundred quizzes, so anything beyond that in one backfill call is noise.
const MAX_BULK_ITEMS = 500;

export const GET = withAuth(async (_request, _context, session) => {
  const responses = await getQuizProgressForUser(session.user.id);
  return NextResponse.json({ responses });
});

/**
 * Bulk upsert, used by the client-side backfill that pushes pre-existing
 * IndexedDB progress up on the first signed-in visit. Invalid items are
 * skipped (old browser data may reference quizzes that no longer exist) —
 * a backfill must not fail wholesale because one row went stale.
 */
export const POST = withAuth(async (request, _context, session) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : null;
  if (!items) {
    return NextResponse.json(
      { error: "Expected an array of quiz responses" },
      { status: 400 }
    );
  }
  if (items.length > MAX_BULK_ITEMS) {
    return NextResponse.json(
      { error: `Too many items (max ${MAX_BULK_ITEMS})` },
      { status: 400 }
    );
  }

  const saved: QuizResponseDTO[] = [];
  const skipped: { quizId: string; reason: string }[] = [];

  for (const item of items) {
    const quizId = typeof item?.quizId === "string" ? item.quizId : null;
    if (!quizId) {
      skipped.push({ quizId: String(item?.quizId ?? "?"), reason: "missing quizId" });
      continue;
    }
    try {
      saved.push(
        await upsertQuizResponse(session.user.id, quizId, {
          selectedAnswers: item.selectedAnswers ?? [],
          isAnswerChecked: Boolean(item.isAnswerChecked),
          isCorrect: Boolean(item.isCorrect),
          attemptCount: item.attemptCount ?? 0,
          lastAttemptAt: item.lastAttemptAt ?? null,
        })
      );
    } catch (error) {
      if (error instanceof QuizProgressValidationError) {
        skipped.push({ quizId, reason: error.message });
        continue;
      }
      throw error;
    }
  }

  return NextResponse.json({ saved, skipped });
});
