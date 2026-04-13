import { z } from 'zod';
import {
  withApi,
  ValidationError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  successResponse,
} from '@/lib/api';
import { EMAIL_REGEX, NODE_ID_REGEX } from '@/lib/api/constants';
import { prisma } from '@/prisma/prisma';
import type { ValidatorP2P, L1ValidatorData } from '@/types/validator-alerts';
import {
  fetchLatestRelease,
  checkSingleAlert,
  fetchL1Validators,
  checkL1Alert,
  sendWelcomeEmail,
} from '@/server/services/validator-alert-check';
import { getAllMainnetSubnetIds } from '@/server/services/l1-chain-metadata';

const P2P_API_URL = 'https://52.203.183.9.sslip.io/api/validators';
const MAX_ALERTS_PER_USER = 20;
const MAX_CREATES_PER_HOUR = 10;

const createAlertSchema = z.object({
  node_id: z
    .string()
    .max(60)
    .regex(NODE_ID_REGEX, 'Invalid NodeID format. Must start with "NodeID-" followed by a valid base58 string.'),
  subnet_id: z.string().optional(),
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
});

type CreateAlertBody = z.infer<typeof createAlertSchema>;

export const GET = withApi(
  async (_req, { session }) => {
    const alerts = await prisma.validatorAlert.findMany({
      where: { user_id: session.user.id },
      include: {
        alert_logs: {
          orderBy: { sent_at: 'desc' },
          take: 10,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return successResponse(alerts);
  },
  { auth: true },
);

export const POST = withApi<CreateAlertBody>(
  async (req, { session, body }) => {
    const email = body.email ?? session.user.email;
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ValidationError('A valid email address is required.');
    }

    // Verify the node exists -- check Primary Network and/or L1 depending on request.
    let detectedSubnetId = 'primary';
    let validators: ValidatorP2P[] = [];
    let primaryLookupAvailable = false;

    const upstreamRes = await fetch(P2P_API_URL);
    if (upstreamRes.ok) {
      validators = await upstreamRes.json();
      primaryLookupAvailable = true;
    }

    const isPrimaryValidator =
      primaryLookupAvailable &&
      Array.isArray(validators) &&
      validators.some((v: { node_id: string }) => v.node_id === body.node_id);
    const preferredSubnetId = body.subnet_id?.trim();
    const wantsPrimaryOnly = preferredSubnetId === 'primary';
    const wantsSpecificL1 = preferredSubnetId && preferredSubnetId !== 'primary';
    let foundOnL1 = false;

    if (wantsPrimaryOnly) {
      if (!primaryLookupAvailable) {
        throw new BadRequestError('Primary Network validator lookup is currently unavailable. Please try again.');
      }
      if (!isPrimaryValidator) {
        throw new NotFoundError(`Validator ${body.node_id} not found in the Primary Network active validator set.`);
      }
      detectedSubnetId = 'primary';
    } else if (wantsSpecificL1 || !isPrimaryValidator) {
      const subnetIds = wantsSpecificL1 ? [preferredSubnetId] : getAllMainnetSubnetIds();

      for (const subnetId of subnetIds) {
        try {
          const l1Res = await fetch(`${req.nextUrl.origin}/api/chain-validators/${subnetId}`);
          if (!l1Res.ok) continue;
          const l1Data = await l1Res.json();
          const match =
            Array.isArray(l1Data.validators) &&
            l1Data.validators.some((v: { nodeId: string }) => v.nodeId === body.node_id);
          if (match) {
            detectedSubnetId = subnetId;
            foundOnL1 = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundOnL1) {
        if (wantsSpecificL1) {
          throw new NotFoundError(`Validator ${body.node_id} not found in L1 subnet ${preferredSubnetId}.`);
        }
        if (!primaryLookupAvailable) {
          throw new BadRequestError(
            'Primary validator lookup is currently unavailable and the validator was not found on known L1s.',
          );
        }
        throw new NotFoundError(`Validator ${body.node_id} not found in the Primary Network or any known L1.`);
      }
    } else {
      detectedSubnetId = 'primary';
    }

    const isL1 = detectedSubnetId !== 'primary';
    const primaryValidator = validators.find((v: ValidatorP2P) => v.node_id === body.node_id) ?? null;

    if (!isL1 && body.balance_alert === true) {
      throw new BadRequestError('Balance alerts are only available for L1 validators.');
    }

    // Rate limiting + duplicate check + create in a serializable transaction
    const userId = session.user.id;
    const txResult = await prisma.$transaction(
      async (tx) => {
        const existingCount = await tx.validatorAlert.count({
          where: { user_id: userId },
        });
        if (existingCount >= MAX_ALERTS_PER_USER) {
          return {
            error: `You can have at most ${MAX_ALERTS_PER_USER} validator alerts.`,
            kind: 'rate_limit' as const,
          };
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCreates = await tx.validatorAlert.count({
          where: { user_id: userId, created_at: { gte: oneHourAgo } },
        });
        if (recentCreates >= MAX_CREATES_PER_HOUR) {
          return { error: 'Too many alerts created recently. Please try again later.', kind: 'rate_limit' as const };
        }

        const existing = await tx.validatorAlert.findUnique({
          where: { user_id_node_id_subnet_id: { user_id: userId, node_id: body.node_id, subnet_id: detectedSubnetId } },
        });
        if (existing) {
          return { error: 'You already have an alert configured for this validator.', kind: 'conflict' as const };
        }

        const alert = await tx.validatorAlert.create({
          data: {
            user_id: userId,
            node_id: body.node_id,
            subnet_id: detectedSubnetId,
            label: body.label ?? null,
            uptime_alert: isL1 ? false : (body.uptime_alert ?? true),
            uptime_threshold: body.uptime_threshold ?? 95,
            version_alert: body.version_alert ?? true,
            expiry_alert: isL1 ? false : (body.expiry_alert ?? true),
            expiry_days: body.expiry_days ?? 7,
            balance_alert: isL1 ? (body.balance_alert ?? true) : false,
            balance_threshold: body.balance_threshold ?? 5_000_000_000,
            balance_threshold_days: body.balance_threshold_days ?? 30,
            security_alert: isL1 ? false : (body.security_alert ?? false),
            last_known_ip: !isL1 ? (primaryValidator?.public_ip ?? null) : null,
            email,
          },
          include: { alert_logs: true },
        });

        return { alert };
      },
      { isolationLevel: 'Serializable' },
    );

    if ('error' in txResult) {
      if (txResult.kind === 'conflict') {
        throw new ConflictError(txResult.error);
      }
      throw new RateLimitError(txResult.error);
    }

    // Run immediate checks + welcome email after creation.
    const [releaseResult] = await Promise.allSettled([fetchLatestRelease()]);
    const latestRelease = releaseResult.status === 'fulfilled' ? releaseResult.value : null;

    let l1ValidatorForWelcome: L1ValidatorData | null = null;
    try {
      if (!isL1 && primaryValidator) {
        await checkSingleAlert(txResult.alert, primaryValidator, latestRelease);
      } else if (isL1) {
        const l1Validators = await fetchL1Validators(detectedSubnetId);
        l1ValidatorForWelcome = l1Validators.find((v) => v.nodeId === body.node_id) ?? null;
        if (l1ValidatorForWelcome) {
          await checkL1Alert(txResult.alert, l1ValidatorForWelcome, latestRelease);
        }
      }
    } catch {
      // Non-fatal -- the cron will catch it on the next run
    }

    try {
      if (!isL1) {
        await sendWelcomeEmail(txResult.alert, {
          primaryValidator,
          latestRelease,
        });
      } else {
        await sendWelcomeEmail(txResult.alert, {
          l1Validator: l1ValidatorForWelcome,
          latestRelease,
        });
      }
    } catch {
      // Non-fatal
    }

    const responseAlert = await prisma.validatorAlert.findUnique({
      where: { id: txResult.alert.id },
      include: {
        alert_logs: {
          orderBy: { sent_at: 'desc' },
          take: 20,
        },
      },
    });

    return successResponse(responseAlert ?? txResult.alert, 201);
  },
  { auth: true, schema: createAlertSchema },
);
