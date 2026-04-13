import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import {
  fetchValidators,
  fetchLatestRelease,
  fetchL1Validators,
  checkSingleAlert,
  checkL1Alert,
} from '@/server/services/validator-alert-check';
import type { L1ValidatorData } from '@/types/validator-alerts';

/**
 * Vercel CRON endpoint -- kept raw (no withApi) because it uses
 * custom CRON_SECRET / API-key auth rather than session auth.
 */
// withApi: not applicable — Vercel cron with CRON_SECRET auth
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('x-api-key');
  const isVercelCron = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isApiKey = process.env.VALIDATOR_ALERTS_API_KEY && apiKey === process.env.VALIDATOR_ALERTS_API_KEY;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dataErrors: string[] = [];

    const [validatorResult, releaseResult] = await Promise.allSettled([fetchValidators(), fetchLatestRelease()]);

    const validators =
      validatorResult.status === 'fulfilled'
        ? validatorResult.value
        : (() => {
            dataErrors.push(`P2P API error: ${validatorResult.reason}`);
            return [];
          })();

    const latestRelease =
      releaseResult.status === 'fulfilled'
        ? releaseResult.value
        : (() => {
            dataErrors.push(`GitHub API error: ${releaseResult.reason}`);
            return null;
          })();

    if (validators.length === 0 && !latestRelease) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentFailLog = await prisma.validatorAlertLog.findFirst({
        where: { alert_type: 'check_failed', sent_at: { gte: oneHourAgo } },
      });

      if (!recentFailLog) {
        const activeAlerts = await prisma.validatorAlert.findMany({ where: { active: true } });
        const errorMsg = `Alert check skipped: ${dataErrors.join('; ')}`;
        await Promise.all(
          activeAlerts.map((a) =>
            prisma.validatorAlertLog.create({
              data: { validator_alert_id: a.id, alert_type: 'check_failed', message: errorMsg },
            }),
          ),
        );
      }
      return NextResponse.json({ success: false, errors: dataErrors });
    }

    const validatorMap = new Map(validators.map((v) => [v.node_id, v]));

    const activeAlerts = await prisma.validatorAlert.findMany({
      where: { active: true },
    });

    const primaryAlerts = activeAlerts.filter((a) => a.subnet_id === 'primary');
    const l1AlertsBySubnet = new Map<string, typeof activeAlerts>();
    for (const alert of activeAlerts) {
      if (alert.subnet_id !== 'primary') {
        const group = l1AlertsBySubnet.get(alert.subnet_id) ?? [];
        group.push(alert);
        l1AlertsBySubnet.set(alert.subnet_id, group);
      }
    }

    let sent = 0;
    let checked = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const alert of primaryAlerts) {
      checked++;
      const validator = validatorMap.get(alert.node_id);
      if (!validator) {
        skipped++;
        continue;
      }
      const result = await checkSingleAlert(alert, validator, latestRelease);
      sent += result.sent;
      errors.push(...result.errors);
    }

    for (const [subnetId, alerts] of l1AlertsBySubnet) {
      let l1Validators: L1ValidatorData[] = [];
      try {
        l1Validators = await fetchL1Validators(subnetId);
      } catch (err) {
        errors.push(`Failed to fetch L1 validators for ${subnetId}: ${err}`);
        skipped += alerts.length;
        continue;
      }

      const l1Map = new Map(l1Validators.map((v) => [v.nodeId, v]));

      for (const alert of alerts) {
        checked++;
        const validator = l1Map.get(alert.node_id);
        if (!validator) {
          skipped++;
          continue;
        }
        const result = await checkL1Alert(alert, validator, latestRelease);
        sent += result.sent;
        errors.push(...result.errors);
      }
    }

    return NextResponse.json({
      success: true,
      checked,
      sent,
      skipped,
      release: latestRelease
        ? {
            tag: latestRelease.tag,
            type: latestRelease.type,
            deadline: latestRelease.deadline?.toISOString() ?? null,
          }
        : null,
      errors: [...dataErrors, ...errors].length > 0 ? [...dataErrors, ...errors] : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
