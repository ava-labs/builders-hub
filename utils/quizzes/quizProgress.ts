import { getQuizResponse } from "./indexedDB";

interface QuizProgress {
  [quizId: string]: boolean;
}

export async function getQuizProgress(quizIds: string[]): Promise<QuizProgress> {
  const progress: QuizProgress = {};

  for (const quizId of quizIds) {
    const response = await getQuizResponse(quizId);
    progress[quizId] = response ? response.isCorrect : false;
  }

  return progress;
}

export function calculateCompletionRate(progress: QuizProgress): number {
  const totalQuizzes = Object.keys(progress).length;
  const completedQuizzes = Object.values(progress).filter(Boolean).length;
  return (completedQuizzes / totalQuizzes) * 100;
}

export function isEligibleForCertificate(progress: QuizProgress, threshold: number = 80): boolean {
  const completionRate = calculateCompletionRate(progress);
  return completionRate >= threshold;
}
