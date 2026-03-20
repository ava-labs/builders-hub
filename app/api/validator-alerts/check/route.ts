import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { sendMail } from '@/server/services/mail';
import {
  uptimeAlertTemplate,
  versionAlertTemplate,
  expiryAlertTemplate,
} from '@/server/templates/validator-alerts';
import type { ValidatorP2P, AlertType } from '@/types/validator-alerts';

const P2P_API_URL = 'https://52.203.183.9.sslip.io/api/validators';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/ava-labs/avalanchego/releases/latest';

// Cooldown periods in hours
const COOLDOWNS: Record<AlertType, number> = {
  uptime: 24,
  version: 168, // 7 days
  expiry: 72,   // 3 days
};

async function fetchValidators(): Promise<ValidatorP2P[]> {
  const res = await fetch(P2P_API_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Failed to fetch validators: ${res.status}`);
  return res.json();
}

async function fetchLatestVersion(): Promise<string> {
  const res = await fetch(GITHUB_RELEASES_URL, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Failed to fetch latest release: ${res.status}`);
  const data = await res.json();
  // tag_name is like "v1.14.1", normalize to "avalanchego/1.14.1"
  const tag: string = data.tag_name ?? '';
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  return `avalanchego/${version}`;
}

async function wasRecentlySent(
  alertId: string,
  alertType: AlertType
): Promise<boolean> {
  const cooldownHours = COOLDOWNS[alertType];
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  const recent = await prisma.validatorAlertLog.findFirst({
    where: {
      validator_alert_id: alertId,
      alert_type: alertType,
      sent_at: { gte: since },
    },
  });

  return recent !== null;
}

async function sendAlertEmail(
  alertId: string,
  email: string,
  alertType: AlertType,
  template: { subject: string; html: string; text: string }
): Promise<void> {
  await sendMail(email, template.html, template.subject, template.text);
  await prisma.validatorAlertLog.create({
    data: {
      validator_alert_id: alertId,
      alert_type: alertType,
      message: template.text,
    },
  });
}

export async function POST(req: NextRequest) {
  // Authenticate via API key
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.VALIDATOR_ALERTS_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [validators, latestVersion] = await Promise.all([
      fetchValidators(),
      fetchLatestVersion(),
    ]);

    // Index validators by node_id for fast lookup
    const validatorMap = new Map<string, ValidatorP2P>();
    for (const v of validators) {
      validatorMap.set(v.node_id, v);
    }

    // Get all active alerts
    const activeAlerts = await prisma.validatorAlert.findMany({
      where: { active: true },
    });

    let sent = 0;
    let checked = 0;
    const errors: string[] = [];

    for (const alert of activeAlerts) {
      checked++;
      const validator = validatorMap.get(alert.node_id);
      if (!validator) continue; // Validator no longer in active set

      // Check uptime
      if (alert.uptime_alert && validator.p50_uptime < alert.uptime_threshold) {
        try {
          const alreadySent = await wasRecentlySent(alert.id, 'uptime');
          if (!alreadySent) {
            const template = uptimeAlertTemplate({
              nodeId: alert.node_id,
              label: alert.label,
              uptime: validator.p50_uptime,
              threshold: alert.uptime_threshold,
            });
            await sendAlertEmail(alert.id, alert.email, 'uptime', template);
            sent++;
          }
        } catch (err) {
          errors.push(`Uptime alert failed for ${alert.node_id}: ${err}`);
        }
      }

      // Check version
      if (alert.version_alert && validator.version !== latestVersion) {
        try {
          const alreadySent = await wasRecentlySent(alert.id, 'version');
          if (!alreadySent) {
            const template = versionAlertTemplate({
              nodeId: alert.node_id,
              label: alert.label,
              currentVersion: validator.version,
              latestVersion,
            });
            await sendAlertEmail(alert.id, alert.email, 'version', template);
            sent++;
          }
        } catch (err) {
          errors.push(`Version alert failed for ${alert.node_id}: ${err}`);
        }
      }

      // Check stake expiry
      if (alert.expiry_alert && validator.days_left < alert.expiry_days) {
        try {
          const alreadySent = await wasRecentlySent(alert.id, 'expiry');
          if (!alreadySent) {
            const template = expiryAlertTemplate({
              nodeId: alert.node_id,
              label: alert.label,
              daysLeft: validator.days_left,
              expiryDate: validator.end_time,
            });
            await sendAlertEmail(alert.id, alert.email, 'expiry', template);
            sent++;
          }
        } catch (err) {
          errors.push(`Expiry alert failed for ${alert.node_id}: ${err}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error running validator alert check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
