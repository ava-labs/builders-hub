/**
 * Import the subscribers of the retired Avalanche Notify service into ValidatorAlert.
 *
 * Input: a scan export of the old `notifications` table (hash key NodeID, range key Email):
 *   aws dynamodb scan --table-name notifications --output json > <path outside the repo>/notify.json
 * Keep the export out of git. Delete it after the import.
 *
 * Usage:
 *   tsx ./scripts/notify-migration/import.ts <scan export> [--apply] [--active-only]
 *
 *   --dry-run      Default. Read the database, print counts, write nothing.
 *   --apply        Write the rows (createMany, batches of 500). No welcome emails.
 *   --active-only  Skip nodes that are not in the current Primary Network validator set.
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
import {
  PRIMARY,
  attributeCensus,
  chunk,
  extractPairs,
  pairKey,
  parseScanExport,
  planImport,
  userNodeKey,
} from './map';

const P2P_API_URL = `${EXPLORER_API_BASE}/api/mainnet/fleet/validators`;
const WRITE_BATCH = 500;
const READ_BATCH = 1000;

interface Args {
  file: string;
  apply: boolean;
  activeOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const known = new Set(['--dry-run', '--apply', '--active-only']);
  for (const flag of flags) if (!known.has(flag)) throw new Error(`Unknown flag ${flag}.`);
  if (flags.has('--dry-run') && flags.has('--apply')) throw new Error('Give --dry-run or --apply, not both.');
  const [file] = argv.filter((a) => !a.startsWith('--'));
  if (!file) throw new Error('Give the path to the scan export.');
  return { file, apply: flags.has('--apply'), activeOnly: flags.has('--active-only') };
}

/** NodeIDs in the current Primary Network validator set. Throws when the source is down. */
async function fetchActiveNodes(): Promise<Set<string>> {
  const res = await fetch(P2P_API_URL, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Validator set request failed (${res.status}). Run again, or omit --active-only.`);
  const validators = (await res.json()) as { node_id: string }[];
  if (!Array.isArray(validators) || validators.length === 0) throw new Error('The validator set is empty.');
  return new Set(validators.map((v) => v.node_id));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
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

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? 'apply' : 'dry-run',
        activeOnly: args.activeOnly,
        attributes: attributeCensus(items),
        extract,
        plan,
        inserted,
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
