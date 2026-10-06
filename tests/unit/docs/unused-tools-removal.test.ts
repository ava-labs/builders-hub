import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// next.config.mjs wraps its config in fumadocs-mdx's createMDX; the redirects are plain data under it.
vi.mock('fumadocs-mdx/next', () => ({ createMDX: () => (config: unknown) => config }));

import nextConfig from '@/next.config.mjs';
import { toolingOptions } from '@/components/navigation/docs-nav-config';
import { firstRedirect, type RedirectRule } from '../academy/helpers/redirects';

const ROOT = process.cwd();
const REMOVED = ['avalanche-cli', 'avalanche-postman', 'interchain-kit'];
const INTO_REMOVED = /\/docs\/tooling\/(avalanche-cli|avalanche-postman|interchain-kit)(?![\w-])/;
const PLATFORM_CLI = '/docs/tooling/platform-cli';
const ICM_LOCAL = '/docs/cross-chain/icm-contracts/icm-contracts-on-local-network';
const ICM_DEVNET = '/docs/cross-chain/icm-contracts/icm-contracts-on-devnet';
// A yarn build:remote page: gitignored, so unit CI has no file to check, but production serves it.
const ICTT_OVERVIEW = '/docs/cross-chain/interchain-token-transfer/overview';
const NODE_API_CALLS = '/docs/rpcs/other/guides/issuing-api-calls';
const CROSS_CHAIN = '/docs/cross-chain';
const redirects = (await nextConfig.redirects!()) as RedirectRule[];

// Tracked files only: stale local copies of generated pages would make the result depend on the machine.
const tracked = (...paths: string[]): string[] =>
  execFileSync('git', ['ls-files', '--', ...paths], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => file && existsSync(join(ROOT, file)));

// Screenshots that only the removed pages showed.
const numbered = (name: string, count: number) => Array.from({ length: count }, (_, i) => `${name}${i + 1}.png`);
const IMAGES = [
  'api-call1.png',
  'centralized-logs.png',
  'gcp1.png',
  'run-validators1.png',
  ...numbered('deploy-subnet', 7),
  ...numbered('postman', 6),
  ...numbered('variables', 16),
  ...numbered('visualize', 9),
];

describe('unused and deprecated tools: redirects', () => {
  it.each([
    ['/docs/tooling/avalanche-cli', PLATFORM_CLI],
    ['/docs/tooling/avalanche-cli/get-avalanche-cli', PLATFORM_CLI],
    ['/docs/tooling/avalanche-cli/create-deploy-avalanche-l1s/deploy-on-fuji-testnet', PLATFORM_CLI],
    ['/docs/tooling/avalanche-cli/cross-chain/teleporter-local-network', ICM_LOCAL],
    ['/docs/tooling/avalanche-cli/cross-chain/teleporter-devnet', ICM_DEVNET],
    ['/docs/tooling/avalanche-cli/cross-chain/teleporter-token-bridge', ICTT_OVERVIEW],
    ['/docs/tooling/avalanche-cli/cross-chain', CROSS_CHAIN],
    ['/docs/tooling/avalanche-postman', NODE_API_CALLS],
    ['/docs/tooling/avalanche-postman/variables', NODE_API_CALLS],
    ['/docs/tooling/interchain-kit', CROSS_CHAIN],
    ['/docs/tooling/interchain-kit/tmpnetjs-sdk', CROSS_CHAIN],
  ])('%s answers a 308 to %s', (path, destination) => {
    expect(firstRedirect(redirects, path)).toMatchObject({ destination, permanent: true });
  });

  it.each([
    ['/docs/tooling/cli-commands', PLATFORM_CLI],
    ['/docs/subnets/create-a-subnet', PLATFORM_CLI],
    ['/docs/tooling/transactions/native-send', PLATFORM_CLI],
    ['/docs/tooling/cross-chain', ICM_LOCAL],
    ['/docs/tooling/cross-chain/teleporter-token-bridge', ICTT_OVERVIEW],
    ['/docs/tooling/avalanchego-postman-collection/setup', NODE_API_CALLS],
    ['/docs/avalanche-l1s/deploy-a-avalanche-l1/fuji-testnet', PLATFORM_CLI],
  ])('the older URL %s goes straight to %s', (path, destination) => {
    expect(firstRedirect(redirects, path)?.destination).toBe(destination);
  });

  it('points no redirect into the removed sections', () => {
    expect(redirects.filter((rule) => INTO_REMOVED.test(rule.destination)).map((rule) => rule.source)).toEqual([]);
  });

  it('lands on pages that exist and do not redirect again', () => {
    for (const target of [PLATFORM_CLI, ICM_LOCAL, ICM_DEVNET, NODE_API_CALLS, CROSS_CHAIN]) {
      const page = join(ROOT, 'content', target);
      expect(existsSync(`${page}.mdx`) || existsSync(join(page, 'index.mdx')), target).toBe(true);
    }
    for (const target of [PLATFORM_CLI, ICM_LOCAL, ICM_DEVNET, ICTT_OVERVIEW, NODE_API_CALLS, CROSS_CHAIN]) {
      expect(firstRedirect(redirects, target), target).toBeUndefined();
    }
  });
});

describe('unused and deprecated tools: removal', () => {
  it('deletes the three docs sections and the screenshots only they used', () => {
    expect(REMOVED.filter((tool) => existsSync(join(ROOT, 'content/docs/tooling', tool)))).toEqual([]);
    expect(IMAGES.filter((name) => existsSync(join(ROOT, 'public/images', name)))).toEqual([]);
  });

  it('drops them from the docs Tools menu and keeps tmpnet', () => {
    const urls = toolingOptions.map((option) => option.url);
    expect(urls.filter((url) => INTO_REMOVED.test(url))).toEqual([]);
    expect(urls).toContain('/docs/tooling/tmpnet');
  });

  it('leaves no page, component or MCP tool linking into them', () => {
    const hits = tracked('app', 'components', 'content', 'lib')
      .filter((file) => /\.(tsx?|mdx?|json)$/.test(file))
      .filter((file) => INTO_REMOVED.test(readFileSync(join(ROOT, file), 'utf8')));
    expect(hits).toEqual([]);
  });
});
