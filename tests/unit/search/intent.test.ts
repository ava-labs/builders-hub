import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createContentHighlighter } from 'fumadocs-core/search';
import { describe, expect, it } from 'vitest';
import { TOOLS } from '@/components/toolbox/console/toolbox/tools';
import { highlightTerms, isQuestion, queryWords, searchIntent, VOCABULARY } from '@/lib/search/intent';
import { getFixedSections } from '@/utils/remote-content/sections.mts';

const REPO = path.join(__dirname, '../../..');
const urls = (pages: { url: string }[]) => pages.map((page) => page.url);

describe('queryWords', () => {
  it('keeps the words that carry meaning, without a plural s', () => {
    expect(queryWords('How do I stake my tokens on Avalanche?')).toEqual(['stake', 'token']);
  });

  it('splits on punctuation and drops single letters', () => {
    expect(queryWords('C/P-Chain bridge')).toEqual(['chain', 'bridge']);
  });
});

describe('highlightTerms', () => {
  // fumadocs highlights every term as a substring, so "I" and "to" would light up inside other words
  it('keeps the words that carry meaning, as typed', () => {
    expect(highlightTerms('how much AVAX do I need to stake')).toBe('AVAX stake');
  });

  it('keeps the whole query when no word carries meaning', () => {
    expect(highlightTerms('how to')).toBe('how to');
  });

  // V8 cannot compile a pattern with a word of 32,768 characters or more, and the dialog highlights while it renders
  it('leaves out a pasted word too long for the highlighter', () => {
    const pasted = `faucet${'.'.repeat(40_000)}`;
    for (const query of [pasted, `how ${pasted}`]) {
      expect(() => createContentHighlighter(highlightTerms(query)).highlight('Testnet Faucet')).not.toThrow();
    }
  });
});

describe('isQuestion', () => {
  it.each([
    ['how much AVAX do I need to stake', true],
    ['is avalanche evm compatible', true],
    ['does the faucet work on fuji?', true],
    ['stake avax', false],
    ['how to', false],
    ['faucet?', false],
  ])('%s → %s', (query, expected) => {
    expect(isQuestion(query)).toBe(expected);
  });
});

describe('searchIntent', () => {
  // the search's golden queries: what the dialog shows above and below the pages Algolia finds
  it.each([
    ['subnet', ['/docs/avalanche-l1s'], []],
    ['What is a subnet?', ['/docs/avalanche-l1s'], []],
    ['Subnet-EVM', [], []],
    ['teleporter', ['/docs/cross-chain/icm-contracts/overview'], []],
    [
      'ICM',
      ['/docs/cross-chain/avalanche-warp-messaging/overview'],
      ['/console/icm/setup', '/console/testnet-infra/icm-relayer'],
    ],
    ['faucet', ['/console/primary-network/faucet'], ['/console/primary-network/devnet-faucet']],
    ['testnet AVAX', ['/console/primary-network/faucet'], []],
    ['stake avax', ['/docs/primary-network/validate/how-to-stake', '/console/primary-network/stake'], []],
    [
      'how much AVAX do I need to stake',
      ['/docs/primary-network/validate/how-to-stake', '/console/primary-network/stake'],
      [],
    ],
    [
      'how to become a validator',
      ['/docs/primary-network/validate/node-validator', '/docs/primary-network/validate/how-to-stake'],
      [],
    ],
    ['create my own L1', ['/console/create-l1'], []],
    ['get testnet AVAX', ['/console/primary-network/faucet'], []],
    // a tool named in full, among words about where to use it
    ['add a validator to my L1', ['/console/add-validator'], []],
    ['node setup for an L1', ['/console/layer-1/l1-node-setup', '/console/primary-network/node-setup'], []],
    // "Deploy Your Own" (Encrypted ERC) is one word of these queries, not what they ask for
    ['how do I deploy my own ERC20 token', [], []],
    ['deploy my own L1', [], []],
    ['deploy an encrypted ERC', ['/console/encrypted-erc/deploy'], []],
    // the name is half of the query, which is just enough
    ['add validator fuji testnet', ['/console/add-validator'], []],
    // only the last word can be partial: "stak" is not being typed any more
    ['stak avax', [], []],
    ['node setup', ['/console/primary-network/node-setup'], ['/console/layer-1/l1-node-setup']],
    ['explorer', [], ['/console/layer-1/explorer-setup']],
    ['eth_getBalance', [], []],
  ])('%s', (query, top, bottom) => {
    const intent = searchIntent(query, TOOLS);
    expect(urls(intent.top)).toEqual(top);
    expect(urls(intent.bottom)).toEqual(bottom);
  });

  it('notes the new name under the page of a renamed term', () => {
    expect(searchIntent('subnets', TOOLS).top[0]).toEqual({
      url: '/docs/avalanche-l1s',
      title: 'Avalanche L1s',
      note: 'Subnets are now called L1s.',
    });
  });

  it('shows a tool under its Console category, with its description', () => {
    const faucet = TOOLS.find((tool) => tool.path === '/console/primary-network/faucet');
    expect(searchIntent('faucet', TOOLS).top[0]).toEqual({
      url: '/console/primary-network/faucet',
      title: 'Testnet Faucet',
      label: ['Console', 'Primary Network'],
      note: faucet?.description,
    });
  });

  it('finds a tool from the start of its last word, while it is typed', () => {
    expect(urls(searchIntent('stake av', TOOLS).top)).toEqual(['/console/primary-network/stake']);
  });

  it('leaves out a tool that opens another site', () => {
    expect(searchIntent('ethereum bridge', TOOLS)).toMatchObject({ top: [], bottom: [] });
  });

  it('marks a question', () => {
    expect(searchIntent('how much AVAX do I need to stake', TOOLS).question).toBe(true);
    expect(searchIntent('stake avax', TOOLS).question).toBe(false);
  });
});

// The pages a fresh checkout builds: tracked MDX files, and the pages `yarn build:remote` writes, which are
// gitignored, so a local copy must not decide the result (as in tests/unit/docs/sidebar-coverage.test.ts).
const TRACKED = new Set(
  execFileSync('git', ['ls-files', '--', 'content'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean),
);
const REMOTE = new Map(
  getFixedSections()
    .flatMap((section) => section.configs)
    .map((config) => [config.outputPath, config.title]),
);

function frontmatterTitle(file: string): string | undefined {
  const frontmatter = fs.readFileSync(path.join(REPO, file), 'utf8').split(/^---$/m)[1] ?? '';
  return /^title:\s*(.+)$/m
    .exec(frontmatter)?.[1]
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2');
}

// A docs or Academy URL → the title of its page, or undefined when no page has that URL.
function pageTitle(url: string): string | undefined {
  for (const file of [`content${url}.mdx`, `content${url}/index.mdx`]) {
    if (REMOTE.has(file)) return REMOTE.get(file);
    if (TRACKED.has(file)) return frontmatterTitle(file);
  }
  return undefined;
}

describe('VOCABULARY', () => {
  it('pins pages that exist, under their own titles', () => {
    for (const page of VOCABULARY.flatMap((entry) => entry.pages ?? [])) {
      expect(pageTitle(page.url), page.url).toBe(page.title);
    }
  });

  it('pins Console tools that exist and open on this site', () => {
    for (const toolPath of VOCABULARY.flatMap((entry) => entry.tools ?? [])) {
      const tool = TOOLS.find((t) => t.path === toolPath);
      expect(tool, toolPath).toBeDefined();
      expect(tool?.external, toolPath).toBeFalsy();
    }
  });

  it('gives each term one entry, whatever its word order', () => {
    const terms = VOCABULARY.flatMap((entry) => entry.terms.map((term) => [...queryWords(term)].sort().join(' ')));
    expect(terms.filter((term, i) => terms.indexOf(term) !== i)).toEqual([]);
  });
});
