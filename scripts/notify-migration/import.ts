/**
 * Import the subscribers of the retired Avalanche Notify service into ValidatorAlert.
 *
 * Input: a scan export of the old `notifications` table (hash key NodeID, range key Email):
 *   aws dynamodb scan --table-name notifications --output json > <path outside the repo>/notify.json
 * Keep the export out of git. Delete it after the import.
 *
 * Usage:
 *   tsx ./scripts/notify-migration/import.ts <scan export> [--apply] [--active-only] [--send-notice]
 *
 *   --dry-run      Default. Read the database, print counts, write nothing, send nothing.
 *   --apply        Write the rows (createMany, batches of 500). No welcome emails.
 *   --active-only  Skip nodes that are not in the current Primary Network validator set.
 *   --send-notice  Off by default. After the import, send the one-time migration notice:
 *                  one email per address that has active imported rows and no notice yet,
 *                  with a signed unsubscribe link per alert. A notice log on each row
 *                  records the send, so a second run skips the address. Without --apply
 *                  it sends nothing and counts the addresses whose rows the database holds now. Sending needs the production SENDGRID_API_KEY,
 *                  EMAIL_FROM and VALIDATOR_ALERTS_API_KEY (the unsubscribe link secret).
 *
 * Rules (scripts/notify-migration/map.ts): a valid NodeID, a plaintext email, one row per
 * (email, NodeID), subnet "primary", source "avalanche-notify". A pair that ValidatorAlert
 * already holds is skipped, so a second run adds nothing. user_id is the User with the same
 * email, else null; sign-in attaches null rows later (server/services/legacy-validator-alerts.ts).
 *
 * Output: counts and attribute names only. The script never prints an email.
 */

import fs from 'fs';
import { prisma } from '@/prisma/prisma';
import { EXPLORER_API_BASE } from '@/lib/pchain-explorer';
import { LEGACY_NOTICE_ALERT_TYPE, LEGACY_NOTIFY_END, LEGACY_NOTIFY_SOURCE } from '@/server/services/legacy-validator-alerts';
import { legacyNotifyNoticeTemplate } from '@/server/templates/validator-alerts';
import {
  PRIMARY,
  attributeCensus,
  chunk,
  extractPairs,
  groupNotices,
  pairKey,
  parseScanExport,
  planImport,
  userNodeKey,
} from './map';

const P2P_API_URL = `${EXPLORER_API_BASE}/api/mainnet/fleet/validators`;
const WRITE_BATCH = 500;
const READ_BATCH = 1000;
/** The day the old service stops. */
const OLD_SERVICE_END = LEGACY_NOTIFY_END;

interface Args {
  file: string;
  apply: boolean;
  activeOnly: boolean;
  sendNotice: boolean;
}

function parseArgs(argv: string[]): Args {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const known = new Set(['--dry-run', '--apply', '--active-only', '--send-notice']);
  for (const flag of flags) if (!known.has(flag)) throw new Error(`Unknown flag ${flag}.`);
  if (flags.has('--dry-run') && flags.has('--apply')) throw new Error('Give --dry-run or --apply, not both.');
  const [file] = argv.filter((a) => !a.startsWith('--'));
  if (!file) throw new Error('Give the path to the scan export.');
  return {
    file,
    apply: flags.has('--apply'),
    activeOnly: flags.has('--active-only'),
    sendNotice: flags.has('--send-notice'),
  };
}

/** NodeIDs in the current Primary Network validator set. Throws when the source is down. */
async function fetchActiveNodes(): Promise<Set<string>> {
  const res = await fetch(P2P_API_URL, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Validator set request failed (${res.status}). Run again, or omit --active-only.`);
  const validators = (await res.json()) as { node_id: string }[];
  if (!Array.isArray(validators) || validators.length === 0) throw new Error('The validator set is empty.');
  return new Set(validators.map((v) => v.node_id));
}

/** Refuse to send with a missing secret: an unsigned or wrongly signed unsubscribe link fails. */
function requireMailEnv(): void {
  const missing = ['SENDGRID_API_KEY', 'EMAIL_FROM'].filter((name) => !process.env[name]);
  if (!process.env.VALIDATOR_ALERTS_API_KEY && !process.env.CRON_SECRET) missing.push('VALIDATOR_ALERTS_API_KEY');
  if (missing.length > 0) throw new Error(`--send-notice needs ${missing.join(', ')}.`);
}

/** Send the migration notice to each address that has not had one. Counts only. */
async function sendNotices(apply: boolean) {
  const rows = await prisma.validatorAlert.findMany({
    where: { source: LEGACY_NOTIFY_SOURCE, active: true },
    select: {
      id: true,
      email: true,
      node_id: true,
      alert_logs: { where: { alert_type: LEGACY_NOTICE_ALERT_TYPE }, select: { id: true }, take: 1 },
    },
    orderBy: { created_at: 'asc' },
  });
  const { groups, alreadyNoticed } = groupNotices(
    rows.map((r) => ({ id: r.id, email: r.email, node_id: r.node_id, noticed: r.alert_logs.length > 0 })),
  );
  const report = { addresses: groups.length, alreadyNoticed, sent: 0, failed: 0 };
  if (!apply) return report;

  // Load SendGrid only when it sends.
  const { sendMail } = await import('@/server/services/mail');
  for (const group of groups) {
    const notice = legacyNotifyNoticeTemplate({ alerts: group.alerts, endDate: OLD_SERVICE_END });
    try {
      await sendMail(group.email, notice.html, notice.subject, notice.text, { logRecipient: false });
    } catch {
      report.failed++;
      continue;
    }
    await prisma.validatorAlertLog.createMany({
      data: group.alerts.map((a) => ({
        validator_alert_id: a.alertId,
        alert_type: LEGACY_NOTICE_ALERT_TYPE,
        message: notice.text,
      })),
    });
    report.sent++;
  }
  return report;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.sendNotice && args.apply) requireMailEnv();
  const items = parseScanExport(JSON.parse(fs.readFileSync(args.file, 'utf8')));
  const { pairs, report: extract } = extractPairs(items);

  const emails = [...new Set(pairs.map((p) => p.email))];
  const nodes = [...new Set(pairs.map((p) => p.node_id))];

  const userIdByEmail = new Map<string, string>();
  for (const batch of chunk(emails, READ_BATCH)) {
    const users = await prisma.user.findMany({ where: { email: { in: batch } }, select: { id: true, email: true } });
    for (const u of users) if (u.email) userIdByEmail.set(u.email, u.id);
  }

  const existingPairs = new Set<string>();
  const existingUserNodes = new Set<string>();
  for (const batch of chunk(nodes, READ_BATCH)) {
    const alerts = await prisma.validatorAlert.findMany({
      where: { node_id: { in: batch }, subnet_id: PRIMARY },
      select: { email: true, node_id: true, subnet_id: true, user_id: true },
    });
    for (const a of alerts) {
      existingPairs.add(pairKey(a.email, a.node_id, a.subnet_id));
      if (a.user_id) existingUserNodes.add(userNodeKey(a.user_id, a.node_id, a.subnet_id));
    }
  }

  const activeNodes = args.activeOnly ? await fetchActiveNodes() : null;
  const { rows, report: plan } = planImport(pairs, { existingPairs, existingUserNodes, userIdByEmail, activeNodes });

  let inserted = 0;
  if (args.apply) {
    for (const batch of chunk(rows, WRITE_BATCH)) {
      const result = await prisma.validatorAlert.createMany({ data: batch });
      inserted += result.count;
    }
  }

  const notice = args.sendNotice ? await sendNotices(args.apply) : null;

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? 'apply' : 'dry-run',
        activeOnly: args.activeOnly,
        attributes: attributeCensus(items),
        extract,
        plan,
        inserted,
        notice,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err: unknown) => {
    // Prisma errors can quote row values. Print the message class only.
    console.error(err instanceof Error ? `${err.name}: ${err.message.split('\n')[0]}` : 'Import failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
