import type { E2EConfig } from 'e2e';

// API tests run once, on a target with no browser. A target with no engine has no app,
// so the tests read the site URL from E2E_BASE_URL (app-fetch.ts).
export default {
  tests: ['**/*.e2e.ts'],
  targets: [{ name: 'api', platform: 'api' }],
  reporters: ['list', 'junit', 'markdown'],
} satisfies E2EConfig;
