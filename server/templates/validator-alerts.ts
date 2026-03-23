import { getUnsubscribeUrl } from '@/server/services/unsubscribe-token';

function wrapTemplate(title: string, content: string, accentColor = '#EF4444', alertId?: string): string {
  const unsubscribeLink = alertId
    ? `<p style="font-size: 11px; color: #71717A; text-align: center; margin-top: 16px;"><a href="${getUnsubscribeUrl(alertId)}" style="color: #71717A; text-decoration: underline;">Unsubscribe from these alerts</a></p>`
    : '';
  return `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid ${accentColor};">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px; text-align: center;">${title}</h2>
      ${content}
      <div style="margin-top: 24px; text-align: center;">
        <a href="https://build.avax.network/validator-alerts" style="display: inline-block; background-color: ${accentColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">View Dashboard</a>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <img src="https://build.avax.network/logo-black.png" alt="Avalanche" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builder's Hub</p>
      </div>
      ${unsubscribeLink}
    </div>
  `;
}

function dataRow(label: string, value: string, valueColor = 'white'): string {
  return `
    <tr>
      <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">${label}</td>
      <td style="padding: 8px 0; color: ${valueColor}; font-size: 14px; text-align: right; font-weight: bold;">${value}</td>
    </tr>`;
}

function dataTable(rows: string): string {
  return `<table style="width: 100%; border-collapse: collapse;">${rows}</table>`;
}

function section(borderColor: string, heading: string, body: string, footnote?: string): string {
  return `
    <div style="background-color: #27272A; border: 1px solid ${borderColor}; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <p style="font-size: 16px; color: ${borderColor}; margin: 0 0 12px 0;">${heading}</p>
      ${body}
    </div>
    ${footnote ? `<p style="font-size: 13px; color: #A1A1AA; text-align: center;">${footnote}</p>` : ''}`;
}

// ---------------------------------------------------------------------------
// Uptime Alert
// ---------------------------------------------------------------------------

export function uptimeAlertTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  uptime: number;
  threshold: number;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const subject = `Uptime Alert: ${params.nodeId} dropped to ${params.uptime.toFixed(1)}%`;
  const text = `Your validator ${name} uptime has dropped to ${params.uptime.toFixed(1)}%, below your threshold of ${params.threshold}%.`;
  const html = wrapTemplate(
    'Validator Uptime Alert',
    section(
      '#EF4444',
      'Uptime has dropped below your threshold',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Current Uptime', `${params.uptime.toFixed(1)}%`, '#EF4444') +
        dataRow('Your Threshold', `${params.threshold}%`, '#D1D5DB')
      ),
      'You will not receive another uptime alert for this validator within 24 hours.'
    ),
    '#EF4444',
    params.alertId
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// AvalancheGo Upgrade Alert — Mandatory (with escalation)
// ---------------------------------------------------------------------------

export function versionMandatoryTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  currentVersion: string;
  requiredVersion: string;
  deadline: Date | null;
  acps: string[];
  urgency: 'notice' | 'urgent' | 'critical';
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;

  const deadlineStr = params.deadline
    ? params.deadline.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'TBD — check release notes';

  const urgencyPrefix =
    params.urgency === 'critical' ? '🚨 CRITICAL: '
    : params.urgency === 'urgent' ? '⚠️ URGENT: '
    : '';

  const subject = `${urgencyPrefix}AvalancheGo Upgrade Required: ${params.requiredVersion.replace('avalanchego/', 'v')}`;

  const deadlineColor =
    params.urgency === 'critical' ? '#EF4444'
    : params.urgency === 'urgent' ? '#F59E0B'
    : '#D1D5DB';

  const acpLine = params.acps.length > 0
    ? dataRow('ACPs Activating', params.acps.map(a => `ACP-${a}`).join(', '), '#89B4FA')
    : '';

  const cooldownText =
    params.urgency === 'critical' ? '4 hours'
    : params.urgency === 'urgent' ? '12 hours'
    : '48 hours';

  const borderColor = params.urgency === 'critical' ? '#EF4444' : '#F59E0B';

  const text = `${urgencyPrefix}Your validator ${name} is running ${params.currentVersion} but ${params.requiredVersion} is required. Upgrade deadline: ${deadlineStr}. Failure to upgrade may result in your node being benched.`;

  const html = wrapTemplate(
    `${urgencyPrefix}AvalancheGo Upgrade Required`,
    section(
      borderColor,
      'A mandatory network upgrade is required',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Running Version', params.currentVersion, '#F59E0B') +
        dataRow('Required Version', params.requiredVersion, '#34D399') +
        dataRow('Upgrade Deadline', deadlineStr, deadlineColor) +
        acpLine
      ) +
      `<p style="font-size: 13px; color: #EF4444; margin: 12px 0 0 0; font-weight: bold;">Failure to upgrade before the deadline may result in your node being benched.</p>`,
      `Next alert in ${cooldownText} if still not upgraded.`
    ),
    borderColor,
    params.alertId
  );

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// AvalancheGo Upgrade Alert — Optional
// ---------------------------------------------------------------------------

export function versionOptionalTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  currentVersion: string;
  latestVersion: string;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const subject = `AvalancheGo ${params.latestVersion.replace('avalanchego/', 'v')} Available (Optional)`;
  const text = `Your validator ${name} is running ${params.currentVersion}. A new optional release ${params.latestVersion} is available.`;
  const html = wrapTemplate(
    'AvalancheGo Update Available',
    section(
      '#3B82F6',
      'A new optional release is available (recommended but not required)',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Running Version', params.currentVersion, '#F59E0B') +
        dataRow('Latest Version', params.latestVersion, '#34D399')
      ),
      'This is an optional update. You will not receive another version alert for 7 days.'
    ),
    '#3B82F6',
    params.alertId
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Stake Expiry Alert (tiered: notice / urgent)
// ---------------------------------------------------------------------------

export function expiryAlertTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  daysLeft: number;
  expiryDate: string;
  urgency: 'notice' | 'urgent';
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const prefix = params.urgency === 'urgent' ? '⚠️ ' : '';
  const subject = `${prefix}Stake Expiry Alert: ${params.nodeId} — ${params.daysLeft} day${params.daysLeft === 1 ? '' : 's'} remaining`;
  const text = `Your validator ${name} stake expires in ${params.daysLeft} day(s) (${params.expiryDate}).`;

  const borderColor = params.urgency === 'urgent' ? '#EF4444' : '#F59E0B';
  const heading = params.urgency === 'urgent'
    ? 'Your validator stake expires tomorrow'
    : 'Your validator stake is expiring soon';
  const cooldown = params.urgency === 'urgent' ? '12 hours' : '3 days';

  const html = wrapTemplate(
    `${prefix}Stake Expiry Alert`,
    section(
      borderColor,
      heading,
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Days Remaining', String(params.daysLeft), borderColor) +
        dataRow('Expiry Date', params.expiryDate, '#D1D5DB')
      ),
      `Next alert in ${cooldown} if stake is not renewed.`
    ),
    borderColor,
    params.alertId
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Stake Expiry — Critical (< 1 hour)
// ---------------------------------------------------------------------------

export function expiryCriticalTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  expiryDate: string;
  hoursLeft: number;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const minutesLeft = Math.max(1, Math.round(params.hoursLeft * 60));
  const subject = `🚨 Stake Expires Within 1 Hour: ${params.nodeId}`;
  const text = `CRITICAL: Your validator ${name} stake expires in approximately ${minutesLeft} minutes (${params.expiryDate}). Immediate action required.`;
  const html = wrapTemplate(
    '🚨 Stake Expires Within 1 Hour',
    section(
      '#EF4444',
      'Immediate action required — your stake is about to expire',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Time Remaining', `~${minutesLeft} minutes`, '#EF4444') +
        dataRow('Expiry Time', params.expiryDate, '#D1D5DB')
      ),
      'This is a one-time critical alert.'
    ),
    '#EF4444',
    params.alertId
  );
  return { subject, html, text };
}
