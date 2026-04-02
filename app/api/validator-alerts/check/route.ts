import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import {
  fetchValidators,
  fetchLatestRelease,
  checkSingleAlert,
} from '@/server/services/validator-alert-check';

export async function POST(req: NextRequest) {
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

    // Fetch data sources independently so one failure doesn't block the other
    const [validatorResult, releaseResult] = await Promise.allSettled([
      fetchValidators(),
      fetchLatestRelease(),
    ]);

    const validators = validatorResult.status === 'fulfilled'
      ? validatorResult.value
      : (() => { dataErrors.push(`P2P API error: ${validatorResult.reason}`); return []; })();

    const latestRelease = releaseResult.status === 'fulfilled'
      ? releaseResult.value
      : (() => { dataErrors.push(`GitHub API error: ${releaseResult.reason}`); return null; })();

    // If both sources failed, log to all active alerts (with 1-hour cooldown) and bail
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
            })
          )
        );
      }
      return NextResponse.json({ success: false, errors: dataErrors });
    }

    const validatorMap = new Map(validators.map(v => [v.node_id, v]));

    const activeAlerts = await prisma.validatorAlert.findMany({
      where: { active: true },
    });

    let sent = 0;
    let checked = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const alert of activeAlerts) {
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

    return NextResponse.json({
      success: true,
      checked,
      sent,
      skipped,
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
