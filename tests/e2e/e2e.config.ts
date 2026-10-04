import { existsSync } from 'node:fs';
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { anthropic } from '@ai-sdk/anthropic';

// Local runs read ANTHROPIC_API_KEY from .env.local (gitignored). CI passes it as a secret.
const envFile = new URL('.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Agent steps (agent.act, agent.assert) use this model. Without a key there is no agent, and the tests that
// need one skip (needsModel in lib/skip.ts).
const agents = process.env.ANTHROPIC_API_KEY ? { default: { model: anthropic('claude-sonnet-5-5') } } : undefined;

// The site under test: a local dev server, or a Vercel preview in CI.
const url = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Vercel previews are behind SSO. The bypass header opens them, and the engine sends it only to the app's site.
// Without the secret no header is set, because headers also turn off the HTTP cache and service workers.
// A preview also shows the Vercel Toolbar, a round button at the right edge of the screen. It covers the page in
// screenshots, and an agent.assert reads it as part of the site. x-vercel-skip-toolbar turns it off.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
export const headers = bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-skip-toolbar': '1' } : undefined;

// One identity for every preview URL, so the replay cache keys stay stable.
export const app = { url, identity: 'builders-hub' };

// The engine emulates a phone by size and user agent only: no touch and no device scale factor.
export const PHONE_VIEWPORT = { width: 390, height: 844 };
const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export default {
  // API tests have their own config (api/e2e.config.ts), so they run once and not at each size.
  // In-app browser tests have their own targets (webview/e2e.config.ts).
  tests: ['**/*.e2e.ts', '!api/**', '!webview/**'],
  targets: [
    { name: 'desktop', engine: web({ viewport: { width: 1440, height: 900 }, headers }), app },
    { name: 'phone', engine: web({ viewport: PHONE_VIEWPORT, userAgent: PHONE_UA, headers }), app },
  ],
  // A dev server compiles each route on its first visit, which can take 30 s or more.
  timeout: 180_000,
  assertionTimeout: 30_000,
  reporters: ['list', 'junit', 'markdown'],
  ...(agents && { agents }),
} satisfies E2EConfig;
