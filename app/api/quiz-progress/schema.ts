import { z } from "zod";

// Shape validation for the quiz-progress endpoints. Quiz-content checks
// (unknown id, option range, duplicates) live in the service, which owns the
// quiz catalog. attemptCount's upper bound mirrors MAX_ATTEMPTS in
// components/quizzes/quiz.tsx.
export const quizResponseSchema = z.object({
  selectedAnswers: z.array(z.number().int().min(0)).max(32).default([]),
  isAnswerChecked: z.boolean().default(false),
  isCorrect: z.boolean().default(false),
  attemptCount: z.number().int().min(0).max(3).default(0),
  lastAttemptAt: z.number().min(0).nullable().default(null),
});

export const bulkQuizResponseSchema = z
  .array(quizResponseSchema.extend({ quizId: z.string().min(1) }))
  .max(500);
