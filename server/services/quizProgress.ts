import { prisma } from "@/prisma/prisma";
import quizData from "@/components/quizzes/data";

// Mirrors MAX_ATTEMPTS in components/quizzes/quiz.tsx — the client enforces the
// attempt cap, the server only needs it to bound the accepted payload.
const MAX_ATTEMPTS = 3;

export interface QuizResponsePayload {
  selectedAnswers: number[];
  isAnswerChecked: boolean;
  isCorrect: boolean;
  attemptCount: number;
  lastAttemptAt: number | null;
}

export interface QuizResponseDTO extends QuizResponsePayload {
  quizId: string;
}

export class QuizProgressValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizProgressValidationError";
  }
}

// Mirrors getVariant in components/quizzes/quiz.tsx: variant 0 is the base
// question, variant N (N >= 1) is alternates[N - 1], out-of-range falls back
// to the base question.
function getVariant(quizId: string, variantIndex: number) {
  const baseQuiz = quizData.quizzes[quizId];
  if (!baseQuiz) return null;
  if (variantIndex === 0 || !baseQuiz.alternates) return baseQuiz;
  if (variantIndex - 1 < baseQuiz.alternates.length) {
    return baseQuiz.alternates[variantIndex - 1];
  }
  return baseQuiz;
}

function setEquals(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((x) => bSet.has(x));
}

/**
 * The variant the user actually answered. quiz.tsx shows getVariant(quizId,
 * attemptCount) and only increments attemptCount on a wrong answer — so a
 * correct response was answered on variant `attemptCount`, a wrong one on
 * `attemptCount - 1`.
 */
function answeredVariant(quizId: string, payload: QuizResponsePayload) {
  const variantIndex = payload.isCorrect
    ? payload.attemptCount
    : Math.max(0, payload.attemptCount - 1);
  return getVariant(quizId, variantIndex);
}

/**
 * Server-side recompute of correctness. A client claiming `isCorrect` only
 * gets a correct row if the selected answers actually match the answered
 * variant's correctAnswers. A client claiming incorrect is never upgraded.
 */
function computeStoredCorrect(quizId: string, payload: QuizResponsePayload): boolean {
  if (!payload.isCorrect) return false;
  const variant = answeredVariant(quizId, payload);
  if (!variant) return false;
  return setEquals(payload.selectedAnswers, variant.correctAnswers);
}

/**
 * Quiz-content validation only — shape validation (types, bounds) lives in
 * the Zod schemas at the API boundary. What stays here is everything that
 * needs the quiz catalog: the id must exist, and the selection must fit the
 * answered variant's option list (no out-of-range indices, no duplicates,
 * which also caps the stored array at the variant's option count).
 */
function validatePayload(quizId: string, payload: QuizResponsePayload): void {
  if (!quizData.quizzes[quizId]) {
    throw new QuizProgressValidationError(`Unknown quiz id: ${quizId}`);
  }
  const variant = answeredVariant(quizId, payload);
  const optionCount = variant?.options.length ?? 0;
  if (payload.selectedAnswers.some((x) => x >= optionCount)) {
    throw new QuizProgressValidationError("selectedAnswers out of range for this quiz");
  }
  if (new Set(payload.selectedAnswers).size !== payload.selectedAnswers.length) {
    throw new QuizProgressValidationError("selectedAnswers must not contain duplicates");
  }
}

function toDTO(row: {
  quiz_id: string;
  selected_answers: number[];
  is_answer_checked: boolean;
  is_correct: boolean;
  attempt_count: number;
  last_attempt_at: Date | null;
}): QuizResponseDTO {
  return {
    quizId: row.quiz_id,
    selectedAnswers: row.selected_answers,
    isAnswerChecked: row.is_answer_checked,
    isCorrect: row.is_correct,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at ? row.last_attempt_at.getTime() : null,
  };
}

export async function getQuizProgressForUser(userId: string): Promise<QuizResponseDTO[]> {
  const rows = await prisma.quizResponse.findMany({
    where: { user_id: userId },
  });
  return rows.map(toDTO);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Upsert one quiz response. Correctness is recomputed server-side, and a row
 * that is already correct is frozen — later writes (including the client's
 * 24h auto-reset) never downgrade it. The freeze is enforced atomically: the
 * update carries `is_correct: false` in its WHERE, so a concurrent writer can
 * never overwrite a just-written correct row (read-then-write would race).
 */
export async function upsertQuizResponse(
  userId: string,
  quizId: string,
  payload: QuizResponsePayload
): Promise<QuizResponseDTO> {
  validatePayload(quizId, payload);

  const data = {
    selected_answers: payload.selectedAnswers,
    is_answer_checked: payload.isAnswerChecked,
    is_correct: computeStoredCorrect(quizId, payload),
    attempt_count: payload.attemptCount,
    last_attempt_at: payload.lastAttemptAt ? new Date(payload.lastAttemptAt) : null,
  };

  const updated = await prisma.quizResponse.updateMany({
    where: { user_id: userId, quiz_id: quizId, is_correct: false },
    data,
  });

  if (updated.count === 0) {
    // Either the row doesn't exist yet, or it exists and is frozen correct.
    try {
      const created = await prisma.quizResponse.create({
        data: { user_id: userId, quiz_id: quizId, ...data },
      });
      return toDTO(created);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Frozen row (or a concurrent create won the race): return what's stored.
    }
  }

  const row = await prisma.quizResponse.findUnique({
    where: { user_id_quiz_id: { user_id: userId, quiz_id: quizId } },
  });
  if (!row) {
    // Only reachable if the row was deleted between statements.
    throw new Error(`Quiz response disappeared during upsert: ${quizId}`);
  }
  return toDTO(row);
}

/**
 * True when every quiz currently belonging to the course has a correct row
 * for this user. Course membership is read from the quiz JSON at call time,
 * so course changes need no data migration.
 */
export async function hasCompletedCourse(userId: string, courseId: string): Promise<boolean> {
  const courseQuizzes = quizData.courses[courseId]?.quizzes;
  if (!courseQuizzes || courseQuizzes.length === 0) return false;

  const correctCount = await prisma.quizResponse.count({
    where: {
      user_id: userId,
      quiz_id: { in: courseQuizzes },
      is_correct: true,
    },
  });
  return correctCount === courseQuizzes.length;
}
