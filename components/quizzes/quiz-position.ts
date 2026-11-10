/** Every Quiz root carries this attribute (components/quizzes/quiz.tsx), in the server markup too. */
export const QUIZ_ROOT_SELECTOR = '[data-quiz-root]';

/** The most quizzes a page may have for the header to draw one segment per quiz; above it the count is text only. */
export const MAX_QUIZ_SEGMENTS = 20;

export interface QuizPosition {
  /** 1-based position of the quiz among the page's quizzes, in document order. */
  index: number;
  /** Number of quizzes on the page. */
  count: number;
}

/**
 * Position of `root` among `roots`, the page's quiz roots in document order. Null when the page has
 * one quiz, so the header shows no count, or when `root` is not one of `roots`.
 */
export function quizPosition<T>(roots: readonly T[], root: T): QuizPosition | null {
  const index = roots.indexOf(root);
  if (index === -1 || roots.length < 2) return null;
  return { index: index + 1, count: roots.length };
}

/**
 * One segment per quiz on the page, on (red) up to and including the current quiz. Empty when the page
 * has more than MAX_QUIZ_SEGMENTS quizzes, so the header shows "Question N of M" as text only.
 */
export function quizSegments(position: QuizPosition): boolean[] {
  if (position.count > MAX_QUIZ_SEGMENTS) return [];
  return Array.from({ length: position.count }, (_, k) => k < position.index);
}
