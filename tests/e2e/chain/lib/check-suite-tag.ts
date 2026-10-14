// The guard of `npm run test:chain`: one suite per process. The chain test files share one signer per process
// (lib/fixtures.ts), and the sends audit of each file counts every send of that signer. So a run needs exactly one
// --tag, and that tag must name one suite. A tag that more than one file carries ('chain', 'weekly'), a list of tags,
// or two --tag options would run more than one file in one process.
//
// package.json runs it before e2e, with the same arguments:
//
//   node chain/lib/check-suite-tag.ts --tag tier1   # exit 0
//   node chain/lib/check-suite-tag.ts --tag chain   # exit 2, with the usage

import { argv, exit } from 'node:process';

const SUITE_TAGS = ['tier1', 'pos', 'bridge', 'stake-reads', 'stake-acp236', 'stake-fixed'];

const args = argv.slice(2);
const tags: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tag') tags.push(args[++i] ?? '');
  else if (args[i].startsWith('--tag=')) tags.push(args[i].slice('--tag='.length));
}

let problem: string | undefined;
if (tags.length === 0) problem = 'no --tag';
else if (tags.length > 1) problem = `${tags.length} --tag options`;
else if (!SUITE_TAGS.includes(tags[0])) problem = `the tag '${tags[0]}', which is not the tag of one suite`;

if (problem) {
  console.error(
    `test:chain runs one suite per process, and got ${problem}. Give exactly one --tag, with one of: ` +
      `${SUITE_TAGS.join(', ')}.\n  npm run test:chain -- --tag tier1`,
  );
  exit(2);
}
