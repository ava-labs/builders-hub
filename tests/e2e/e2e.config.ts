import { existsSync } from 'node:fs';
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { anthropic } from '@ai-sdk/anthropic';
import { bypassHeaders } from './lib/bypass.ts';

// Local runs read ANTHROPIC_API_KEY from .env.local (gitignored). CI passes it as a secret.
const envFile = new URL('.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Agent steps (agent.act, agent.assert) use this model. Without a key there is no agent, and the tests that
// need one skip (needsModel in lib/skip.ts).
const agents = process.env.ANTHROPIC_API_KEY ? { default: { model: anthropic('claude-sonnet-5-5') } } : undefined;

// The site under test: a local dev server, or a Vercel preview in CI.
const url = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Vercel previews are behind SSO: the bypass header opens them (lib/bypass.ts). It is read after .env.local, which can
// set the secret. lib/visitor.ts hides the Vercel Toolbar of a preview.
export const headers = bypassHeaders();

// The replay cache keys on the app's identity and environment. Both are fixed, so an entry recorded on localhost, a
// preview or production replays on all of them. Without `environment`, e2e reads localhost as 'test' and every other
// host as 'production', and an entry from one never replays on the other. All of them read the same live mainnet data.
export const app = { url, identity: 'builders-hub', environment: 'production' as const };

// After each client-side navigation, Next.js reads the page title into a live region with role alert
// (next/dist/client/components/app-router-announcer.js). The new title can arrive before or after that read, so the
// region holds the full title, a part of it, or nothing. The replay cache checks every alert, so an agent.act step
// recorded with one text fails its replay on another (end-mismatch). This script hides the region from the
// accessibility tree in every document. The cache still checks the route and the controls the step showed or removed.
function hideRouteAnnouncer(): void {
  if (customElements.get('next-route-announcer')) return;
  customElements.define(
    'next-route-announcer',
    class extends HTMLElement {
      connectedCallback() {
        this.setAttribute('aria-hidden', 'true');
      }
    },
  );
}
const initScripts = [hideRouteAnnouncer];

// The engine emulates a phone by size and user agent only: no touch and no device scale factor.
export const PHONE_VIEWPORT = { width: 390, height: 844 };
const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export default {
  // API tests have their own config (api/e2e.config.ts), so they run once and not at each size.
  // In-app browser tests have their own targets (webview/e2e.config.ts).
  // The Console chain tests send Fuji transactions and run only nightly (chain/e2e.config.ts).
  tests: ['**/*.e2e.ts', '!api/**', '!webview/**', '!chain/**'],
  targets: [
    { name: 'desktop', engine: web({ viewport: { width: 1440, height: 900 }, headers, initScripts }), app },
    { name: 'phone', engine: web({ viewport: PHONE_VIEWPORT, userAgent: PHONE_UA, headers, initScripts }), app },
  ],
  // A dev server compiles each route on its first visit, which can take 30 s or more.
  timeout: 180_000,
  assertionTimeout: 30_000,
  reporters: ['list', 'junit', 'markdown'],
  ...(agents && { agents }),
} satisfies E2EConfig;
