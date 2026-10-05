// Preflight of the Console chain tests: checks the key and its Fuji balances before a run sends anything.
//
//   node chain/lib/preflight.ts [--min-p-avax 0.3]
//
// Fails (exit 1) when no test key is set (E2E_CHAIN_FUJI_KEY_FILE or E2E_CHAIN_FUJI_KEY), when the endpoints are not
// Fuji, or when the P-Chain balance is below the minimum: Convert to L1 locks 0.02 AVAX per validator, and the later
// tools add more. Warns when the C-Chain balance is low (the deploys cost gas). Prints the addresses, never the key.

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEther, formatEther } from 'viem';
import { NANO_AVAX, assertFuji, cBalance, formatNanoAvax, keyAddresses, pBalance, readFujiKey } from './chain.ts';

const C_WARN_WEI = parseEther('0.01');

function minPAvax(argv: string[]): bigint {
  const i = argv.indexOf('--min-p-avax');
  const value = i >= 0 ? argv[i + 1] : '0.3';
  if (!value || !/^\d+(\.\d{1,9})?$/.test(value)) throw new Error(`--min-p-avax needs an amount in AVAX, got ${value}`);
  const [whole, frac = ''] = value.split('.');
  return BigInt(whole) * NANO_AVAX + BigInt(frac.padEnd(9, '0'));
}

async function main(): Promise<void> {
  const min = minPAvax(process.argv.slice(2));
  const { c, p } = keyAddresses(readFujiKey());
  await assertFuji();
  const [pNano, cWei] = [await pBalance(p), await cBalance(c)];

  const lines = [
    `P-Chain ${p}: ${formatNanoAvax(pNano)} AVAX (minimum ${formatNanoAvax(min)})`,
    `C-Chain ${c}: ${formatEther(cWei)} AVAX`,
  ];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Chain test key (Fuji)\n\n- ${lines.join('\n- ')}\n\n`);
  }

  if (cWei < C_WARN_WEI) {
    console.log(
      `::warning title=Chain test key::The C-Chain balance of ${c} is below ${formatEther(C_WARN_WEI)} AVAX.`,
    );
  }
  if (pNano < min) {
    console.log(
      `::error title=Chain test key::The P-Chain balance of ${p} is ${formatNanoAvax(pNano)} AVAX, below ` +
        `${formatNanoAvax(min)}. Fund the key: move AVAX from the C-Chain with the Console's C/P bridge.`,
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
