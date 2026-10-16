import { expect, test } from 'e2e';
import { appFetch, redirectOf } from './app-fetch';

// /solutions and its four pillar pages were removed. next.config.mjs sends each one to the docs on its topic.
// A Location keeps its #section, but redirectOf returns the path only.
const REDIRECTS = [
  { path: '/solutions', location: '/docs/avalanche-l1s' },
  { path: '/solutions/interoperability', location: '/docs/cross-chain' },
  { path: '/solutions/performance', location: '/docs/primary-network/avalanche-consensus' },
  { path: '/solutions/privacy', location: '/docs/avalanche-l1s' },
  { path: '/solutions/compliance', location: '/docs/avalanche-l1s' },
];

for (const { path, location } of REDIRECTS) {
  test(`${path} redirects for good to ${location}, which opens`, async ({ app }) => {
    expect(await redirectOf(app, path)).toEqual({ status: 308, location });
    expect((await appFetch(app, location)).status).toBe(200);
  });
}
