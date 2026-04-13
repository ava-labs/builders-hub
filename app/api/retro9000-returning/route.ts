import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/prisma/prisma';

const retro9000ReturningSchema = z.object({
  email: z.string().email('Email is required'),
  project_name: z.string().optional().default(''),
  project_type: z.string().optional().default(''),
  project_vertical: z.string().optional().default(''),
  project_website: z.string().nullable().optional().default(null),
  project_x_handle: z.string().nullable().optional().default(null),
  project_github: z.string().optional().default(''),
  project_hq: z.string().optional().default(''),
  project_continent: z.string().optional().default(''),
  media_kit: z.string().optional().default(''),
  previous_retro9000_snapshot_funding: z.string().nullable().optional().default(null),
  requested_funding_range: z.string().optional().default(''),
  eligibility_and_metrics: z.string().optional().default(''),
  requested_grant_size_budget: z.string().optional().default(''),
  changes_since_last_snapshot: z.string().optional().default(''),
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  pseudonym: z.string().nullable().optional().default(null),
  role: z.string().optional().default(''),
  x_account: z.string().optional().default(''),
  telegram: z.string().optional().default(''),
  linkedin: z.string().nullable().optional().default(null),
  github: z.string().nullable().optional().default(null),
  country: z.string().nullable().optional().default(null),
  other_url: z.string().nullable().optional().default(null),
  bio: z.string().optional().default(''),
  kyb_willing: z.string().optional().default(''),
  gdpr: z.boolean().optional().default(false),
  marketing_consent: z.boolean().optional().default(false),
});

// withApi: auth intentionally omitted — public form submission
export const POST = withApi<z.infer<typeof retro9000ReturningSchema>>(
  async (_req: NextRequest, { body }) => {
    const applicationData = body;

    const result = await prisma.retro9000ReturningApplication.upsert({
      where: { email: applicationData.email },
      update: {
        project_name: applicationData.project_name,
        project_type: applicationData.project_type,
        project_vertical: applicationData.project_vertical,
        project_website: applicationData.project_website,
        project_x_handle: applicationData.project_x_handle,
        project_github: applicationData.project_github,
        project_hq: applicationData.project_hq,
        project_continent: applicationData.project_continent,
        media_kit: applicationData.media_kit,
        previous_retro9000_snapshot_funding: applicationData.previous_retro9000_snapshot_funding,
        requested_funding_range: applicationData.requested_funding_range,
        eligibility_and_metrics: applicationData.eligibility_and_metrics,
        requested_grant_size_budget: applicationData.requested_grant_size_budget,
        changes_since_last_snapshot: applicationData.changes_since_last_snapshot,
        first_name: applicationData.first_name,
        last_name: applicationData.last_name,
        pseudonym: applicationData.pseudonym,
        role: applicationData.role,
        x_account: applicationData.x_account,
        telegram: applicationData.telegram,
        linkedin: applicationData.linkedin,
        github: applicationData.github,
        country: applicationData.country,
        other_url: applicationData.other_url,
        bio: applicationData.bio,
        kyb_willing: applicationData.kyb_willing,
        gdpr: applicationData.gdpr,
        marketing_consent: applicationData.marketing_consent,
      },
      create: applicationData,
    });

    return successResponse({ id: result.id });
  },
  { schema: retro9000ReturningSchema },
);
