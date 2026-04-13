// schema: not applicable — Zod validation done inline via safeParse for custom error handling
import { z } from 'zod';
import { withApi, ValidationError, BadRequestError, noContentResponse, successResponse } from '@/lib/api';
import { EMAIL_REGEX } from '@/lib/api/constants';
import { assertOwnership } from '@/lib/api/ownership';
import { prisma } from '@/prisma/prisma';
import type { UpdateAlertRequest } from '@/types/validator-alerts';

const idSchema = z.object({
  id: z.string().uuid('Invalid alert ID'),
});

const updateAlertSchema = z.object({
  label: z.string().optional(),
  uptime_alert: z.boolean().optional(),
  uptime_threshold: z.number().min(0).max(100, 'Uptime threshold must be between 0 and 100.').optional(),
  version_alert: z.boolean().optional(),
  expiry_alert: z.boolean().optional(),
  expiry_days: z.number().int().min(1).max(365, 'Expiry days must be between 1 and 365.').optional(),
  balance_alert: z.boolean().optional(),
  balance_threshold: z.number().positive('Balance threshold must be greater than 0.').finite().optional(),
  balance_threshold_days: z
    .number()
    .int()
    .min(1)
    .max(365, 'Balance threshold days must be between 1 and 365.')
    .optional(),
  security_alert: z.boolean().optional(),
  email: z.string().regex(EMAIL_REGEX, 'Invalid email address.').optional(),
  active: z.boolean().optional(),
});

function validateIdParam(params: Record<string, string>): string {
  const parsed = idSchema.safeParse(params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }
  return parsed.data.id;
}

export const GET = withApi(
  async (_req, { session, params }) => {
    const id = validateIdParam(params);
    const alert = await assertOwnership(prisma.validatorAlert, id, session.user.id, {
      include: { alert_logs: { orderBy: { sent_at: 'desc' }, take: 20 } },
    });

    return successResponse(alert);
  },
  { auth: true },
);

export const PUT = withApi(
  async (req, { session, params }) => {
    const id = validateIdParam(params);

    // Validate body BEFORE ownership check so invalid input is caught early
    const raw: unknown = await req.json();
    const parsed = updateAlertSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const body: UpdateAlertRequest = parsed.data;

    const existing = await assertOwnership<{ subnet_id: string }>(prisma.validatorAlert, id, session.user.id, {
      include: { alert_logs: { orderBy: { sent_at: 'desc' }, take: 20 } },
    });

    const isL1 = existing.subnet_id !== 'primary';

    // L1 validators don't have uptime or expiry -- reject attempts to enable
    if (isL1 && body.uptime_alert === true) {
      throw new BadRequestError('Uptime alerts are not available for L1 validators.');
    }
    if (isL1 && body.expiry_alert === true) {
      throw new BadRequestError('Stake expiry alerts are not available for L1 validators.');
    }
    if (!isL1 && body.balance_alert === true) {
      throw new BadRequestError('Balance alerts are only available for L1 validators.');
    }
    if (!isL1 && (body.balance_threshold !== undefined || body.balance_threshold_days !== undefined)) {
      throw new BadRequestError('Balance threshold settings are only available for L1 validators.');
    }
    if (isL1 && body.security_alert === true) {
      throw new BadRequestError('Security checks are currently available for Primary Network validators only.');
    }

    const updateData: Record<string, unknown> = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.uptime_alert !== undefined) updateData.uptime_alert = body.uptime_alert;
    if (body.uptime_threshold !== undefined) updateData.uptime_threshold = body.uptime_threshold;
    if (body.version_alert !== undefined) updateData.version_alert = body.version_alert;
    if (body.expiry_alert !== undefined) updateData.expiry_alert = body.expiry_alert;
    if (body.expiry_days !== undefined) updateData.expiry_days = body.expiry_days;
    if (body.balance_alert !== undefined) updateData.balance_alert = body.balance_alert;
    if (body.balance_threshold !== undefined) updateData.balance_threshold = body.balance_threshold;
    if (body.balance_threshold_days !== undefined) updateData.balance_threshold_days = body.balance_threshold_days;
    if (body.security_alert !== undefined) updateData.security_alert = body.security_alert;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.active !== undefined) updateData.active = body.active;

    const alert = await prisma.validatorAlert.update({
      where: { id },
      data: updateData,
      include: {
        alert_logs: {
          orderBy: { sent_at: 'desc' },
          take: 20,
        },
      },
    });

    return successResponse(alert);
  },
  { auth: true },
);

export const DELETE = withApi(
  async (_req, { session, params }) => {
    const id = validateIdParam(params);
    await assertOwnership(prisma.validatorAlert, id, session.user.id);

    await prisma.validatorAlert.delete({ where: { id } });

    return noContentResponse();
  },
  { auth: true },
);
