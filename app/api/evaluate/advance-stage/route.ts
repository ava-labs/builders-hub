import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const advanceStageSchema = z
  .object({
    formDataIds: z.array(z.string()).optional(),
    formDataId: z.string().optional(),
    stage: z.number().int().min(0).max(4, 'stage must be an integer between 0 and 4'),
  })
  .refine((data) => (data.formDataIds && data.formDataIds.length > 0) || data.formDataId, {
    message: 'formDataId or formDataIds required',
  });

type AdvanceStageBody = z.infer<typeof advanceStageSchema>;

// ---------------------------------------------------------------------------
// POST /api/evaluate/advance-stage
// ---------------------------------------------------------------------------

export const POST = withApi<AdvanceStageBody>(
  async (_req: NextRequest, { body }) => {
    const ids = body.formDataIds ?? (body.formDataId ? [body.formDataId] : []);

    const result = await prisma.formData.updateMany({
      where: { id: { in: ids } },
      data: { current_stage: body.stage },
    });

    return successResponse({ updated: result.count, stage: body.stage });
  },
  { auth: true, roles: ['devrel'], schema: advanceStageSchema },
);
