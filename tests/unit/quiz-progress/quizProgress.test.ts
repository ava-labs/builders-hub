import { describe, expect, it, vi, beforeEach } from 'vitest';

const { dbMocks, badgeMock } = vi.hoisted(() => ({
  dbMocks: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  badgeMock: vi.fn(),
}));

vi.mock('@/server/services/badge', () => ({
  assignBadgeAcademy: badgeMock,
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    quizResponse: {
      findUnique: dbMocks.findUnique,
      findMany: dbMocks.findMany,
      updateMany: dbMocks.updateMany,
      create: dbMocks.create,
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

const dbRow = (over: Record<string, unknown> = {}) => ({
  quiz_id: 'q1',
  selected_answers: [1],
  is_answer_checked: true,
  is_correct: true,
  attempt_count: 0,
  last_attempt_at: null,
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  selectedAnswers: [1],
  isAnswerChecked: true,
  isCorrect: true,
  attemptCount: 0,
  lastAttemptAt: null,
  ...over,
});

beforeEach(() => {
  Object.values(dbMocks).forEach((m) => m.mockReset());
  badgeMock.mockReset();
  // Default: no existing row — updateMany matches nothing, create succeeds,
  // and the course is not yet complete (count 0)
  dbMocks.updateMany.mockResolvedValue({ count: 0 });
  dbMocks.create.mockImplementation(async ({ data }: any) => data);
  dbMocks.findUnique.mockResolvedValue(null);
  dbMocks.count.mockResolvedValue(0);
  badgeMock.mockResolvedValue({ success: true });
});

describe('upsertQuizResponse — server-side correctness recompute', () => {
  it('stores correct when the claim matches the base variant', async () => {
    const result = await upsertQuizResponse('user-1', 'q1', payload());

    expect(result.isCorrect).toBe(true);
    expect(dbMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_correct: true }),
      }),
    );
  });

  it('validates against the alternate variant when attemptCount says so', async () => {
    // attemptCount 1 + correct claim → answered variant is alternates[0],
    // whose correctAnswers are [2] (base would require [0, 2])
    const result = await upsertQuizResponse('user-1', 'q2', payload({
      selectedAnswers: [2],
      attemptCount: 1,
    }));

    expect(result.isCorrect).toBe(true);
  });

  it('downgrades a correct claim whose answers do not match', async () => {
    const result = await upsertQuizResponse('user-1', 'q1', payload({
      selectedAnswers: [0], // client lies about isCorrect
    }));

    expect(result.isCorrect).toBe(false);
  });

  it('never upgrades an incorrect claim even if the answers happen to match', async () => {
    const result = await upsertQuizResponse('user-1', 'q1', payload({
      isCorrect: false,
      attemptCount: 1,
    }));

    expect(result.isCorrect).toBe(false);
  });

  it('updates through a WHERE that excludes frozen-correct rows', async () => {
    dbMocks.updateMany.mockResolvedValue({ count: 1 });
    dbMocks.findUnique.mockResolvedValue(dbRow({ is_correct: false }));

    await upsertQuizResponse('user-1', 'q1', payload({ isCorrect: false }));

    expect(dbMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1', quiz_id: 'q1', is_correct: false },
      }),
    );
    expect(dbMocks.create).not.toHaveBeenCalled();
  });

  it('returns the frozen row when a concurrent/frozen write loses the race', async () => {
    // updateMany matched nothing (row is frozen correct), create hits the
    // unique constraint, the stored row is returned untouched
    dbMocks.updateMany.mockResolvedValue({ count: 0 });
    dbMocks.create.mockRejectedValue({ code: 'P2002' });
    dbMocks.findUnique.mockResolvedValue(dbRow({ is_correct: true }));

    const result = await upsertQuizResponse('user-1', 'q1', payload({
      selectedAnswers: [],
      isAnswerChecked: false,
      isCorrect: false,
    }));

    expect(result.isCorrect).toBe(true);
  });

  it('rejects unknown quiz ids', async () => {
    await expect(
      upsertQuizResponse('user-1', 'nope', payload({ isCorrect: false })),
    ).rejects.toThrow(QuizProgressValidationError);
  });

  it('rejects selectedAnswers outside the answered variant option range', async () => {
    await expect(
      upsertQuizResponse('user-1', 'q1', payload({
        selectedAnswers: [4], // q1 has 4 options: valid indices 0-3
        isCorrect: false,
        attemptCount: 1,
      })),
    ).rejects.toThrow(QuizProgressValidationError);
  });

  it('rejects duplicate selectedAnswers', async () => {
    await expect(
      upsertQuizResponse('user-1', 'q1', payload({
        selectedAnswers: [1, 1],
        isCorrect: false,
      })),
    ).rejects.toThrow(QuizProgressValidationError);
  });
});

describe('upsertQuizResponse — server-driven course completion (auto-award)', () => {
  it('awards the academy badge when a correct write completes a course', async () => {
    dbMocks.count.mockResolvedValue(2); // both q1 and q2 now correct

    const result = await upsertQuizResponse('user-1', 'q1', payload());

    expect(result.completedCourses).toEqual(['course-a']);
    expect(badgeMock).toHaveBeenCalledWith({ userId: 'user-1', courseId: 'course-a' });
  });

  it('does not award when the course is still incomplete', async () => {
    dbMocks.count.mockResolvedValue(1); // q2 still missing

    const result = await upsertQuizResponse('user-1', 'q1', payload());

    expect(result.completedCourses).toEqual([]);
    expect(badgeMock).not.toHaveBeenCalled();
  });

  it('does not even check completion for an incorrect write', async () => {
    const result = await upsertQuizResponse('user-1', 'q1', payload({
      selectedAnswers: [0],
      isCorrect: false,
      attemptCount: 1,
    }));

    expect(result.completedCourses).toBeUndefined();
    expect(dbMocks.count).not.toHaveBeenCalled();
    expect(badgeMock).not.toHaveBeenCalled();
  });

  it('stores the response even when the badge award fails', async () => {
    dbMocks.count.mockResolvedValue(2);
    badgeMock.mockRejectedValue(new Error('badge service down'));

    const result = await upsertQuizResponse('user-1', 'q1', payload());

    expect(result.isCorrect).toBe(true);
    expect(result.completedCourses).toEqual(['course-a']);
  });
});

describe('getQuizProgressForUser', () => {
  it('maps rows to the client-facing shape', async () => {
    const when = new Date('2026-08-06T12:00:00Z');
    dbMocks.findMany.mockResolvedValue([
      dbRow({ quiz_id: 'q2', attempt_count: 2, last_attempt_at: when }),
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
