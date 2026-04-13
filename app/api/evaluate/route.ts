import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ALLOWED_VERDICTS = ['top', 'strong', 'maybe', 'weak', 'reject'] as const;

const _evaluationSchema = z.object({
  formDataId: z.string().min(1, 'formDataId is required'),
  verdict: z.enum(ALLOWED_VERDICTS),
  comment: z.string().optional(),
  scoreOverall: z
    .number()
    .min(1)
    .max(5)
    .refine((v) => v % 0.5 === 0, 'scoreOverall must be in 0.5 increments')
    .optional(),
  scores: z.record(z.string(), z.number().min(1).max(5)).optional(),
  stage: z.number().int().min(0).max(4).optional().default(0),
});

type EvaluationBody = z.infer<typeof _evaluationSchema>;

// ---------------------------------------------------------------------------
// POST /api/evaluate
// ---------------------------------------------------------------------------

export const POST = withApi<EvaluationBody>(
  async (_req: NextRequest, { session, body }) => {
    const evaluation = await prisma.evaluation.upsert({
      where: {
        form_data_id_evaluator_id_stage: {
          form_data_id: body.formDataId,
          evaluator_id: session.user.id,
          stage: body.stage,
        },
      },
      update: {
        verdict: body.verdict,
        comment: body.comment ?? null,
        score_overall: body.scoreOverall ?? null,
        scores: body.scores ?? undefined,
      },
      create: {
        form_data_id: body.formDataId,
        evaluator_id: session.user.id,
        stage: body.stage,
        verdict: body.verdict,
        comment: body.comment ?? null,
        score_overall: body.scoreOverall ?? null,
        scores: body.scores ?? undefined,
      },
    });

    return successResponse({
      id: evaluation.id,
      verdict: evaluation.verdict,
      comment: evaluation.comment,
      stage: evaluation.stage,
    });
  },
  { auth: true, roles: ['judge', 'devrel'], schema: _evaluationSchema },
);
