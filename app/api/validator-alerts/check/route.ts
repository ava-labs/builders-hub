import { NextRequest, NextResponse } from 'next/server';
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
const COOLDOWNS: Record<AlertType, number> = {
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

async function fetchValidators(): Promise<ValidatorP2P[]> {
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
 *
 * Classification rules (derived from actual AvalancheGo release notes):
 *   - Mandatory: release body contains "must upgrade before" or "mandatory"
 *     → extract the deadline date from the body text
 *   - Optional: body contains "optional, but encouraged" or does not match mandatory
 *   - Pre-release / Fuji-only: skipped entirely (mainnet service only)
 */
async function fetchLatestRelease(): Promise<ReleaseClassification> {
  const res = await fetch(`${GITHUB_RELEASES_URL}?per_page=10`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

  const releases: GitHubRelease[] = await res.json();

  // Find the latest stable (non-prerelease, non-fuji) release
  const stable = releases.find(
    (r) => !r.prerelease && !r.tag_name.includes('fuji')
  );
  if (!stable) throw new Error('No stable release found');

  const tag = stable.tag_name.startsWith('v')
    ? stable.tag_name.slice(1)
    : stable.tag_name;
  const normalizedTag = `avalanchego/${tag}`;
  const body = stable.body ?? '';

  // Detect mandatory upgrades
  const isMandatory = detectMandatory(body);

  if (isMandatory) {
    const deadline = extractDeadline(body);
    const acps = extractACPs(body);
    return { tag: normalizedTag, type: 'mandatory', deadline, acps };
  }

  return { tag: normalizedTag, type: 'optional', deadline: null, acps: [] };
}

/**
 * Detect whether a release is mandatory by checking multiple patterns
 * observed across historical AvalancheGo releases.
 */
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

/**
 * Extract the upgrade deadline from release notes.
 * Handles patterns like:
 *   "must upgrade before 11 AM ET, November 19th 2025"
 *   "must upgrade by November 19, 2025 at 4 PM UTC"
 *   "must be upgraded before 4:00 PM UTC on November 19th, 2025"
 */
function extractDeadline(body: string): Date | null {
  // Pattern 1: "must upgrade before/by <datetime>"
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

/**
 * Map common timezone abbreviations to UTC offsets.
 * AvalancheGo release notes typically use ET, EST, EDT, UTC, PT, PST, PDT.
 */
const TZ_OFFSETS: Record<string, string> = {
  UTC: '+00:00', GMT: '+00:00',
  ET: '-05:00', EST: '-05:00', EDT: '-04:00',
  CT: '-06:00', CST: '-06:00', CDT: '-05:00',
  MT: '-07:00', MST: '-07:00', MDT: '-06:00',
  PT: '-08:00', PST: '-08:00', PDT: '-07:00',
};

/**
 * Try to parse a human-written date/time string.
 * Handles formats like:
 *   "11 AM ET, November 19th 2025"
 *   "4 PM UTC on November 19th, 2025"
 *   "4:00 PM UTC on November 19th, 2025"
 *   "November 19, 2025 at 4 PM UTC"
 */
function tryParseDate(dateStr: string): Date | null {
  // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
  let cleaned = dateStr.replace(/(\d+)(?:st|nd|rd|th)/g, '$1');
  // Remove filler words
  cleaned = cleaned.replace(/\b(?:on|at)\b/gi, '').replace(/\s{2,}/g, ' ').trim();

  // Extract and remove timezone abbreviation, remember the offset
  let tzOffset = '';
  cleaned = cleaned.replace(/\b(UTC|GMT|E[SD]?T|C[SD]?T|M[SD]?T|P[SD]?T)\b/gi, (match) => {
    tzOffset = TZ_OFFSETS[match.toUpperCase()] || '';
    return '';
  }).replace(/\s{2,}/g, ' ').trim();

  // Normalize: if time comes before the date part, move it after
  // "11 AM, November 19 2025" → "November 19 2025 11 AM"
  const timeFirst = cleaned.match(/^([\d:]+\s*[AP]M),?\s*(.+)$/i);
  if (timeFirst) {
    cleaned = `${timeFirst[2]} ${timeFirst[1]}`;
  }

  // Ensure there's a comma between month+day and year if missing
  // "November 19 2025" → "November 19, 2025"
  cleaned = cleaned.replace(
    /([A-Za-z]+\s+\d{1,2})\s+(\d{4})/,
    '$1, $2'
  );

  // Try parsing the cleaned string
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2020) {
    // Apply timezone offset if we extracted one and Date parsed as local
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

/**
 * Extract ACP numbers mentioned in the release body.
 */
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

async function wasRecentlySent(
  alertId: string,
  alertType: AlertType
): Promise<boolean> {
  const cooldownHours = COOLDOWNS[alertType];
  if (cooldownHours === Infinity) {
    // One-shot: any past send blocks future sends
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

async function trySend(
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
// Main handler
// ---------------------------------------------------------------------------

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
    let validators: ValidatorP2P[] = [];
    let latestRelease: ReleaseClassification | null = null;
    let dataErrors: string[] = [];

    // Fetch data sources independently so one failure doesn't block the other
    const [validatorResult, releaseResult] = await Promise.allSettled([
      fetchValidators(),
      fetchLatestRelease(),
    ]);

    if (validatorResult.status === 'fulfilled') {
      validators = validatorResult.value;
    } else {
      dataErrors.push(`P2P API error: ${validatorResult.reason}`);
    }

    if (releaseResult.status === 'fulfilled') {
      latestRelease = releaseResult.value;
    } else {
      dataErrors.push(`GitHub API error: ${releaseResult.reason}`);
    }

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

    const validatorMap = new Map<string, ValidatorP2P>();
    for (const v of validators) {
      validatorMap.set(v.node_id, v);
    }

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
          // Mandatory but couldn't parse deadline — treat as notice
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
          // Optional release
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
      // Skip if already expired (negative days_left)
      if (alert.expiry_alert && validator.days_left >= 0) {
        const endTime = new Date(validator.end_time);
        const hoursToExpiry = (endTime.getTime() - Date.now()) / 3_600_000;

        if (hoursToExpiry <= 1 && hoursToExpiry > 0) {
          // Critical: < 1 hour
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
          // Urgent: < 1 day
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
          // First alert: within user threshold
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
