import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
import {
  detectHtmlInjection,
  detectMarkdownInjection,
  detectDangerousUrl,
} from '@/utils/input-validator';

type StageSubmitValues = Record<
  string,
  string | string[] | boolean | Array<{ address: string }> | null
>;

type StageAnswer = {
  question_id: string;
  question_label: string;
  question_type: string;
  stage_index: number;
  answer: unknown;
};

type StageAnswerEnvelope = { answers: Record<string, StageAnswer> };

/** Allows alphanumeric, hyphens and underscores — covers UUID, CUID and nanoid formats. */
const SAFE_ID_RE = /^[a-zA-Z0-9_\-]{1,128}$/;

/** Standard EVM address: 0x followed by exactly 40 hex characters. */
const ETHEREUM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type SanitizeResult = { ok: true } | { ok: false; error: string };

/**
 * Server-side sanitization of stage form values.
 * Mirrors the client-side checks in utils/input-validator but runs on every
 * request regardless of how the payload was crafted.
 */
function sanitizeStageValues(values: StageSubmitValues): SanitizeResult {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) continue;

    if (typeof value === 'string') {
      if (detectHtmlInjection(value)) {
        return { ok: false, error: `Field "${key}" contains dangerous HTML or script content.` };
      }
      if (detectMarkdownInjection(value)) {
        return { ok: false, error: `Field "${key}" contains dangerous Markdown link content.` };
      }
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          if (detectHtmlInjection(item)) {
            return { ok: false, error: `Field "${key}" contains dangerous HTML or script content.` };
          }
          if (detectDangerousUrl(item)) {
            return { ok: false, error: `Field "${key}" contains a dangerous URL protocol.` };
          }
          continue;
        }

        // Address object: { address: string }
        if (typeof item === 'object' && item !== null && 'address' in item) {
          const addr = (item as { address: string }).address?.trim() ?? '';
          if (addr && !ETHEREUM_ADDRESS_RE.test(addr)) {
            return { ok: false, error: `Field "${key}" contains an invalid blockchain address.` };
          }
        }
      }
    }
  }

  return { ok: true };
}

type StageSubmitRequestBody = {
  hackathonId: string;
  projectId?: string;
  stageIndex: number;
  values: StageSubmitValues;
};

export const POST = withAuth(async (request: Request, _context, session) => {
  try {
    const body: StageSubmitRequestBody = await request.json();

    const hackathonId: string = body.hackathonId?.trim();
    const incomingProjectId: string = body.projectId?.trim() ?? '';
    const values: StageSubmitValues = body.values ?? {};

    if (!hackathonId) {
      return NextResponse.json({ error: 'hackathonId is required' }, { status: 400 });
    }

    if (!SAFE_ID_RE.test(hackathonId)) {
      return NextResponse.json({ error: 'Invalid hackathonId format' }, { status: 400 });
    }

    if (incomingProjectId && !SAFE_ID_RE.test(incomingProjectId)) {
      return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
    }

    if (!Number.isInteger(body.stageIndex) || body.stageIndex < 0) {
      return NextResponse.json({ error: 'Invalid stageIndex' }, { status: 400 });
    }

    const sanitizeResult = sanitizeStageValues(values);
    if (!sanitizeResult.ok) {
      return NextResponse.json({ error: sanitizeResult.error }, { status: 400 });
    }

    const sessionUserId: string = session.user.id;

    /**
     * SECURITY: Resolve the project outside the transaction so we can return
     * an early 404 without leaking a `NextResponse` through the transaction
     * return value.  Automatic project creation has been removed to prevent
     * unbounded resource creation (DoS).
     */
    let resolvedProject: { id: string; project_name: string } | null = null;

    if (incomingProjectId) {
      resolvedProject = await prisma.project.findFirst({
        where: {
          id: incomingProjectId,
          hackaton_id: hackathonId,
          members: { some: { user_id: sessionUserId } },
        },
        select: { id: true, project_name: true },
      });

      // SECURITY: If the caller specified a projectId and it was not found (or
      // does not belong to them), return 404 immediately. Do NOT fall back to
      // another project — that silent substitution risks overwriting a different
      // project's FormData with the current user's submission.
      if (!resolvedProject) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
    } else {
      resolvedProject = await prisma.project.findFirst({
        where: {
          hackaton_id: hackathonId,
          members: { some: { user_id: sessionUserId } },
        },
        select: { id: true, project_name: true },
        orderBy: { created_at: 'desc' },
      });
    }

    if (!resolvedProject) {
      /**
       * SECURITY: Do NOT create a project automatically.  Previously this
       * path created an unbounded number of "Draft Project" rows for any
       * authenticated user, enabling a DoS / resource-exhaustion attack.
       * Callers must create a project via the dedicated project-creation
       * endpoint before submitting stage data.
       */
      return NextResponse.json(
        { error: 'No project found for this hackathon. Please create a project first.' },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // SECURITY: Acquire a row-level lock on the parent Project before reading
      // FormData. Any concurrent transaction for the same projectId will block
      // here until this transaction commits, preventing the findFirst→create race
      // condition that could produce duplicate FormData rows.
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${resolvedProject.id} FOR UPDATE`;

      const existingFormData = await tx.formData.findFirst({
        where: {
          project_id: resolvedProject.id,
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          id: true,
          form_data: true,
        },
      });

      const hackathon = await tx.hackathon.findUnique({
        where: { id: hackathonId },
        select: { content: true },
      });
      const stageFields: Array<{ id?: string; label?: string; type?: string }> =
        (hackathon?.content as any)?.stages?.[body.stageIndex]?.submitForm?.fields ?? [];
      const fieldMeta = new Map<string, { label?: string; type?: string }>(
        stageFields
          .filter((f): f is { id: string; label?: string; type?: string } => typeof f?.id === 'string')
          .map((f) => [f.id, { label: f.label, type: f.type }]),
      );

      const newAnswers: Record<string, StageAnswer> = {};
      for (const [fieldId, answer] of Object.entries(values)) {
        const meta = fieldMeta.get(fieldId);
        newAnswers[fieldId] = {
          question_id: fieldId,
          question_label: meta?.label ?? fieldId,
          question_type: meta?.type ?? 'unknown',
          stage_index: body.stageIndex,
          answer,
        };
      }

      const existingFormDataValue = existingFormData?.form_data as
        | StageAnswerEnvelope
        | Record<string, unknown>
        | null;
      let existingAnswers: Record<string, StageAnswer>;
      if (
        existingFormDataValue &&
        typeof existingFormDataValue === 'object' &&
        'answers' in existingFormDataValue
      ) {
        existingAnswers = (existingFormDataValue as StageAnswerEnvelope).answers ?? {};
      } else if (existingFormDataValue && typeof existingFormDataValue === 'object') {
        existingAnswers = Object.fromEntries(
          Object.entries(existingFormDataValue as Record<string, unknown>).map(
            ([key, value]) => [
              key,
              {
                question_id: key,
                question_label: key,
                question_type: 'unknown',
                stage_index: body.stageIndex,
                answer: value,
              },
            ],
          ),
        );
      } else {
        existingAnswers = {};
      }
      const envelope: StageAnswerEnvelope = {
        answers: { ...existingAnswers, ...newAnswers },
      };

      const savedFormData = existingFormData
        ? await tx.formData.update({
            where: {
              id: existingFormData.id,
            },
            data: {
              form_data: envelope as unknown as Prisma.InputJsonValue,
              timestamp: new Date(),
              origin: 'stage-submit',
            },
            select: {
              id: true,
              project_id: true,
            },
          })
        : await tx.formData.create({
            data: {
              project_id: resolvedProject.id,
              form_data: envelope as unknown as Prisma.InputJsonValue,
              timestamp: new Date(),
              origin: 'stage-submit',
            },
            select: {
              id: true,
              project_id: true,
            },
          });
      const getStringValue = (...keys: string[]): string | undefined => {
        for (const key of keys) {
          const value = values[key];
          if (typeof value === 'string' && value.trim()) {
            return value;
          }
        }

        return undefined;
      };

      const getBooleanValue = (...keys: string[]): boolean | undefined => {
        for (const key of keys) {
          const value = values[key];
          if (typeof value === 'boolean') {
            return value;
          }
        }

        return undefined;
      };

      const getLinkValue = (...keys: string[]): string | undefined => {
        for (const key of keys) {
          const value = values[key];
          if (typeof value === 'string' && value.trim()) {
            return value;
          }

          if (Array.isArray(value)) {
            const links = value
              .filter((link): link is string => typeof link === 'string')
              .map((link) => link.trim())
              .filter(Boolean);

            if (links.length > 0) {
              return links.join(',');
            }
          }
        }

        return undefined;
      };

      const getStringArrayValue = (...keys: string[]): string[] | undefined => {
        for (const key of keys) {
          const value = values[key];
          if (Array.isArray(value)) {
            const items = value
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean);

            if (items.length > 0) {
              return items;
            }
          }

          if (typeof value === 'string' && value.trim()) {
            return [value];
          }
        }

        return undefined;
      };

      const getDeployedAddressesValue = (...keys: string[]): Array<{ address: string; tag?: string }> | undefined => {
        const items = getStringArrayValue(...keys);
        if (!items) {
          return undefined;
        }

        return items.map((item) => {
          try {
            const parsed = JSON.parse(item) as { address?: string; tag?: string };
            if (parsed && typeof parsed.address === 'string' && parsed.address.trim()) {
              return { address: parsed.address.trim(), ...(parsed.tag?.trim() ? { tag: parsed.tag.trim() } : {}) };
            }
          } catch {
            // not JSON — treat as plain address
          }
          return { address: item };
        });
      };

      let projectColumnsToUpdate: { [key: string]: unknown } = {};
      const projectColumnValues: Record<string, unknown> = {
        project_name: getStringValue('project_name', 'projectName'),
        short_description: getStringValue('short_description', 'shortDescription'),
        full_description: getStringValue('full_description', 'fullDescription'),
        deployed_addresses: getDeployedAddressesValue('deployed_addresses', 'deployedAddress'),
        categories: getStringArrayValue('categories'),
        github_repository: getLinkValue('github_repository', 'githubRepository'),
        demo_link: getLinkValue('demo_link', 'demoOtherLinks'),
        tech_stack: getStringValue('explanation', 'tech_stack', 'howItsMade'),
        explanation: getStringValue('howItsMade'),
        // Team1 sharing consent: persist to the real Project.consent_sharing
        // column (same as the non-staged submitProject flow) so staged
        // submissions record the consent identically, instead of leaving it
        // only inside the stage answer envelope.
        consent_sharing: getBooleanValue('consent_sharing'),
      };

      Object.entries(projectColumnValues).forEach(([column, value]) => {
        if (value !== undefined) {
          projectColumnsToUpdate[column] = value;
        }
      });

      const updatedProject = await tx.project.update({
        where: {
          id: resolvedProject.id,
        },
        data: {
          updated_at: new Date(),
          ...projectColumnsToUpdate,
        },
      });

      return {
        projectId: resolvedProject.id,
        project: updatedProject,
        formDataId: savedFormData.id,
      };
    });

    return NextResponse.json(
      {
        success: true,
        projectId: result.projectId,
        project: result.project,
        formDataId: result.formDataId,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : 'Unknown error';

    console.error('Error POST /api/project/stage-submit:', error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const GET = withAuth(async (request: Request, _context, session) => {
  try {
    const { searchParams } = new URL(request.url);

    const projectId: string = searchParams.get('projectId')?.trim() ?? '';

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    if (!SAFE_ID_RE.test(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
    }

    const sessionUserId: string = session.user.id;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        members: {
          some: {
            user_id: sessionUserId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    const formData = await prisma.formData.findFirst({
      where: {
        project_id: projectId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        id: true,
        form_data: true,
        timestamp: true,
        origin: true,
        project_id: true,
      },
    });

    const rawFormData = formData?.form_data as
      | StageAnswerEnvelope
      | Record<string, unknown>
      | null;
    const flatFormData =
      rawFormData && typeof rawFormData === 'object' && 'answers' in rawFormData
        ? Object.fromEntries(
            Object.entries((rawFormData as StageAnswerEnvelope).answers).map(
              ([fieldId, entry]) => [fieldId, entry.answer],
            ),
          )
        : rawFormData;

    return NextResponse.json(
      {
        success: true,
        formData: formData
          ? { ...formData, form_data: flatFormData }
          : null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : 'Unknown error';

    console.error('Error GET /api/project/form-data:', error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
