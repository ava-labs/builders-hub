import { prisma } from '@/prisma/prisma';
import { sendMail } from '@/server/services/mail';
import {
  uptimeAlertTemplate,
  versionMandatoryTemplate,
  versionOptionalTemplate,
  expiryAlertTemplate,
  expiryCriticalTemplate,
  balanceLowAlertTemplate,
  balanceCriticalTemplate,
  welcomeAlertTemplate,
  securityPortExposedTemplate,
  securityIpChangedTemplate,
} from '@/server/templates/validator-alerts';
import type { ValidatorP2P, AlertType, ReleaseClassification, L1ValidatorData } from '@/types/validator-alerts';
import { getL1ChainName } from '@/server/services/l1-chain-metadata';
import net from 'node:net';

const P2P_API_URL = 'https://52.203.183.9.sslip.io/api/validators';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/ava-labs/avalanchego/releases';
const DEFAULT_L1_FEE_MONTHLY_N_AVAX = Number(process.env.L1_VALIDATOR_FEE_MONTHLY_N_AVAX ?? '1330000000');
const DEFAULT_L1_FEE_DAILY_N_AVAX = DEFAULT_L1_FEE_MONTHLY_N_AVAX / 30;

/**
 * Cooldown periods in hours per alert type.
 * Distinct types ensure escalation tiers don't suppress each other.
 */
export const COOLDOWNS: Record<AlertType, number> = {
  uptime: 24,
  version_mandatory: 24,
  version_mandatory_urgent: 12,
  version_mandatory_critical: 4,
  version_optional: 168, // 7 days
  expiry: 24,
  expiry_urgent: 6, // every 6 hours in the last 24 hours
  expiry_critical: Infinity, // one-shot — never re-send
  balance_low: 24,
  balance_low_urgent: 12,
  balance_critical: Infinity, // one-shot
  balance_low_critical: Infinity, // one-shot
  security_port_exposed: 168, // weekly
  security_ip_changed: 24,
  welcome: Infinity, // one-shot
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function fetchValidators(): Promise<ValidatorP2P[]> {
  const res = await fetch(P2P_API_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`P2P API returned ${res.status}`);
  return res.json();
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  body: string;
  published_at: string;
}

/**
 * Fetch recent non-prerelease GitHub releases and classify the latest one.
 */
export async function fetchLatestRelease(): Promise<ReleaseClassification> {
  const res = await fetch(`${GITHUB_RELEASES_URL}?per_page=10`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

  const releases: GitHubRelease[] = await res.json();

  const stable = releases.find(
    (r) => !r.prerelease && !r.tag_name.includes('fuji')
  );
  if (!stable) throw new Error('No stable release found');

  const tag = stable.tag_name.startsWith('v')
    ? stable.tag_name.slice(1)
    : stable.tag_name;
  const normalizedTag = `avalanchego/${tag}`;
  const body = stable.body ?? '';

  const isMandatory = detectMandatory(body);

  if (isMandatory) {
    const deadline = extractDeadline(body);
    const acps = extractACPs(body);
    return { tag: normalizedTag, type: 'mandatory', deadline, acps };
  }

  return { tag: normalizedTag, type: 'optional', deadline: null, acps: [] };
}

function detectMandatory(body: string): boolean {
  const lower = body.toLowerCase();
  const patterns = [
    'must upgrade before',
    'must upgrade by',
    'all mainnet nodes must upgrade',
    'all nodes must upgrade',
    'mandatory upgrade',
    'mandatory update',
    'this upgrade is mandatory',
    'required upgrade',
    'nodes must be upgraded',
  ];
  return patterns.some((p) => lower.includes(p));
}

function extractDeadline(body: string): Date | null {
  const patterns = [
    /must (?:upgrade|be upgraded) (?:before|by)\s+(.+?)(?:\.|$)/im,
    /all (?:mainnet )?nodes must (?:upgrade|be upgraded) (?:before|by)\s+(.+?)(?:\.|$)/im,
  ];

  for (const regex of patterns) {
    const match = body.match(regex);
    if (match) {
      const parsed = tryParseDate(match[1].trim());
      if (parsed) return parsed;
    }
  }

  return null;
}

const TZ_OFFSETS: Record<string, string> = {
  UTC: '+00:00', GMT: '+00:00',
  ET: '-05:00', EST: '-05:00', EDT: '-04:00',
  CT: '-06:00', CST: '-06:00', CDT: '-05:00',
  MT: '-07:00', MST: '-07:00', MDT: '-06:00',
  PT: '-08:00', PST: '-08:00', PDT: '-07:00',
};

function tryParseDate(dateStr: string): Date | null {
  let cleaned = dateStr.replace(/(\d+)(?:st|nd|rd|th)/g, '$1');
  cleaned = cleaned.replace(/\b(?:on|at)\b/gi, '').replace(/\s{2,}/g, ' ').trim();

  let tzOffset = '';
  cleaned = cleaned.replace(/\b(UTC|GMT|E[SD]?T|C[SD]?T|M[SD]?T|P[SD]?T)\b/gi, (match) => {
    tzOffset = TZ_OFFSETS[match.toUpperCase()] || '';
    return '';
  }).replace(/\s{2,}/g, ' ').trim();

  const timeFirst = cleaned.match(/^([\d:]+\s*[AP]M),?\s*(.+)$/i);
  if (timeFirst) {
    cleaned = `${timeFirst[2]} ${timeFirst[1]}`;
  }

  cleaned = cleaned.replace(
    /([A-Za-z]+\s+\d{1,2})\s+(\d{4})/,
    '$1, $2'
  );

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2020) {
    if (tzOffset) {
      const [hours, minutes] = tzOffset.split(':').map(Number);
      const offsetMs = (hours * 60 + (hours < 0 ? -minutes : minutes)) * 60 * 1000;
      const localOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
      return new Date(parsed.getTime() + localOffsetMs - offsetMs);
    }
    return parsed;
  }

  return null;
}

function extractACPs(body: string): string[] {
  const matches = body.matchAll(/ACP-(\d+)/g);
  const acps = new Set<string>();
  for (const m of matches) {
    acps.add(m[1]);
  }
  return [...acps];
}

function normalizeVersionTag(version: string): string {
  return version.startsWith('avalanchego/') ? version : `avalanchego/${version}`;
}

export function estimateL1DaysRemaining(remainingBalance: number): number {
  if (!Number.isFinite(remainingBalance)) return Infinity;
  if (!Number.isFinite(DEFAULT_L1_FEE_DAILY_N_AVAX) || DEFAULT_L1_FEE_DAILY_N_AVAX <= 0) return Infinity;
  return remainingBalance / DEFAULT_L1_FEE_DAILY_N_AVAX;
}

export function estimateBalanceThresholdDays(alert: AlertRecord): number {
  if (Number.isFinite(alert.balance_threshold_days) && alert.balance_threshold_days > 0) {
    return alert.balance_threshold_days;
  }
  if (Number.isFinite(alert.balance_threshold) && alert.balance_threshold > 0) {
    return Math.max(1, Math.round(alert.balance_threshold / DEFAULT_L1_FEE_DAILY_N_AVAX));
  }
  return 30;
}

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  // Skip private, loopback, link-local, and unspecified ranges.
  if (parts[0] === 10) return false;
  if (parts[0] === 127) return false;
  if (parts[0] === 0) return false;
  if (parts[0] === 169 && parts[1] === 254) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] >= 224) return false;
  return true;
}

async function isTcpPortReachable(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const onDone = (reachable: boolean) => {
      socket.removeAllListeners();
      if (!socket.destroyed) socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => onDone(true));
    socket.on('timeout', () => onDone(false));
    socket.on('error', () => onDone(false));
  });
}

// ---------------------------------------------------------------------------
// Cooldown check
// ---------------------------------------------------------------------------

export async function wasRecentlySent(
  alertId: string,
  alertType: AlertType
): Promise<boolean> {
  const cooldownHours = COOLDOWNS[alertType];
  if (cooldownHours === Infinity) {
    const any = await prisma.validatorAlertLog.findFirst({
      where: { validator_alert_id: alertId, alert_type: alertType },
    });
    return any !== null;
  }

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

// ---------------------------------------------------------------------------
// Email sending + logging
// ---------------------------------------------------------------------------

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

export async function trySend(
  alertId: string,
  email: string,
  alertType: AlertType,
  template: { subject: string; html: string; text: string },
  errors: string[],
  nodeId: string
): Promise<boolean> {
  try {
    const alreadySent = await wasRecentlySent(alertId, alertType);
    if (alreadySent) return false;
    await sendAlertEmail(alertId, email, alertType, template);
    return true;
  } catch (err) {
    errors.push(`${alertType} for ${nodeId}: ${err}`);
    return false;
  }
}

export async function sendWelcomeEmail(
  alert: AlertRecord,
  options: {
    primaryValidator?: ValidatorP2P | null;
    l1Validator?: L1ValidatorData | null;
    latestRelease?: ReleaseClassification | null;
  }
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  const isL1 = alert.subnet_id !== 'primary';
  const l1Validator = options.l1Validator ?? null;
  const primaryValidator = options.primaryValidator ?? null;
  const latestRelease = options.latestRelease ?? null;
  const currentVersion = isL1
    ? (l1Validator?.version ? normalizeVersionTag(l1Validator.version) : null)
    : (primaryValidator?.version ?? null);

  const didSend = await trySend(
    alert.id,
    alert.email,
    'welcome',
    welcomeAlertTemplate({
      alertId: alert.id,
      nodeId: alert.node_id,
      label: alert.label,
      subnetId: alert.subnet_id,
      chainName: getL1ChainName(alert.subnet_id),
      uptime: primaryValidator?.p50_uptime ?? null,
      currentVersion,
      latestVersion: latestRelease?.tag ?? null,
      expiryDate: primaryValidator?.end_time ?? null,
      daysLeft: primaryValidator?.days_left ?? null,
      remainingBalance: l1Validator?.remainingBalance ?? null,
      balanceDaysRemaining: l1Validator ? estimateL1DaysRemaining(l1Validator.remainingBalance) : null,
      securityEnabled: alert.security_alert,
    }),
    errors,
    alert.node_id
  );

  return { sent: didSend ? 1 : 0, errors };
}

export async function checkSecurityAlerts(
  alert: AlertRecord,
  validator: ValidatorP2P
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  if (!alert.security_alert) return { sent, errors };
  const ip = validator.public_ip?.trim();
  if (!ip || !isPublicIpv4(ip)) return { sent, errors };

  // 1) Detect IP change and persist the current IP for future comparisons.
  if (alert.last_known_ip && alert.last_known_ip !== ip) {
    const didSend = await trySend(
      alert.id,
      alert.email,
      'security_ip_changed',
      securityIpChangedTemplate({
        alertId: alert.id,
        nodeId: alert.node_id,
        label: alert.label,
        previousIp: alert.last_known_ip,
        currentIp: ip,
      }),
      errors,
      alert.node_id
    );
    if (didSend) sent++;
  }

  if (alert.last_known_ip !== ip) {
    try {
      await prisma.validatorAlert.update({
        where: { id: alert.id },
        data: { last_known_ip: ip },
      });
      alert.last_known_ip = ip;
    } catch (err) {
      errors.push(`security_ip_persist for ${alert.node_id}: ${err}`);
    }
  }

  // 2) Port 9650 reachability check (at most once per week per alert).
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const shouldProbePort = !alert.last_security_check_at || (now - alert.last_security_check_at.getTime()) >= weekMs;

  if (shouldProbePort) {
    try {
      const isExposed = await isTcpPortReachable(ip, 9650);
      if (isExposed) {
        const didSend = await trySend(
          alert.id,
          alert.email,
          'security_port_exposed',
          securityPortExposedTemplate({
            alertId: alert.id,
            nodeId: alert.node_id,
            label: alert.label,
            ip,
            port: 9650,
          }),
          errors,
          alert.node_id
        );
        if (didSend) sent++;
      }
    } catch (err) {
      errors.push(`security_port_check for ${alert.node_id}: ${err}`);
    } finally {
      try {
        const checkedAt = new Date(now);
        await prisma.validatorAlert.update({
          where: { id: alert.id },
          data: { last_security_check_at: checkedAt },
        });
        alert.last_security_check_at = checkedAt;
      } catch (err) {
        errors.push(`security_probe_persist for ${alert.node_id}: ${err}`);
      }
    }
  }

  return { sent, errors };
}

// ---------------------------------------------------------------------------
// Per-alert check logic (shared between cron and on-create)
// ---------------------------------------------------------------------------

interface AlertRecord {
  id: string;
  node_id: string;
  subnet_id: string;
  email: string;
  label: string | null;
  uptime_alert: boolean;
  uptime_threshold: number;
  version_alert: boolean;
  expiry_alert: boolean;
  expiry_days: number;
  balance_alert: boolean;
  balance_threshold: number;
  balance_threshold_days: number;
  security_alert: boolean;
  last_known_ip: string | null;
  last_security_check_at: Date | null;
}

/**
 * Run alert checks for a single alert + validator pair.
 * Returns the number of emails sent.
 */
export async function checkSingleAlert(
  alert: AlertRecord,
  validator: ValidatorP2P,
  latestRelease: ReleaseClassification | null,
): Promise<{ sent: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];

  // --- 1. Uptime check ---
  if (alert.uptime_alert && validator.p50_uptime < alert.uptime_threshold) {
    const didSend = await trySend(
      alert.id,
      alert.email,
      'uptime',
      uptimeAlertTemplate({
        alertId: alert.id,
        nodeId: alert.node_id,
        label: alert.label,
        uptime: validator.p50_uptime,
        threshold: alert.uptime_threshold,
      }),
      errors,
      alert.node_id
    );
    if (didSend) sent++;
  }

  // --- 2. Version check (AvalancheGo Upgrade) ---
  if (alert.version_alert && latestRelease && validator.version !== latestRelease.tag) {
    if (latestRelease.type === 'mandatory' && latestRelease.deadline) {
      const hoursToDeadline =
        (latestRelease.deadline.getTime() - Date.now()) / 3_600_000;

      let alertType: AlertType;
      if (hoursToDeadline <= 24) {
        alertType = 'version_mandatory_critical';
      } else if (hoursToDeadline <= 72) {
        alertType = 'version_mandatory_urgent';
      } else {
        alertType = 'version_mandatory';
      }

      const didSend = await trySend(
        alert.id,
        alert.email,
        alertType,
        versionMandatoryTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          currentVersion: validator.version,
          requiredVersion: latestRelease.tag,
          deadline: latestRelease.deadline,
          acps: latestRelease.acps,
          urgency:
            alertType === 'version_mandatory_critical'
              ? 'critical'
              : alertType === 'version_mandatory_urgent'
                ? 'urgent'
                : 'notice',
        }),
        errors,
        alert.node_id
      );
      if (didSend) sent++;
    } else if (latestRelease.type === 'mandatory') {
      // No parseable deadline — don't escalate to mandatory tier.
      // Send as optional with a note that it may be mandatory.
      const didSend = await trySend(
        alert.id,
        alert.email,
        'version_optional',
        versionOptionalTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          currentVersion: validator.version,
          latestVersion: latestRelease.tag,
          maybeMandatory: true,
        }),
        errors,
        alert.node_id
      );
      if (didSend) sent++;
    } else {
      const didSend = await trySend(
        alert.id,
        alert.email,
        'version_optional',
        versionOptionalTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          currentVersion: validator.version,
          latestVersion: latestRelease.tag,
        }),
        errors,
        alert.node_id
      );
      if (didSend) sent++;
    }
  }

  // --- 3. Stake expiry check (tiered) ---
  if (alert.expiry_alert && validator.days_left >= 0) {
    const endTime = new Date(validator.end_time);
    const hoursToExpiry = (endTime.getTime() - Date.now()) / 3_600_000;

    if (hoursToExpiry <= 1 && hoursToExpiry > 0) {
      const didSend = await trySend(
        alert.id,
        alert.email,
        'expiry_critical',
        expiryCriticalTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          expiryDate: validator.end_time,
          hoursLeft: Math.max(0, hoursToExpiry),
        }),
        errors,
        alert.node_id
      );
      if (didSend) sent++;
    } else if (validator.days_left <= 1 && validator.days_left >= 0) {
      const didSend = await trySend(
        alert.id,
        alert.email,
        'expiry_urgent',
        expiryAlertTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          daysLeft: validator.days_left,
          expiryDate: validator.end_time,
          urgency: 'urgent',
        }),
        errors,
        alert.node_id
      );
      if (didSend) sent++;
    } else if (validator.days_left > 0 && validator.days_left <= alert.expiry_days) {
      const didSend = await trySend(
        alert.id,
        alert.email,
        'expiry',
        expiryAlertTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          daysLeft: validator.days_left,
          expiryDate: validator.end_time,
          urgency: 'notice',
        }),
        errors,
        alert.node_id
      );
      if (didSend) sent++;
    }
  }

  // --- 4. Security checks ---
  const securityResult = await checkSecurityAlerts(alert, validator);
  sent += securityResult.sent;
  errors.push(...securityResult.errors);

  return { sent, errors };
}

// ---------------------------------------------------------------------------
// L1 validator data fetching
// ---------------------------------------------------------------------------

const CHAIN_VALIDATORS_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://build.avax.network';

export async function fetchL1Validators(subnetId: string): Promise<L1ValidatorData[]> {
  const res = await fetch(`${CHAIN_VALIDATORS_BASE}/api/chain-validators/${subnetId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`chain-validators API returned ${res.status} for ${subnetId}`);
  const data = await res.json();
  if (!Array.isArray(data.validators)) return [];
  return data.validators
    .filter((v: Record<string, unknown>) => Number.isFinite(v.remainingBalance as number) && (v.remainingBalance as number) >= 0)
    .map((v: Record<string, unknown>) => ({
      nodeId: v.nodeId as string,
      weight: (v.weight as number) ?? 0,
      remainingBalance: v.remainingBalance as number,
      version: (v.version as string) ?? 'Unknown',
      creationTimestamp: v.creationTimestamp as number | undefined,
      validationId: v.validationId as string | undefined,
    }));
}

// ---------------------------------------------------------------------------
// Per-alert check logic for L1 validators
// ---------------------------------------------------------------------------

export async function checkL1Alert(
  alert: AlertRecord,
  validator: L1ValidatorData,
  latestRelease: ReleaseClassification | null,
): Promise<{ sent: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  const chainName = getL1ChainName(alert.subnet_id);

  // --- 1. Version check (same logic as Primary Network) ---
  if (alert.version_alert && latestRelease) {
    const normalizedVersion = normalizeVersionTag(validator.version);

    if (normalizedVersion !== latestRelease.tag) {
      if (latestRelease.type === 'mandatory' && latestRelease.deadline) {
        const hoursToDeadline = (latestRelease.deadline.getTime() - Date.now()) / 3_600_000;
        let alertType: AlertType;
        if (hoursToDeadline <= 24) alertType = 'version_mandatory_critical';
        else if (hoursToDeadline <= 72) alertType = 'version_mandatory_urgent';
        else alertType = 'version_mandatory';

        const didSend = await trySend(
          alert.id, alert.email, alertType,
          versionMandatoryTemplate({
            alertId: alert.id, nodeId: alert.node_id, label: alert.label,
            currentVersion: normalizedVersion, requiredVersion: latestRelease.tag,
            deadline: latestRelease.deadline, acps: latestRelease.acps,
            urgency: alertType === 'version_mandatory_critical' ? 'critical'
              : alertType === 'version_mandatory_urgent' ? 'urgent' : 'notice',
          }),
          errors, alert.node_id
        );
        if (didSend) sent++;
      } else if (latestRelease.type === 'mandatory') {
        const didSend = await trySend(
          alert.id, alert.email, 'version_optional',
          versionOptionalTemplate({
            alertId: alert.id, nodeId: alert.node_id, label: alert.label,
            currentVersion: normalizedVersion, latestVersion: latestRelease.tag,
            maybeMandatory: true,
          }),
          errors, alert.node_id
        );
        if (didSend) sent++;
      } else {
        const didSend = await trySend(
          alert.id, alert.email, 'version_optional',
          versionOptionalTemplate({
            alertId: alert.id, nodeId: alert.node_id, label: alert.label,
            currentVersion: normalizedVersion, latestVersion: latestRelease.tag,
          }),
          errors, alert.node_id
        );
        if (didSend) sent++;
      }
    }
  }

  // --- 2. Balance check (tiered by projected days of fee runway) ---
  const thresholdDays = estimateBalanceThresholdDays(alert);
  const daysRemaining = estimateL1DaysRemaining(validator.remainingBalance);
  if (alert.balance_alert && daysRemaining <= thresholdDays) {
    const urgentDays = Math.max(1, thresholdDays * 0.25);

    if (daysRemaining <= 7) {
      const didSend = await trySend(
        alert.id, alert.email, 'balance_critical',
        balanceCriticalTemplate({
          alertId: alert.id, nodeId: alert.node_id, label: alert.label,
          chainName, remainingBalance: validator.remainingBalance, daysRemaining,
        }),
        errors, alert.node_id
      );
      if (didSend) sent++;
    } else if (daysRemaining <= urgentDays) {
      const didSend = await trySend(
        alert.id, alert.email, 'balance_low_urgent',
        balanceLowAlertTemplate({
          alertId: alert.id, nodeId: alert.node_id, label: alert.label,
          chainName, remainingBalance: validator.remainingBalance,
          thresholdDays, daysRemaining, urgency: 'urgent',
        }),
        errors, alert.node_id
      );
      if (didSend) sent++;
    } else {
      const didSend = await trySend(
        alert.id, alert.email, 'balance_low',
        balanceLowAlertTemplate({
          alertId: alert.id, nodeId: alert.node_id, label: alert.label,
          chainName, remainingBalance: validator.remainingBalance,
          thresholdDays, daysRemaining, urgency: 'notice',
        }),
        errors, alert.node_id
      );
      if (didSend) sent++;
    }
  }

  return { sent, errors };
}
