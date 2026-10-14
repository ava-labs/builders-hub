// Preflight of the Console chain tests: checks the key and its Fuji balances before a run sends anything.
//
//   node chain/lib/preflight.ts [--min-p-avax 0.3] [--min-c-avax 0]
//
// Fails (exit 1) when no test key is set (E2E_CHAIN_FUJI_KEY_FILE or E2E_CHAIN_FUJI_KEY), when the endpoints are not
// Fuji, when the unlocked P-Chain balance is below --min-p-avax (Convert to L1 locks 0.02 AVAX per validator, and the
// later tools add more), or when the C-Chain balance is below --min-c-avax (the deploys and the PoS stake). Warns when
// the C-Chain balance is below 0.01 AVAX. Prints the addresses, never the key.
//
// It also prints the Primary Network stake of the key (platform.getStake) and the unlock time of each stake record in
// the ledgers under chain/.run (lib/primary-stake.ts). A locked stake does not count in the unlocked P-Chain balance.

import { appendFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEther, formatEther } from 'viem';
import {
  NANO_AVAX,
  assertFuji,
  cBalance,
  formatNanoAvax,
  keyAddresses,
  pBalance,
  pStaked,
  readFujiKey,
} from './chain.ts';
import { ledgerStakes } from './primary-stake.ts';

const C_WARN_WEI = parseEther('0.01');
const WEI_PER_NAVAX = 1_000_000_000n;

/** The value of `--<name>` in AVAX, as nAVAX. */
function avaxArg(argv: string[], name: string, fallback: string): bigint {
  const i = argv.indexOf(`--${name}`);
  const value = i >= 0 ? argv[i + 1] : fallback;
  if (!value || !/^\d+(\.\d{1,9})?$/.test(value)) throw new Error(`--${name} needs an amount in AVAX, got ${value}`);
  const [whole, frac = ''] = value.split('.');
  return BigInt(whole) * NANO_AVAX + BigInt(frac.padEnd(9, '0'));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const minP = avaxArg(argv, 'min-p-avax', '0.3');
  const minCWei = avaxArg(argv, 'min-c-avax', '0') * WEI_PER_NAVAX;
  const { c, p } = keyAddresses(readFujiKey());
  await assertFuji();
  const [pNano, cWei, staked] = [await pBalance(p), await cBalance(c), await pStaked(p)];

  const lines = [
    `P-Chain ${p}: ${formatNanoAvax(pNano)} AVAX unlocked (minimum ${formatNanoAvax(minP)})`,
    `P-Chain stake: ${formatNanoAvax(staked)} AVAX locked`,
    `C-Chain ${c}: ${formatEther(cWei)} AVAX (minimum ${formatEther(minCWei)})`,
  ];
  for (const stake of ledgerStakes()) {
    const unlock = stake.unlockAt ? `unlocks at ${stake.unlockAt}` : 'no unlock time recorded';
    const file = relative(process.cwd(), stake.file);
    lines.push(`Ledger stake ${stake.nodeId} (${stake.kind}, ${stake.state}): ${unlock} (${file})`);
  }
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Chain test key (Fuji)\n\n- ${lines.join('\n- ')}\n\n`);
  }

  if (cWei < C_WARN_WEI) {
    console.log(
      `::warning title=Chain test key::The C-Chain balance of ${c} is below ${formatEther(C_WARN_WEI)} AVAX.`,
    );
  }
  if (pNano < minP) {
    console.log(
      `::error title=Chain test key::The P-Chain balance of ${p} is ${formatNanoAvax(pNano)} AVAX, below ` +
        `${formatNanoAvax(minP)}. Fund the key: move AVAX from the C-Chain with the Console's C/P bridge.`,
    );
    process.exitCode = 1;
  }
  if (cWei < minCWei) {
    console.log(
      `::error title=Chain test key::The C-Chain balance of ${c} is ${formatEther(cWei)} AVAX, below ` +
        `${formatEther(minCWei)}. Fund the key on the Fuji C-Chain.`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
