import { getUnsubscribeUrl } from '@/server/services/unsubscribe-token';
import { RENEWAL_UPTIME_PERCENT } from '@/lib/validator-stake-end';
import {
  BRAND,
  SITE,
  emailDataRow,
  emailDataTable,
  emailSection,
  escapeHtml,
  renderEmail,
  type EmailHero,
} from '@/server/templates/email-layout';

const EXPLORER_BASE = 'https://explorer.avax.network';
const GITHUB_RELEASE_BASE = 'https://github.com/ava-labs/avalanchego/releases/tag';

const { red: RED, gray: GRAY, text: TEXT, mono: MONO, line: LINE } = BRAND;
const DASHBOARD_URL = `${SITE}/validator-alerts`;

/** Every validator alert uses the shared layout with the dashboard CTA and an unsubscribe link. */
function wrapTemplate(title: string, content: string, accentColor: string = RED, alertId?: string, hero: EmailHero = 'uptime'): string {
  return renderEmail({
    title,
    product: 'Validator alerts',
    hero,
    accent: accentColor,
    content,
    cta: { label: 'Open dashboard', url: DASHBOARD_URL },
    reason:
      hero === 'notice'
        ? 'You get this email because this address subscribed to Avalanche Notify.'
        : 'You get this email because you set up validator alerts on Builder Hub.',
    unsubscribeUrl: alertId ? getUnsubscribeUrl(alertId) : undefined,
  });
}

function explorerLink(nodeId: string): string {
  const safeId = encodeURIComponent(nodeId);
  return `<a href="${EXPLORER_BASE}/validators/${safeId}" style="color: ${TEXT}; text-decoration: underline; font-family: ${MONO}; font-size: 12px; word-break: break-all;">${escapeHtml(nodeId.slice(0, 15))}... &rarr;</a>`;
}

function releaseLink(version: string): string {
  const tag = version.replace('avalanchego/', 'v');
  const safeTag = encodeURIComponent(tag);
  return `<a href="${GITHUB_RELEASE_BASE}/${safeTag}" style="color: ${TEXT}; text-decoration: underline; font-family: ${MONO}; font-size: 12px;">${escapeHtml(tag)} &rarr;</a>`;
}

const dataRow = emailDataRow;
const dataTable = emailDataTable;
const section = emailSection;

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
      '#E6212F',
      'Uptime has dropped below your threshold',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Current Uptime', `${params.uptime.toFixed(1)}%`, '#E6212F') +
        dataRow('Your Threshold', `${params.threshold}%`, '#C9D1D3')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      'We\'ll check again in 24 hours and alert you if the node uptime is still below recommended threshold.'
    ),
    '#E6212F',
    params.alertId,
    'uptime',
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// AvalancheGo Upgrade Alert: Mandatory (with escalation)
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
    : 'Deadline not yet announced. Check the release notes';

  const urgencyPrefix =
    params.urgency === 'critical' ? '🚨 CRITICAL: '
    : params.urgency === 'urgent' ? '⚠️ URGENT: '
    : '';

  const subject = `${urgencyPrefix}AvalancheGo Upgrade Required: ${params.requiredVersion.replace('avalanchego/', 'v')}`;

  const deadlineColor =
    params.urgency === 'critical' ? '#E6212F'
    : params.urgency === 'urgent' ? '#FF7F7B'
    : '#C9D1D3';

  const acpLine = params.acps.length > 0
    ? dataRow('ACPs Activating', params.acps.map(a => `ACP-${a}`).join(', '), '#FFFFFF')
    : '';

  const cooldownText =
    params.urgency === 'critical' ? '4 hours'
    : params.urgency === 'urgent' ? '12 hours'
    : '24 hours';

  const borderColor = params.urgency === 'critical' ? '#E6212F' : '#FF7F7B';

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
        dataRow('Running Version', params.currentVersion, '#FF7F7B') +
        dataRow('Required Version', params.requiredVersion, '#FFFFFF') +
        dataRow('Upgrade Deadline', deadlineStr, deadlineColor) +
        acpLine
      ) +
      `<p style="font-size: 13px; color: #E6212F; margin: 12px 0 0 0; font-weight: bold;">${benchWarning}</p>` +
      `<p style="font-size: 13px; margin: 8px 0 0 0;">Release notes: ${releaseLink(params.requiredVersion)} | Explorer: ${explorerLink(params.nodeId)}</p>`,
      `Next alert in ${cooldownText} if still not upgraded.`
    ),
    borderColor,
    params.alertId,
    'upgrade',
  );

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// AvalancheGo Upgrade Alert: Optional
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
    ? '. It may be mandatory: check the release notes for details'
    : '';
  const subject = params.maybeMandatory
    ? `AvalancheGo ${params.latestVersion.replace('avalanchego/', 'v')} Available (Possibly Mandatory)`
    : `AvalancheGo ${params.latestVersion.replace('avalanchego/', 'v')} Available (Optional)`;
  const text = `Your validator ${name} is running ${params.currentVersion}. A new release ${params.latestVersion} is available${mandatoryNote}.`;
  const heading = params.maybeMandatory
    ? 'A new release is out, and it may be mandatory'
    : 'A new optional release is available';
  const footnote = params.maybeMandatory
    ? 'This release may be mandatory but no deadline could be determined. Check the release notes. You will not receive another alert for 7 days.'
    : 'This is an optional update. You will not receive another version alert for 7 days.';
  const html = wrapTemplate(
    'AvalancheGo Update Available',
    section(
      params.maybeMandatory ? '#FF7F7B' : '#A2AFB2',
      heading,
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Running Version', params.currentVersion, '#FF7F7B') +
        dataRow('Latest Version', params.latestVersion, '#FFFFFF')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">Release notes: ${releaseLink(params.latestVersion)} | Explorer: ${explorerLink(params.nodeId)}</p>`,
      footnote
    ),
    params.maybeMandatory ? '#FF7F7B' : '#A2AFB2',
    params.alertId,
    'upgrade',
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
  /** the stake auto-renews, but the uptime is below the 90% renewal threshold */
  renewalAtRisk?: boolean;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const prefix = params.urgency === 'urgent' ? '⚠️ ' : '';
  const days = `${params.daysLeft} day${params.daysLeft === 1 ? '' : 's'}`;
  const subject = params.renewalAtRisk
    ? `${prefix}Renewal At Risk: ${params.nodeId}: cycle ends in ${days}`
    : `${prefix}Stake Expiry Alert: ${params.nodeId}: ${days} remaining`;
  const text = params.renewalAtRisk
    ? `Your validator ${name} auto-renews, but its uptime is below ${RENEWAL_UPTIME_PERCENT}%. Its cycle ends in ${params.daysLeft} day(s) (${params.expiryDate}). If its uptime for the cycle is below ${RENEWAL_UPTIME_PERCENT}% then, the P-Chain removes the validator and returns the stake.`
    : `Your validator ${name} stake expires in ${params.daysLeft} day(s) (${params.expiryDate}).`;

  const borderColor = params.urgency === 'urgent' ? '#E6212F' : '#FF7F7B';
  const heading = params.renewalAtRisk
    ? 'Your validator renewal is at risk'
    : params.urgency === 'urgent'
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
        dataRow('Expiry Date', params.expiryDate, '#C9D1D3')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      params.renewalAtRisk
        ? `The validator renews only with ${RENEWAL_UPTIME_PERCENT}% uptime for the cycle. We'll alert you again in ${cooldown} if its uptime is still low.`
        : `We'll alert you again in ${cooldown} if your validator is still expiring.`
    ),
    borderColor,
    params.alertId,
    'expiry',
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Stake Expiry: Critical (< 1 hour)
// ---------------------------------------------------------------------------

export function expiryCriticalTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  expiryDate: string;
  hoursLeft: number;
  /** the stake auto-renews, but the uptime is below the 90% renewal threshold */
  renewalAtRisk?: boolean;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const minutesLeft = Math.max(1, Math.round(params.hoursLeft * 60));
  const title = params.renewalAtRisk ? '🚨 Renewal At Risk, Cycle Ends Within 1 Hour' : '🚨 Stake Expires Within 1 Hour';
  const subject = `${title}: ${params.nodeId}`;
  const text = params.renewalAtRisk
    ? `CRITICAL: Your validator ${name} cycle ends in approximately ${minutesLeft} minutes (${params.expiryDate}). Its uptime is below ${RENEWAL_UPTIME_PERCENT}%, so the P-Chain can remove the validator instead of renewing it.`
    : `CRITICAL: Your validator ${name} stake expires in approximately ${minutesLeft} minutes (${params.expiryDate}). Immediate action required.`;
  const html = wrapTemplate(
    title,
    section(
      '#E6212F',
      params.renewalAtRisk ? 'Your validator may not renew' : 'Your stake is about to expire',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Time Remaining', `~${minutesLeft} minutes`, '#E6212F') +
        dataRow('Expiry Time', params.expiryDate, '#C9D1D3')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      'This is the final reminder. No further alerts will be sent for this expiry.'
    ),
    '#E6212F',
    params.alertId,
    'expiry',
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// L1 Validator Balance Alert (tiered: notice / urgent)
// ---------------------------------------------------------------------------

function formatAvax(nAvax: number): string {
  return (nAvax / 1_000_000_000).toFixed(2);
}

function formatDays(days: number): string {
  if (!Number.isFinite(days)) return 'unknown';
  if (days < 1) return '<1 day';
  if (days < 10) return `${days.toFixed(1)} days`;
  return `${Math.round(days)} days`;
}

// ---------------------------------------------------------------------------
// Welcome Email
// ---------------------------------------------------------------------------

export function welcomeAlertTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  subnetId: string;
  chainName: string;
  uptime?: number | null;
  currentVersion?: string | null;
  latestVersion?: string | null;
  expiryDate?: string | null;
  daysLeft?: number | null;
  remainingBalance?: number | null;
  balanceDaysRemaining?: number | null;
  securityEnabled: boolean;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const isL1 = params.subnetId !== 'primary';
  const latestVersion = params.latestVersion ?? null;
  const currentVersion = params.currentVersion ?? 'Unknown';
  const versionStatus = latestVersion
    ? (latestVersion === currentVersion ? 'Up to date' : `Update available (${latestVersion})`)
    : 'Latest version unavailable';

  const rows = [
    dataRow('Validator', name, 'white'),
    dataRow('Network', isL1 ? params.chainName : 'Primary Network', '#FFFFFF'),
    dataRow('Current Version', currentVersion, '#C9D1D3'),
    dataRow('Version Status', versionStatus, latestVersion && latestVersion !== currentVersion ? '#FF7F7B' : '#FFFFFF'),
  ];

  if (!isL1 && params.uptime !== null && params.uptime !== undefined) {
    rows.push(dataRow('Current Uptime', `${params.uptime.toFixed(1)}%`, '#C9D1D3'));
  }
  if (!isL1 && params.expiryDate) {
    const expiryLabel = params.daysLeft !== null && params.daysLeft !== undefined
      ? `${params.daysLeft} day(s) left`
      : params.expiryDate;
    rows.push(dataRow('Stake Expiry', expiryLabel, '#C9D1D3'));
  }
  if (isL1 && params.remainingBalance !== null && params.remainingBalance !== undefined) {
    rows.push(dataRow('Remaining Balance', `${formatAvax(params.remainingBalance)} AVAX`, '#C9D1D3'));
  }
  if (isL1 && params.balanceDaysRemaining !== null && params.balanceDaysRemaining !== undefined) {
    rows.push(dataRow('Projected Runway', formatDays(params.balanceDaysRemaining), '#C9D1D3'));
  }

  const subject = `Welcome: Validator alerts enabled for ${params.nodeId}`;
  const text = `Your validator alert subscription is now active for ${name}. Current version: ${currentVersion}. Status: ${versionStatus}.`;

  const html = wrapTemplate(
    'Welcome to Validator Alerts',
    section(
      '#A2AFB2',
      'Your alerts are on. Here is your validator now',
      dataTable(rows.join('')) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">Security checks: ${params.securityEnabled ? 'Enabled' : 'Disabled'} | Explorer: ${explorerLink(params.nodeId)}</p>`,
      'You will receive alerts based on your configured thresholds and preferences.'
    ),
    '#A2AFB2',
    params.alertId,
    'welcome',
  );

  return { subject, html, text };
}

export function balanceLowAlertTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  chainName: string;
  remainingBalance: number;
  thresholdDays: number;
  daysRemaining: number;
  urgency: 'notice' | 'urgent';
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const balanceAvax = formatAvax(params.remainingBalance);
  const daysRemainingLabel = formatDays(params.daysRemaining);
  const prefix = params.urgency === 'urgent' ? '⚠️ ' : '';
  const subject = `${prefix}Low Balance: ${params.chainName} validator, ${daysRemainingLabel} runway left`;
  const text = `${prefix}Your L1 validator ${name} on ${params.chainName} has approximately ${daysRemainingLabel} of fee runway remaining (threshold: ${params.thresholdDays} days).`;

  const borderColor = params.urgency === 'urgent' ? '#E6212F' : '#FF7F7B';
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
        dataRow('L1 Chain', params.chainName, '#FFFFFF') +
        dataRow('Remaining Balance', `${balanceAvax} AVAX`, borderColor) +
        dataRow('Projected Runway', daysRemainingLabel, borderColor) +
        dataRow('Alert Threshold', `${params.thresholdDays} days`, '#C9D1D3')
      ) +
      `<p style="font-size: 13px; margin: 12px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      `We'll alert you again in ${cooldown} if balance is not topped up.`
    ),
    borderColor,
    params.alertId,
    'balance',
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// L1 Validator Balance: Critical (< 5% of threshold)
// ---------------------------------------------------------------------------

export function balanceCriticalTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  chainName: string;
  remainingBalance: number;
  daysRemaining: number;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const balanceAvax = formatAvax(params.remainingBalance);
  const subject = `Validator Nearly Empty: ${params.chainName}, ${formatDays(params.daysRemaining)} runway left`;
  const text = `CRITICAL: Your L1 validator ${name} on ${params.chainName} has approximately ${formatDays(params.daysRemaining)} of fee runway remaining (${balanceAvax} AVAX). Immediate top-up required.`;
  const html = wrapTemplate(
    '🚨 L1 Validator Balance Critical',
    section(
      '#E6212F',
      'Your validator is nearly out of balance',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('L1 Chain', params.chainName, '#FFFFFF') +
        dataRow('Remaining Balance', `${balanceAvax} AVAX`, '#E6212F') +
        dataRow('Projected Runway', formatDays(params.daysRemaining), '#E6212F')
      ) +
      `<p style="font-size: 13px; color: #E6212F; margin: 12px 0 0 0; font-weight: bold;">Your validator will be deactivated when balance reaches zero.</p>` +
      `<p style="font-size: 13px; margin: 8px 0 0 0;">View on explorer: ${explorerLink(params.nodeId)}</p>`,
      'This is the final reminder. No further balance alerts will be sent for this validator.'
    ),
    '#E6212F',
    params.alertId,
    'balance',
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Security Alerts
// ---------------------------------------------------------------------------

export function securityPortExposedTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  ip: string;
  port: number;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const endpoint = `${params.ip}:${params.port}`;
  const subject = `⚠️ Security Alert: API port ${params.port} appears publicly reachable`;
  const text = `Your validator ${name} appears to have port ${params.port} exposed at ${endpoint}. This endpoint should generally not be publicly accessible on validator nodes.`;
  const html = wrapTemplate(
    '⚠️ Validator Security Alert',
    section(
      '#E6212F',
      'Public API port exposure detected',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Endpoint', endpoint, '#E6212F') +
        dataRow('Risk', 'Public access to validator API port', '#E6212F')
      ) +
      '<p style="font-size: 13px; margin: 12px 0 0 0;">Recommended remediation: restrict port 9650 to localhost or trusted internal networks, and confirm firewall rules.</p>',
      'This alert repeats weekly while exposure remains detectable.'
    ),
    '#E6212F',
    params.alertId,
    'security',
  );
  return { subject, html, text };
}

export function securityIpChangedTemplate(params: {
  alertId: string;
  nodeId: string;
  label: string | null;
  previousIp: string;
  currentIp: string;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const subject = `Security Notice: Validator IP changed (${params.previousIp} → ${params.currentIp})`;
  const text = `Your validator ${name} public IP changed from ${params.previousIp} to ${params.currentIp}. Confirm this change was intentional.`;
  const html = wrapTemplate(
    'Validator IP Change Detected',
    section(
      '#FF7F7B',
      'A validator network identity change was detected',
      dataTable(
        dataRow('Validator', name, 'white') +
        dataRow('Previous IP', params.previousIp, '#C9D1D3') +
        dataRow('Current IP', params.currentIp, '#FF7F7B')
      ) +
      '<p style="font-size: 13px; margin: 12px 0 0 0;">If this change was not expected, review your infrastructure and key management immediately.</p>',
      'This notification is informational and helps detect unexpected migrations or compromise.'
    ),
    '#FF7F7B',
    params.alertId,
    'security',
  );
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Avalanche Notify migration notice (one email per address, sent once)
// ---------------------------------------------------------------------------

export function legacyNotifyNoticeTemplate(params: {
  alerts: { alertId: string; nodeId: string }[];
  /** The day the old service stops. */
  endDate: Date;
}): { subject: string; html: string; text: string } {
  const end = params.endDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const count = params.alerts.length;
  const subject = 'Your Avalanche Notify alerts now come from Builder Hub';

  const checks = [
    'Uptime drops below 95%.',
    'A new AvalancheGo release is available or required.',
    'Your stake ends in 7 days or less.',
  ];
  const noAction = 'You do not need to do anything.';
  // Avalanche Notify sent an alert when a node went offline. Builder Hub does not, so say it.
  const noDownAlert =
    'Builder Hub does not send an alert when a node goes offline. The uptime check uses the uptime that other validators report for your node, so a short outage may not trigger it.';
  const signIn =
    'To change the thresholds or pause an alert, sign in at https://build.avax.network/validator-alerts with this email address. If you sign in with Google or GitHub, use an account with this email address.';

  const nodeRows = params.alerts
    .map(
      (a) => `
    <tr>
      <td style="padding: 12px 0; border-top: 1px solid ${LINE}; font-family: ${MONO}; font-size: 12px; word-break: break-all;"><a href="${EXPLORER_BASE}/validators/${encodeURIComponent(a.nodeId)}" style="color: ${TEXT}; text-decoration: underline;">${escapeHtml(a.nodeId)}</a></td>
      <td style="padding: 12px 0 12px 12px; border-top: 1px solid ${LINE}; text-align: right; white-space: nowrap;"><a href="${getUnsubscribeUrl(a.alertId)}" style="color: ${GRAY}; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: underline;">Unsubscribe</a></td>
    </tr>`,
    )
    .join('');

  const html = wrapTemplate(
    'Avalanche Notify Is Moving to Builder Hub',
    section(
      '#A2AFB2',
      'Your Avalanche Notify alerts now come from Builder Hub',
      `<p style="margin: 0 0 16px 0;">Avalanche Notify stops on ${escapeHtml(end)}. Builder Hub Validator Alerts now watches ${count === 1 ? 'this validator' : `these ${count} validators`} for this address. <strong style="color: #FFFFFF;">${noAction}</strong></p>` +
      dataTable(nodeRows) +
        `<p style="font-size: 13px; color: #C9D1D3; margin: 16px 0 6px 0;">You get an email when:</p>` +
        `<ul style="font-size: 13px; color: #C9D1D3; margin: 0; padding-left: 20px;">${checks.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` +
        `<p style="font-size: 13px; color: #C9D1D3; margin: 12px 0 0 0;">${escapeHtml(noDownAlert)}</p>` +
        `<p style="font-size: 13px; color: #C9D1D3; margin: 16px 0 0 0;">To change the thresholds or pause an alert, sign in at <a href="https://build.avax.network/validator-alerts" style="color: #A2AFB2; text-decoration: underline;">build.avax.network/validator-alerts</a> with this email address. If you sign in with Google or GitHub, use an account with this email address.</p>` +
        `<p style="font-size: 13px; color: #C9D1D3; margin: 12px 0 0 0;">Until ${escapeHtml(end)}, both services send alerts. You can get two emails for one event.</p>`,
      'You get this email because this address subscribed to Avalanche Notify.',
    ),
    '#A2AFB2',
    undefined,
    'notice',
  );

  const text = [
    `Avalanche Notify stops on ${end}. Builder Hub Validator Alerts now watches these validators for this address. ${noAction}`,
    ...params.alerts.map((a) => `- ${a.nodeId} (unsubscribe: ${getUnsubscribeUrl(a.alertId)})`),
    '',
    'You get an email when:',
    ...checks.map((c) => `- ${c}`),
    '',
    noDownAlert,
    '',
    signIn,
    `Until ${end}, both services send alerts. You can get two emails for one event.`,
  ].join('\n');

  return { subject, html, text };
}
