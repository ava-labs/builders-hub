/**
 * Playwright config for the Builders Hub QA harness.
 *
 * Targets (QA_TARGET_URL):
 *   - local dev:        http://localhost:3000  (default — run `yarn dev` first)
 *   - Vercel preview:   set QA_TARGET_URL to the preview URL and
 *                       VERCEL_AUTOMATION_BYPASS_SECRET to unlock deployment
 *                       protection (Settings → Deployment Protection →
 *                       Protection Bypass for Automation on the builder-hub
 *                       project)
 *   - production:       https://build.avax.network (read-only smoke only!)
 *
 * Run: yarn e2e            (all smoke specs)
 *      yarn e2e --grep icm (subset)
 */

import { defineConfig } from '@playwright/test';

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: '.',
  outputDir: './artifacts/test-output',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: './artifacts/results.json' }],
    ['html', { outputFolder: './artifacts/html-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.QA_TARGET_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...(bypassSecret
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': bypassSecret,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
