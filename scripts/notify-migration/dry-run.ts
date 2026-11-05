/**
 * Census of an Avalanche Notify scan export before the import. Reads only. Writes nothing.
 *
 * Input: a scan export of the old `notifications` table (hash key NodeID, range key Email):
 *   aws dynamodb scan --table-name notifications --output json > <path outside the repo>/notify.json
 *
 * Usage:
 *   tsx ./scripts/notify-migration/dry-run.ts <scan export>
 *
 * Output: attribute names, and counts of items, skipped items, unique pairs, nodes that
 * still validate the Primary Network, addresses with a Builder Hub account, and pairs that
 * ValidatorAlert already holds. The script never prints an email.
 * Read the attribute names before the import: an unsubscribe, confirmed or sign-up time
 * attribute needs a rule in scripts/notify-migration/map.ts.
 */

import fs from 'fs';
import { prisma } from '@/prisma/prisma';
import { EXPLORER_API_BASE } from '@/lib/pchain-explorer';
import { PRIMARY, attributeCensus, chunk, extractPairs, pairKey, parseScanExport } from './map';

const READ_BATCH = 1000;

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) throw new Error('Give the path to the scan export.');

  const items = parseScanExport(JSON.parse(fs.readFileSync(file, 'utf8')));
  const { pairs, report } = extractPairs(items);
  const emails = [...new Set(pairs.map((p) => p.email))];
  const nodes = [...new Set(pairs.map((p) => p.node_id))];
  const pairKeys = new Set(pairs.map((p) => pairKey(p.email, p.node_id)));

  // Nodes that still validate the Primary Network. null when the source is down.
  const res = await fetch(`${EXPLORER_API_BASE}/api/mainnet/fleet/validators`, { cache: 'no-store' });
  const active = res.ok ? new Set(((await res.json()) as { node_id: string }[]).map((v) => v.node_id)) : null;

  let emailsWithAccount = 0;
  for (const batch of chunk(emails, READ_BATCH)) {
    emailsWithAccount += await prisma.user.count({ where: { email: { in: batch } } });
  }

  let pairsAlreadyInValidatorAlert = 0;
  for (const batch of chunk(nodes, READ_BATCH)) {
    const alerts = await prisma.validatorAlert.findMany({
      where: { node_id: { in: batch }, subnet_id: PRIMARY },
      select: { email: true, node_id: true },
    });
    pairsAlreadyInValidatorAlert += alerts.filter((a) => pairKeys.has(pairKey(a.email, a.node_id))).length;
  }

  console.log(
    JSON.stringify(
      {
        attributes: attributeCensus(items),
        ...report,
        uniquePairs: pairs.length,
        uniqueEmails: emails.length,
        uniqueNodes: nodes.length,
        nodesStillValidatingPrimary: active ? nodes.filter((n) => active.has(n)).length : null,
        emailsWithBuilderHubAccount: emailsWithAccount,
        pairsAlreadyInValidatorAlert,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? `${err.name}: ${err.message.split('\n')[0]}` : 'Dry run failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
