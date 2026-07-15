/**
 * Terminal reporter that reports each root cause ONCE.
 *
 * Playwright's `list` reporter prints a full error block per failing test,
 * so one broken component embedded on N pages produces N near-identical
 * reports. This reporter keeps the compact per-test progress lines but
 * replaces the failure blocks with one block per root cause (grouping
 * logic shared with the CI summarizer via ../lib/failure-groups).
 *
 * Per-page detail (screenshots, traces) remains in the HTML report and
 * artifacts — this changes what you read, not what's recorded.
 */

import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { groupFailures, routeOf, type FailureRecord } from '../lib/failure-groups.mts';

const ANSI = /\[[0-9;]*m/g;

class RootCauseReporter implements Reporter {
  private failures: FailureRecord[] = [];
  private passed = 0;
  private skipped = 0;
  private flaky = 0;

  // Forward test stdout/stderr (like the built-in list reporter). The flow
  // tier dumps the full P-Chain RPC exchange on a tx failure via
  // console.log — without this it'd be swallowed and a failed scheduled run
  // would lose its only diagnostic.
  onStdOut(chunk: string | Buffer): void {
    process.stdout.write(chunk);
  }

  onStdErr(chunk: string | Buffer): void {
    process.stderr.write(chunk);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Only the final attempt counts; a retry that passes is flaky, not failed.
    const willRetry = result.status !== 'passed' && result.retry < test.retries;
    if (willRetry) return;

    const outcome = test.outcome();
    if (outcome === 'skipped') {
      this.skipped++;
      console.log(`  -  ${test.title} (skipped)`);
      return;
    }
    if (outcome === 'expected') {
      this.passed++;
      console.log(`  ✓  ${test.title} (${(result.duration / 1000).toFixed(1)}s)`);
      return;
    }
    if (outcome === 'flaky') {
      this.flaky++;
      console.log(`  ±  ${test.title} (flaky, passed on retry)`);
      return;
    }

    console.log(`  ✘  ${test.title} (${(result.duration / 1000).toFixed(1)}s)`);
    this.failures.push({
      title: test.title,
      route: routeOf(test.title),
      error: result.error?.message ?? '(no error message)',
      missingTools: test.annotations.find((a) => a.type === 'missing-tools')?.description,
    });
  }

  onEnd(result: FullResult): void {
    const groups = groupFailures(this.failures);

    console.log('');
    if (groups.length === 0) {
      console.log(`  ${this.passed} passed${this.skipped ? `, ${this.skipped} skipped` : ''}${this.flaky ? `, ${this.flaky} flaky` : ''}`);
      return;
    }

    console.log(
      `  ${this.failures.length} failing test(s) → ${groups.length} distinct root cause(s)\n`,
    );
    groups.forEach((g, i) => {
      console.log(`  ${i + 1}) ${g.title}`);
      console.log(`     ${g.routes.length} page(s) affected:`);
      for (const r of g.routes) console.log(`       - ${r}`);
      // One representative error, not one per page.
      const sample = g.sample
        .replace(ANSI, '')
        .split('\n')
        .slice(0, 6)
        .map((l) => `     │ ${l}`)
        .join('\n');
      console.log(`${sample}\n`);
    });
    console.log(
      `  ${this.passed} passed, ${this.failures.length} failed (${groups.length} root cause(s))${this.skipped ? `, ${this.skipped} skipped` : ''}${this.flaky ? `, ${this.flaky} flaky` : ''}`,
    );
    console.log('  per-page traces: yarn playwright show-report e2e/artifacts/html-report');
  }

  printsToStdio(): boolean {
    return true;
  }
}

export default RootCauseReporter;
