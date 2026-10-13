import { describe, expect, it } from 'vitest';
import { dialogRows, humanizeSlug, sectionLabel, type AlgoliaHit } from '@/lib/search/dialog-rows';

// A hit as the dialog's request returns it: the record, its snippet, and whether the query matched its content.
function hit(
  url: string,
  title: string,
  content: string,
  {
    section,
    sectionId,
    matched = true,
    snippet = content,
  }: { section?: string; sectionId?: string; matched?: boolean; snippet?: string } = {},
): AlgoliaHit {
  return {
    objectID: `${url}-${content}`,
    title,
    url,
    section,
    section_id: sectionId,
    content,
    _snippetResult: { content: { value: snippet } },
    _highlightResult: { content: { matchLevel: matched ? 'full' : 'none' } },
  };
}

// A hit that only names its page: its content repeats the title, so it adds no section row.
const pageHit = (url: string, title: string) => hit(url, title, title);

const ADDRESSES = '/docs/cross-chain/icm-contracts/addresses';
const ACCOUNTS = '/explorer/mainnet/apertummainnet-46dedd/accounts';

describe('dialogRows', () => {
  it('lists each page, then its matching sections, linked to their heading', () => {
    const heading = hit(ADDRESSES, 'ICM Contract Addresses', 'Deployed Addresses', {
      section: 'Deployed Addresses',
      sectionId: 'deployed-addresses',
    });
    const description = hit(
      ADDRESSES,
      'ICM Contract Addresses',
      'Addresses of the ICM contracts on the Avalanche C-Chain and on L1s.',
    );
    expect(dialogRows([pageHit(ADDRESSES, 'ICM Contract Addresses'), heading, description])).toEqual([
      {
        id: ADDRESSES,
        type: 'page',
        url: ADDRESSES,
        content: 'ICM Contract Addresses',
        breadcrumbs: ['Docs', 'Cross-Chain', 'ICM Contracts'],
      },
      {
        id: heading.objectID,
        type: 'heading',
        url: `${ADDRESSES}#deployed-addresses`,
        content: 'Deployed Addresses',
      },
      {
        id: description.objectID,
        type: 'text',
        url: ADDRESSES,
        content: 'Addresses of the ICM contracts on the Avalanche C-Chain and on L1s.',
      },
    ]);
  });

  it("leaves out the explorer's per-chain Accounts pages, not its other pages", () => {
    const rows = dialogRows([
      pageHit(ACCOUNTS, 'ApertumMainnet Accounts'),
      pageHit('/explorer/mainnet/c-chain/gas', 'C-Chain Gas Market'),
    ]);
    expect(rows.map((row) => row.url)).toEqual(['/explorer/mainnet/c-chain/gas']);
  });

  it('keeps the first 12 pages, and the Accounts pages do not count', () => {
    const pages = Array.from({ length: 14 }, (_, i) => pageHit(`/docs/nodes/page-${i}`, `Page ${i}`));
    const rows = dialogRows([pageHit(ACCOUNTS, 'ApertumMainnet Accounts'), ...pages]);
    expect(rows.map((row) => row.url)).toEqual(pages.slice(0, 12).map((page) => page.url));
  });

  it('shows at most 2 sections under a page', () => {
    const url = '/docs/cross-chain/icm-contracts/upgradeability';
    const rows = dialogRows([
      hit(url, 'Upgradeability', 'The TeleporterRegistry maintains a mapping of contract versions'),
      hit(url, 'Upgradeability', 'Each registry maps a version to one contract address'),
      hit(url, 'Upgradeability', 'A new version is added by a warp message from the registry'),
    ]);
    expect(rows.map((row) => row.content)).toEqual([
      'Upgradeability',
      'The TeleporterRegistry maintains a mapping of contract versions',
      'Each registry maps a version to one contract address',
    ]);
  });

  it('leaves out sections that do not contain the query', () => {
    const rows = dialogRows([
      hit(ADDRESSES, 'ICM Contract Addresses', 'Addresses of the ICM contracts on the Avalanche C-Chain and on L1s.', {
        matched: false,
      }),
    ]);
    expect(rows.map((row) => row.type)).toEqual(['page']);
  });

  it('adds no section row for a hit that does not say whether its text matched', () => {
    const bare: AlgoliaHit = {
      objectID: `${ADDRESSES}-1`,
      title: 'ICM Contract Addresses',
      url: ADDRESSES,
      content: 'Addresses of the ICM contracts on the Avalanche C-Chain and on L1s.',
    };
    expect(dialogRows([bare]).map((row) => row.type)).toEqual(['page']);
  });

  it('shows the whole text of a matching hit that comes without a snippet', () => {
    const content = 'Addresses of the ICM contracts on the Avalanche C-Chain and on L1s.';
    const noSnippet = { ...hit(ADDRESSES, 'ICM Contract Addresses', content), _snippetResult: undefined };
    expect(dialogRows([noSnippet]).map((row) => row.content)).toEqual(['ICM Contract Addresses', content]);
  });

  it('leaves out title repeats, component attributes and text under 25 characters, but not a short heading', () => {
    const url = '/docs/acps/99-validatorsetmanager-contract';
    const title = 'ACP-99: Validatorsetmanager Contract';
    const rows = dialogRows([
      hit(url, title, title),
      // the index holds each Callout and TypeTable attribute as "name: value", a TypeTable's type as its source
      hit(url, title, "type: { chainId: { type: 'string', description: 'The chain to query' } }"),
      hit(url, title, 'Deploy the relayer first'), // 24 characters
      hit(url, title, 'Status', { section: 'Status', sectionId: 'status' }),
      hit(url, title, 'Deploy the relayer first.'), // 25 characters
    ]);
    expect(rows.map((row) => [row.type, row.content])).toEqual([
      ['page', title],
      ['heading', 'Status'],
      ['text', 'Deploy the relayer first.'],
    ]);
  });

  it('leaves out a section that repeats one already shown for that page', () => {
    const other = '/docs/cross-chain/icm-contracts/getting-started';
    const rows = dialogRows([
      hit(ADDRESSES, 'ICM Contract Addresses', 'Deploy the TeleporterMessenger contract'),
      hit(ADDRESSES, 'ICM Contract Addresses', 'deploy the TeleporterMessenger contract.'),
      hit(other, 'Getting Started', 'Deploy the TeleporterMessenger contract'),
    ]);
    expect(rows.map((row) => [row.url, row.content])).toEqual([
      [ADDRESSES, 'ICM Contract Addresses'],
      [ADDRESSES, 'Deploy the TeleporterMessenger contract'],
      [other, 'Getting Started'],
      [other, 'Deploy the TeleporterMessenger contract'],
    ]);
  });

  it('shows the snippet around the match for text, and the whole heading', () => {
    const url = '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/02a-claim-testnet-tokens';
    const rows = dialogRows([
      hit(
        url,
        'Claim Testnet Tokens',
        "If you don't want to create a Builder Hub Account, you can use the external Avalanche Faucet with coupon code avalanche-academy or avalanche-academy25 to get 2 AVAX on the C-Chain.",
        {
          section: 'Alternative Faucet',
          sectionId: 'alternative-faucet',
          snippet: '… you can use the external Avalanche <em>Faucet</em> with coupon code avalanche-academy …',
        },
      ),
      hit(
        url,
        'Claim Testnet Tokens',
        'Get test AVAX from the Builder Hub Faucet when your wallet on the C-Chain has no funds yet',
        {
          section: 'Get test AVAX from the Builder Hub Faucet when your wallet on the C-Chain has no funds yet',
          snippet: '… the Builder Hub <em>Faucet</em> when your wallet on the C-Chain has no …',
        },
      ),
    ]);
    expect(rows.slice(1).map((row) => row.content)).toEqual([
      '… you can use the external Avalanche Faucet with coupon code avalanche-academy …',
      'Get test AVAX from the Builder Hub Faucet when your wallet on the C-Chain has no funds yet',
    ]);
  });

  it('labels a page row only when its label differs from the page row above', () => {
    const rows = dialogRows([
      pageHit(ADDRESSES, 'ICM Contract Addresses'),
      pageHit('/docs/cross-chain/icm-contracts/upgradeability', 'Upgradeability'),
      pageHit('/academy/avalanche-l1/interchain-messaging/03-icm-protocol/05-icm-registry', 'ICM Registry'),
      pageHit('/docs/cross-chain/icm-contracts/getting-started', 'Getting Started'),
    ]);
    expect(rows.map((row) => row.breadcrumbs)).toEqual([
      ['Docs', 'Cross-Chain', 'ICM Contracts'],
      undefined,
      ['Academy', 'Interchain Messaging', 'ICM Protocol'],
      ['Docs', 'Cross-Chain', 'ICM Contracts'],
    ]);
  });

  it('adds the first URL part where two pages with the same title and label differ', () => {
    const rows = dialogRows([
      pageHit('/docs/api-reference/data-api/evm-blocks/getBlock', 'Get block'),
      pageHit('/docs/api-reference/data-api/primary-network-blocks/getBlockById', 'Get block'),
    ]);
    expect(rows.map((row) => row.breadcrumbs)).toEqual([
      ['Docs', 'API Reference', 'Data API', 'EVM Blocks'],
      ['Docs', 'API Reference', 'Data API', 'Primary Network Blocks'],
    ]);
  });

  it('keeps the label of a same-title page whose URL only extends the other', () => {
    const chapter = '/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain';
    const rows = dialogRows([
      pageHit(chapter, 'What is a Blockchain?'),
      pageHit(`${chapter}/01-what-is-a-blockchain`, 'What is a Blockchain?'),
    ]);
    expect(rows.map((row) => row.breadcrumbs)).toEqual([['Academy', 'Blockchain Fundamentals'], undefined]);
  });
});

describe('sectionLabel', () => {
  it.each([
    [ADDRESSES, 'ICM Contract Addresses', ['Docs', 'Cross-Chain', 'ICM Contracts']],
    ['/docs/cross-chain', 'Introduction', ['Docs', 'Cross-Chain']],
    // a page directly in its section: no subsection
    ['/docs/acps/99-validatorsetmanager-contract', 'ACP-99: Validatorsetmanager Contract', ['Docs', 'ACPs']],
    ['/docs/rpcs/c-chain/avalanche/avax_getAtomicTx', 'avax.getAtomicTx', ['Docs', 'RPCs', 'C-Chain']],
    [
      '/academy/avalanche-l1/interchain-messaging/03-icm-protocol/05-icm-registry',
      'ICM Registry',
      ['Academy', 'Interchain Messaging', 'ICM Protocol'],
    ],
    [
      '/academy/avalanche-l1/avalanche-fundamentals/get-certificate',
      'Course Completion Certificate',
      ['Academy', 'Avalanche Fundamentals'],
    ],
    // the chapter repeats the title
    [
      '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1',
      'Creating an L1',
      ['Academy', 'Avalanche Fundamentals'],
    ],
    // a track page, without a course (the index holds none today)
    ['/academy/avalanche-l1', 'Avalanche L1 Courses', ['Academy', 'Avalanche L1']],
    ['/integrations/0xgasless', '0xGasless', ['Integrations']],
    ['/blog/acp-267-validator-uptime-requirement', 'ACP-267: Primary Network Uptime Requirement', ['Blog']],
    ['/explorer/mainnet/c-chain/gas', 'C-Chain Gas Market', ['Explorer']],
    ['/stats/network-metrics', 'Network Metrics', ['Explorer']],
  ])('%s', (url, title, want) => {
    expect(sectionLabel(url, title)).toEqual(want);
  });
});

describe('humanizeSlug', () => {
  it.each([
    ['avalanche-fundamentals', 'Avalanche Fundamentals'],
    ['04-creating-an-l1', 'Creating an L1'],
    ['01b-native-vs-erc20', 'Native vs ERC20'],
    ['03-create-an-L1', 'Create an L1'],
    ['07-interoperability-icm-and-ictt', 'Interoperability ICM and ICTT'],
    ['api-reference', 'API Reference'],
    ['rpcs', 'RPCs'],
    ['acps', 'ACPs'],
    ['customizing-evm', 'Customizing EVM'],
    ['erc20-bridge', 'ERC20 Bridge'],
    ['x402-payment-infrastructure', 'x402 Payment Infrastructure'],
    ['team1-fundamentals', 'Team1 Fundamentals'],
    ['ai-llm', 'AI LLM'],
    ['cross-chain', 'Cross-Chain'],
    ['c-chain', 'C-Chain'],
    ['the-graph', 'The Graph'],
    ['0xgasless', '0xgasless'],
  ])('%s reads %s', (slug, want) => {
    expect(humanizeSlug(slug)).toBe(want);
  });
});
