import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ALLOWED_VERDICTS = ['top', 'strong', 'maybe', 'weak', 'reject'] as const;

const finalVerdictSchema = z.object({
  formDataId: z.string().min(1, 'formDataId is required'),
  verdict: z.enum(ALLOWED_VERDICTS).nullable(),
});

type FinalVerdictBody = z.infer<typeof finalVerdictSchema>;

// ---------------------------------------------------------------------------
// POST /api/evaluate/final-verdict
// ---------------------------------------------------------------------------

export const POST = withApi<FinalVerdictBody>(
  async (_req: NextRequest, { body }) => {
    const updated = await prisma.formData.update({
      where: { id: body.formDataId },
      data: { final_verdict: body.verdict },
      select: { id: true, final_verdict: true },
    });

    return successResponse({ id: updated.id, finalVerdict: updated.final_verdict });
  },
  { auth: true, roles: ['devrel'], schema: finalVerdictSchema },
);
