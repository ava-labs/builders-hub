import { describe, expect, it, vi, beforeEach } from 'vitest';

const { dbMocks } = vi.hoisted(() => ({
  dbMocks: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    quizResponse: {
      findUnique: dbMocks.findUnique,
      findMany: dbMocks.findMany,
      upsert: dbMocks.upsert,
      count: dbMocks.count,
    },
  },
}));

// Hermetic quiz fixture so tests do not depend on real course content.
// q1: single-answer, no alternates. q2: multi-answer with one alternate —
// mirrors the avalanche-fundamentals 1202 shape.
vi.mock('@/components/quizzes/data', () => ({
  default: {
    quizzes: {
      q1: {
        question: 'base q1',
        options: ['a', 'b', 'c', 'd'],
        correctAnswers: [1],
        hint: '',
        explanation: '',
        chapter: 'ch',
      },
      q2: {
        question: 'base q2',
        options: ['a', 'b', 'c', 'd', 'e', 'f'],
        correctAnswers: [0, 2],
        hint: '',
        explanation: '',
        chapter: 'ch',
        alternates: [
          {
            question: 'alternate q2',
            options: ['a', 'b', 'c', 'd'],
            correctAnswers: [2],
            hint: '',
            explanation: '',
          },
        ],
      },
    },
    courses: {
      'course-a': { title: 'Course A', quizzes: ['q1', 'q2'] },
      'course-empty': { title: 'Empty', quizzes: [] },
    },
  },
}));

import {
  upsertQuizResponse,
  getQuizProgressForUser,
  hasCompletedCourse,
  QuizProgressValidationError,
} from '@/server/services/quizProgress';

const upsertedRow = (over: Record<string, unknown> = {}) => ({
  quiz_id: 'q1',
  selected_answers: [1],
  is_answer_checked: true,
  is_correct: true,
  attempt_count: 0,
  last_attempt_at: null,
  ...over,
});

beforeEach(() => {
  Object.values(dbMocks).forEach((m) => m.mockReset());
  dbMocks.findUnique.mockResolvedValue(null);
  dbMocks.upsert.mockImplementation(async ({ create }: any) => ({
    quiz_id: create.quiz_id,
    ...create,
  }));
});

describe('upsertQuizResponse — server-side correctness recompute', () => {
  it('stores correct when the claim matches the base variant', async () => {
    await upsertQuizResponse('user-1', 'q1', {
      selectedAnswers: [1],
      isAnswerChecked: true,
      isCorrect: true,
      attemptCount: 0,
      lastAttemptAt: null,
    });

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ is_correct: true }),
      }),
    );
  });

  it('validates against the alternate variant when attemptCount says so', async () => {
    // attemptCount 1 + correct claim → answered variant is alternates[0],
    // whose correctAnswers are [2] (base would require [0, 2])
    await upsertQuizResponse('user-1', 'q2', {
      selectedAnswers: [2],
      isAnswerChecked: true,
      isCorrect: true,
      attemptCount: 1,
      lastAttemptAt: null,
    });

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ is_correct: true }),
      }),
    );
  });

  it('downgrades a correct claim whose answers do not match', async () => {
    await upsertQuizResponse('user-1', 'q1', {
      selectedAnswers: [0],
      isAnswerChecked: true,
      isCorrect: true, // client lies
      attemptCount: 0,
      lastAttemptAt: null,
    });

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ is_correct: false }),
      }),
    );
  });

  it('never upgrades an incorrect claim even if the answers happen to match', async () => {
    await upsertQuizResponse('user-1', 'q1', {
      selectedAnswers: [1],
      isAnswerChecked: true,
      isCorrect: false,
      attemptCount: 1,
      lastAttemptAt: null,
    });

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ is_correct: false }),
      }),
    );
  });

  it('freezes an already-correct row instead of overwriting it', async () => {
    dbMocks.findUnique.mockResolvedValue(
      upsertedRow({ is_correct: true, selected_answers: [1] }),
    );

    const result = await upsertQuizResponse('user-1', 'q1', {
      selectedAnswers: [],
      isAnswerChecked: false,
      isCorrect: false,
      attemptCount: 0,
      lastAttemptAt: null,
    });

    expect(result.isCorrect).toBe(true);
    expect(dbMocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects unknown quiz ids', async () => {
    await expect(
      upsertQuizResponse('user-1', 'nope', {
        selectedAnswers: [0],
        isAnswerChecked: true,
        isCorrect: false,
        attemptCount: 1,
        lastAttemptAt: null,
      }),
    ).rejects.toThrow(QuizProgressValidationError);
  });

  it('rejects selectedAnswers outside the answered variant option range', async () => {
    // attemptCount 1 + incorrect → answered variant is base q2 (6 options is
    // fine) — but for q1 (4 options) index 4 is out of range
    await expect(
      upsertQuizResponse('user-1', 'q1', {
        selectedAnswers: [4],
        isAnswerChecked: true,
        isCorrect: false,
        attemptCount: 1,
        lastAttemptAt: null,
      }),
    ).rejects.toThrow(QuizProgressValidationError);
  });

  it('rejects attemptCount outside 0..3', async () => {
    await expect(
      upsertQuizResponse('user-1', 'q1', {
        selectedAnswers: [1],
        isAnswerChecked: true,
        isCorrect: false,
        attemptCount: 7,
        lastAttemptAt: null,
      }),
    ).rejects.toThrow(QuizProgressValidationError);
  });
});

describe('getQuizProgressForUser', () => {
  it('maps rows to the client-facing shape', async () => {
    const when = new Date('2026-08-06T12:00:00Z');
    dbMocks.findMany.mockResolvedValue([
      upsertedRow({ quiz_id: 'q2', attempt_count: 2, last_attempt_at: when }),
    ]);

    const result = await getQuizProgressForUser('user-1');

    expect(result).toEqual([
      {
        quizId: 'q2',
        selectedAnswers: [1],
        isAnswerChecked: true,
        isCorrect: true,
        attemptCount: 2,
        lastAttemptAt: when.getTime(),
      },
    ]);
  });
});

describe('hasCompletedCourse', () => {
  it('is true when every course quiz has a correct row', async () => {
    dbMocks.count.mockResolvedValue(2);
    await expect(hasCompletedCourse('user-1', 'course-a')).resolves.toBe(true);
    expect(dbMocks.count).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        quiz_id: { in: ['q1', 'q2'] },
        is_correct: true,
      },
    });
  });

  it('is false when any course quiz is missing', async () => {
    dbMocks.count.mockResolvedValue(1);
    await expect(hasCompletedCourse('user-1', 'course-a')).resolves.toBe(false);
  });

  it('is false for unknown or empty courses', async () => {
    await expect(hasCompletedCourse('user-1', 'course-empty')).resolves.toBe(false);
    await expect(hasCompletedCourse('user-1', 'nope')).resolves.toBe(false);
    expect(dbMocks.count).not.toHaveBeenCalled();
  });
});
