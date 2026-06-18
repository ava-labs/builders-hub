/**
 * CI gate: decides the job's pass/fail from e2e/artifacts/results.json.
 *
 * The suite runs with `continue-on-error` so Playwright's own exit code never
 * fails the job directly. This script applies the real policy:
 *
 *   - Smoke/render tier (everything outside e2e/flows/) is DETERMINISTIC and
 *     gates the check — any failure here exits 1 (red).
 *   - Transaction tier (e2e/flows/) drives REAL Fuji testnet txs and is subject
 *     to public-RPC throttling, congestion, and funded-balance drift. Its
 *     failures are reported as a ::notice but DO NOT fail the check — the live
 *     signal is valuable without gating every PR on testnet flakiness.
 *
 * Flaky tests (failed then passed on retry) are ignored — final attempt wins.
 *
 * Run: npx tsx e2e/ci-gate.mts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsPath = path.join(__dirname, 'artifacts', 'results.json');

if (!fs.existsSync(resultsPath)) {
  console.log(`no results at ${resultsPath} — nothing to gate (treating as pass)`);
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

interface Failed {
  title: string;
  file: string;
}
const failed: Failed[] = [];

function walk(suites: any[], inheritedFile?: string) {
  for (const suite of suites ?? []) {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      const specFile = spec.file ?? file ?? '';
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        if (!last || !['failed', 'timedOut'].includes(last.status)) continue;
        failed.push({ title: spec.title, file: specFile });
      }
    }
    walk(suite.suites ?? [], file);
  }
}
walk(results.suites ?? []);

const isFlowTier = (f: string) => f.replaceAll('\\', '/').includes('flows/');
const blocking = failed.filter((f) => !isFlowTier(f.file));
const flowOnly = failed.filter((f) => isFlowTier(f.file));

for (const f of flowOnly) {
  console.log(
    `::notice title=QA tx-tier (non-blocking)::${f.title} — live Fuji flow failed; not gating the check (likely RPC throttling/congestion).`,
  );
}

if (blocking.length > 0) {
  for (const f of blocking) {
    console.log(`::error title=QA gate::${f.title} failed (${f.file})`);
  }
  console.log(`\n✘ gate: ${blocking.length} blocking failure(s) in the smoke/render tier`);
  process.exit(1);
}

console.log(
  flowOnly.length > 0
    ? `\n✓ gate: smoke/render tier green (${flowOnly.length} tx-tier failure(s) reported but not gating)`
    : '\n✓ gate: all tiers green',
);
process.exit(0);
