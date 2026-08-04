/**
 * CI failure summary, deduped by root cause (grouping logic shared with
 * the terminal reporter via lib/failure-groups).
 *
 * Reads e2e/artifacts/results.json and emits, per root cause (not per
 * page): one ::error workflow annotation and one GITHUB_STEP_SUMMARY row.
 * Exit code is always 0 — Playwright's own exit code decides pass/fail;
 * this is reporting only.
 *
 * Run: yarn qa:summary
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupFailures, routeOf, type FailureRecord } from './lib/failure-groups.mts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsPath = path.join(__dirname, 'artifacts', 'results.json');

if (!fs.existsSync(resultsPath)) {
  console.log(`no results at ${resultsPath} — nothing to summarize`);
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

const failures: FailureRecord[] = [];

function walk(suites: any[]) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        // Final outcome only: a test that passed on retry is flaky, not failed.
        const last = t.results?.[t.results.length - 1];
        if (!last || !['failed', 'timedOut'].includes(last.status)) continue;
        failures.push({
          title: spec.title,
          route: routeOf(spec.title),
          error: last.error?.message ?? '(no error message)',
          missingTools: (t.annotations ?? []).find((a: any) => a.type === 'missing-tools')
            ?.description,
        });
      }
    }
    walk(suite.suites ?? []);
  }
}
walk(results.suites ?? []);

if (failures.length === 0) {
  console.log('✓ no failures to summarize');
  process.exit(0);
}

const groups = groupFailures(failures);

// ── stdout ──────────────────────────────────────────────────────────
console.log(`\n${failures.length} failing test(s) → ${groups.length} distinct root cause(s)\n`);
for (const g of groups) {
  console.log(`✘ ${g.title}`);
  console.log(`  ${g.routes.length} page(s) affected:`);
  for (const r of g.routes) console.log(`    - ${r}`);
  console.log('');
}

// ── CI: one annotation per root cause + step summary ───────────────
if (process.env.CI) {
  for (const g of groups) {
    const list = g.routes.join(', ');
    console.log(`::error title=QA: ${g.title} (${g.routes.length} page(s))::${list}`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `## Academy E2E failures — ${failures.length} test(s), ${groups.length} root cause(s)`,
    '',
    '| Root cause | Pages affected |',
    '|---|---|',
    ...groups.map((g) => `| ${g.title} | ${g.routes.map((r) => `\`${r}\``).join('<br>')} |`),
    '',
  ].join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
