import { getUnsubscribeUrl } from '@/server/services/unsubscribe-token';

const EXPLORER_BASE = 'https://subnets.avax.network';
const GITHUB_RELEASE_BASE = 'https://github.com/ava-labs/avalanchego/releases/tag';

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
        <img src="https://build.avax.network/logo-white.png" alt="Avalanche" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builders Hub</p>
      </div>
      ${unsubscribeLink}
    </div>
  `;
}

function explorerLink(nodeId: string): string {
  return `<a href="${EXPLORER_BASE}/validators/${nodeId}" style="color: #3B82F6; text-decoration: underline;">${EXPLORER_BASE}/validators/${nodeId.slice(0, 15)}...</a>`;
}

function releaseLink(version: string): string {
  const tag = version.replace('avalanchego/', 'v');
  return `<a href="${GITHUB_RELEASE_BASE}/${tag}" style="color: #3B82F6; text-decoration: underline;">${tag}</a>`;
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
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      'We\'ll check again in 24 hours and alert you if the node uptime is still below recommended threshold.'
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
    : 'Deadline not yet announced — monitor release notes';

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
    : '24 hours';

  const borderColor = params.urgency === 'critical' ? '#EF4444' : '#F59E0B';

  const benchWarning =
    params.urgency === 'critical' ? 'Your node will be benched imminently if not upgraded now.'
    : params.urgency === 'urgent' ? 'Your node will be benched if not upgraded before the deadline.'
    : 'Failure to upgrade before the deadline may result in your node being benched.';

  const text = `${urgencyPrefix}Your validator ${name} is running ${params.currentVersion} but ${params.requiredVersion} is required. Upgrade deadline: ${deadlineStr}. ${benchWarning}`;

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
      `<p style="font-size: 13px; color: #EF4444; margin: 12px 0 0 0; font-weight: bold;">${benchWarning}</p>` +
      `<p style="font-size: 13px; margin: 8px 0 0 0;">Release notes: ${releaseLink(params.requiredVersion)} | Explorer: ${explorerLink(params.nodeId)}</p>`,
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
  maybeMandatory?: boolean;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const mandatoryNote = params.maybeMandatory
    ? ' — this release may be mandatory, check release notes for details'
    : '';
  const subject = params.maybeMandatory
    ? `AvalancheGo ${params.latestVersion.replace('avalanchego/', 'v')} Available (Possibly Mandatory)`
    : `AvalancheGo ${params.latestVersion.replace('avalanchego/', 'v')} Available (Optional)`;
  const text = `Your validator ${name} is running ${params.currentVersion}. A new release ${params.latestVersion} is available${mandatoryNote}.`;
  const heading = params.maybeMandatory
    ? 'A new release is available — this release may be mandatory, check release notes for deadline'
    : 'A new optional release is available (recommended but not required)';
  const footnote = params.maybeMandatory
    ? 'This release may be mandatory but no deadline could be determined. Check the release notes. You will not receive another alert for 7 days.'
    : 'This is an optional update. You will not receive another version alert for 7 days.';
  const html = wrapTemplate(
    'AvalancheGo Update Available',
    section(
      params.maybeMandatory ? '#F59E0B' : '#3B82F6',
      heading,
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Running Version', params.currentVersion, '#F59E0B') +
        dataRow('Latest Version', params.latestVersion, '#34D399')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">Release notes: ${releaseLink(params.latestVersion)} | Explorer: ${explorerLink(params.nodeId)}</p>`,
      footnote
    ),
    params.maybeMandatory ? '#F59E0B' : '#3B82F6',
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
  const cooldown = params.urgency === 'urgent' ? '6 hours' : '24 hours';

  const html = wrapTemplate(
    `${prefix}Stake Expiry Alert`,
    section(
      borderColor,
      heading,
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Days Remaining', String(params.daysLeft), borderColor) +
        dataRow('Expiry Date', params.expiryDate, '#D1D5DB')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      `We'll alert you again in ${cooldown} if your validator is still expiring.`
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
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      'This is a final reminder — no further alerts will be sent for this expiry.'
    ),
    '#EF4444',
    params.alertId
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// L1 Validator Balance Alert (tiered: notice / urgent)
// ---------------------------------------------------------------------------

function formatAvax(nAvax: number): string {
  return (nAvax / 1_000_000_000).toFixed(2);
}

export function balanceLowAlertTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  chainName: string;
  remainingBalance: number;
  threshold: number;
  urgency: 'notice' | 'urgent';
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const balanceAvax = formatAvax(params.remainingBalance);
  const thresholdAvax = formatAvax(params.threshold);
  const prefix = params.urgency === 'urgent' ? '⚠️ ' : '';
  const subject = `${prefix}Low Balance: ${params.chainName} validator — ${balanceAvax} AVAX remaining`;
  const text = `${prefix}Your L1 validator ${name} on ${params.chainName} has ${balanceAvax} AVAX remaining (threshold: ${thresholdAvax} AVAX). Top up to avoid deactivation.`;

  const borderColor = params.urgency === 'urgent' ? '#EF4444' : '#F59E0B';
  const heading = params.urgency === 'urgent'
    ? 'Your L1 validator balance is critically low'
    : 'Your L1 validator balance is running low';
  const cooldown = params.urgency === 'urgent' ? '12 hours' : '24 hours';

  const html = wrapTemplate(
    `${prefix}L1 Validator Balance Alert`,
    section(
      borderColor,
      heading,
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('L1 Chain', params.chainName, '#89B4FA') +
        dataRow('Remaining Balance', `${balanceAvax} AVAX`, borderColor) +
        dataRow('Alert Threshold', `${thresholdAvax} AVAX`, '#D1D5DB')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      `We'll alert you again in ${cooldown} if balance is not topped up.`
    ),
    borderColor,
    params.alertId
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// L1 Validator Balance — Critical (< 5% of threshold)
// ---------------------------------------------------------------------------

export function balanceCriticalTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  chainName: string;
  remainingBalance: number;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const balanceAvax = formatAvax(params.remainingBalance);
  const subject = `🚨 Validator Nearly Empty: ${params.chainName} — ${balanceAvax} AVAX left`;
  const text = `CRITICAL: Your L1 validator ${name} on ${params.chainName} has only ${balanceAvax} AVAX remaining. Immediate top-up required to prevent deactivation.`;
  const html = wrapTemplate(
    '🚨 L1 Validator Balance Critical',
    section(
      '#EF4444',
      'Immediate action required — your validator is nearly out of balance',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('L1 Chain', params.chainName, '#89B4FA') +
        dataRow('Remaining Balance', `${balanceAvax} AVAX`, '#EF4444')
      ) +
      `<p style="font-size: 13px; color: #EF4444; margin: 12px 0 0 0; font-weight: bold;">Your validator will be deactivated when balance reaches zero.</p>` +
      `<p style="font-size: 13px; margin: 8px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      'This is a final reminder — no further balance alerts will be sent for this validator.'
    ),
    '#EF4444',
    params.alertId
  );
  return { subject, html, text };
}
