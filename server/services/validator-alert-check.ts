import { prisma } from '@/prisma/prisma';
import { sendMail } from '@/server/services/mail';
import {
  uptimeAlertTemplate,
  versionMandatoryTemplate,
  versionOptionalTemplate,
  expiryAlertTemplate,
  expiryCriticalTemplate,
} from '@/server/templates/validator-alerts';
import type { ValidatorP2P, AlertType, ReleaseClassification } from '@/types/validator-alerts';

const P2P_API_URL = 'https://52.203.183.9.sslip.io/api/validators';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/ava-labs/avalanchego/releases';

/**
 * Cooldown periods in hours per alert type.
 * Distinct types ensure escalation tiers don't suppress each other.
 */
export const COOLDOWNS: Record<AlertType, number> = {
  uptime: 24,
  version_mandatory: 48,
  version_mandatory_urgent: 12,
  version_mandatory_critical: 4,
  version_optional: 168, // 7 days
  expiry: 72,
  expiry_urgent: 12,
  expiry_critical: Infinity, // one-shot — never re-send
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

// ---------------------------------------------------------------------------
// Per-alert check logic (shared between cron and on-create)
// ---------------------------------------------------------------------------

interface AlertRecord {
  id: string;
  node_id: string;
  email: string;
  label: string | null;
  uptime_alert: boolean;
  uptime_threshold: number;
  version_alert: boolean;
  expiry_alert: boolean;
  expiry_days: number;
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
      const didSend = await trySend(
        alert.id,
        alert.email,
        'version_mandatory',
        versionMandatoryTemplate({
          alertId: alert.id,
          nodeId: alert.node_id,
          label: alert.label,
          currentVersion: validator.version,
          requiredVersion: latestRelease.tag,
          deadline: null,
          acps: latestRelease.acps,
          urgency: 'notice',
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

  return { sent, errors };
}
