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

function validatePayload(quizId: string, payload: QuizResponsePayload): void {
  if (!quizData.quizzes[quizId]) {
    throw new QuizProgressValidationError(`Unknown quiz id: ${quizId}`);
  }
  if (!Array.isArray(payload.selectedAnswers) ||
      payload.selectedAnswers.some((x) => !Number.isInteger(x) || x < 0)) {
    throw new QuizProgressValidationError("selectedAnswers must be non-negative integers");
  }
  const variant = answeredVariant(quizId, payload);
  const optionCount = variant?.options.length ?? 0;
  if (payload.selectedAnswers.some((x) => x >= optionCount)) {
    throw new QuizProgressValidationError("selectedAnswers out of range for this quiz");
  }
  if (!Number.isInteger(payload.attemptCount) ||
      payload.attemptCount < 0 || payload.attemptCount > MAX_ATTEMPTS) {
    throw new QuizProgressValidationError(`attemptCount must be between 0 and ${MAX_ATTEMPTS}`);
  }
  if (payload.lastAttemptAt !== null &&
      (typeof payload.lastAttemptAt !== "number" || payload.lastAttemptAt < 0)) {
    throw new QuizProgressValidationError("lastAttemptAt must be a timestamp or null");
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

/**
 * Upsert one quiz response. Correctness is recomputed server-side, and a row
 * that is already correct is frozen — later writes (including the client's
 * 24h auto-reset) never downgrade it.
 */
export async function upsertQuizResponse(
  userId: string,
  quizId: string,
  payload: QuizResponsePayload
): Promise<QuizResponseDTO> {
  validatePayload(quizId, payload);

  const existing = await prisma.quizResponse.findUnique({
    where: { user_id_quiz_id: { user_id: userId, quiz_id: quizId } },
  });
  if (existing?.is_correct) {
    return toDTO(existing);
  }

  const data = {
    selected_answers: payload.selectedAnswers,
    is_answer_checked: payload.isAnswerChecked,
    is_correct: computeStoredCorrect(quizId, payload),
    attempt_count: payload.attemptCount,
    last_attempt_at: payload.lastAttemptAt ? new Date(payload.lastAttemptAt) : null,
  };

  const row = await prisma.quizResponse.upsert({
    where: { user_id_quiz_id: { user_id: userId, quiz_id: quizId } },
    create: { user_id: userId, quiz_id: quizId, ...data },
    update: data,
  });
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
