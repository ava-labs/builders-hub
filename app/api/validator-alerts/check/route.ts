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
import { getAutoRenewPeriods, stakeEndFor, type AutoRenewPeriods } from '@/server/services/validator-auto-renew';
import { sendPendingLegacyNotices } from '@/server/services/legacy-notice';
import { LEGACY_NOTIFY_SOURCE } from '@/server/services/legacy-validator-alerts';

export const maxDuration = 60;

// Log a `check_failed` marker for the given alerts, gated by a global 1-hour cooldown
async function logCheckFailed(
  alerts: { id: string }[],
  message: string
): Promise<number> {
  if (alerts.length === 0) return 0;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentFailLog = await prisma.validatorAlertLog.findFirst({
    where: { alert_type: 'check_failed', sent_at: { gte: oneHourAgo } },
  });
  if (recentFailLog) return 0;
  await Promise.all(
    alerts.map((a) =>
      prisma.validatorAlertLog.create({
        data: { validator_alert_id: a.id, alert_type: 'check_failed', message },
      })
    )
  );
  return alerts.length;
}

async function run(req: NextRequest) {
  // Authenticate: accept Vercel CRON_SECRET or custom API key
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('x-api-key');
  const isVercelCron =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isApiKey =
    process.env.VALIDATOR_ALERTS_API_KEY &&
    apiKey === process.env.VALIDATOR_ALERTS_API_KEY;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dataErrors: string[] = [];

    // Fetch data sources independently so one failure doesn't block the other.
    // The P-Chain read is one request per run: the public RPC bans bursts.
    const [validatorResult, releaseResult, autoRenewResult] = await Promise.allSettled([
      fetchValidators(),
      fetchLatestRelease(),
      // A fresh read (it refreshes the API's cache), with one retry like fetchValidators.
      getAutoRenewPeriods({ maxAgeMs: 0, attempts: 2 }),
    ]);

    const validators = validatorResult.status === 'fulfilled'
      ? validatorResult.value
      : (() => { dataErrors.push(`P2P API error: ${validatorResult.reason}`); return []; })();

    const latestRelease = releaseResult.status === 'fulfilled'
      ? releaseResult.value
      : (() => { dataErrors.push(`GitHub API error: ${releaseResult.reason}`); return null; })();

    // null: the auto-renew state is unknown, so this run sends only the 1-hour expiry alert.
    const autoRenewPeriods: AutoRenewPeriods | null = autoRenewResult.status === 'fulfilled'
      ? autoRenewResult.value
      : (() => { dataErrors.push(`P-Chain RPC error (only 1-hour expiry alerts sent): ${autoRenewResult.reason}`); return null; })();

    // If both sources failed, log to all active alerts (with 1-hour cooldown) and bail
    if (validators.length === 0 && !latestRelease) {
      const activeAlerts = await prisma.validatorAlert.findMany({ where: { active: true } });
      await logCheckFailed(activeAlerts, `Alert check skipped: ${dataErrors.join('; ')}`);
      return NextResponse.json({ success: false, errors: dataErrors });
    }

    const validatorMap = new Map(validators.map(v => [v.node_id, v]));

    // Imported Avalanche Notify alerts get their one-time notice first. Alerts whose
    // notice is not sent yet are skipped this run. If the notice step fails, skip every
    // imported alert, so nobody gets an alert before the notice.
    let noticesSent = 0;
    let isWithoutNotice: (alert: { id: string; source: string | null }) => boolean;
    try {
      const notices = await sendPendingLegacyNotices();
      noticesSent = notices.sent;
      if (notices.failed > 0) dataErrors.push(`Legacy notice: ${notices.failed} send(s) failed`);
      isWithoutNotice = (alert) => notices.withoutNotice.has(alert.id);
    } catch (err) {
      dataErrors.push(`Legacy notice error: ${err}`);
      isWithoutNotice = (alert) => alert.source === LEGACY_NOTIFY_SOURCE;
    }

    const activeAlerts = (
      await prisma.validatorAlert.findMany({
        where: { active: true },
      })
    ).filter((alert) => !isWithoutNotice(alert));

    // Partition alerts into primary vs L1
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

    const primaryUpstreamFailed = validators.length === 0 && primaryAlerts.length > 0;
    if (primaryUpstreamFailed) {
      const p2pError = dataErrors.find((e) => e.startsWith('P2P API error')) ?? 'P2P validator source unavailable';
      await logCheckFailed(primaryAlerts, `Primary validator check skipped: ${p2pError}`);
    } else {
      // --- Process Primary Network alerts ---
      for (const alert of primaryAlerts) {
        checked++;
        const validator = validatorMap.get(alert.node_id);
        if (!validator) {
          skipped++;
          continue;
        }
        const result = await checkSingleAlert(
          alert,
          validator,
          latestRelease,
          stakeEndFor(alert.node_id, autoRenewPeriods, validator.p50_uptime),
        );
        sent += result.sent;
        errors.push(...result.errors);
      }
    }

    // --- Process L1 alerts (grouped by subnet) ---
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
      success: !primaryUpstreamFailed,
      checked,
      sent,
      skipped,
      noticesSent,
      primaryCheckSkipped: primaryUpstreamFailed,
      release: latestRelease ? {
        tag: latestRelease.tag,
        type: latestRelease.type,
        deadline: latestRelease.deadline?.toISOString() ?? null,
      } : null,
      errors: [...dataErrors, ...errors].length > 0 ? [...dataErrors, ...errors] : undefined,
    });
  } catch (error) {
    console.error('Error running validator alert check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
