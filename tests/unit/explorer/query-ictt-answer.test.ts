import { beforeEach, describe, expect, it, vi } from 'vitest';

/* answer.ts's part in an ICTT or ICM question: the network keeps one that names ICTT, where a DEX or lending word
   alone sends a question to the C-Chain, and the writer gets the ICTT chapter and turn on every target. The mocks
   are query-fixed.test.ts's; the writer fails, so each question stops at its first model call. */

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery: vi.fn(),
  anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })),
  schemaCard: vi.fn(async () => ''),
  coverage: vi.fn(async () => null),
  coverageText: vi.fn(() => ''),
  networkCoverageText: vi.fn(async () => null),
}));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe: vi.fn(async () => null), putRecipe: vi.fn(async () => {}), recipeKey: vi.fn(() => 'key') }));
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []), networkChains: vi.fn(async () => []), withSources: vi.fn(async (sql: string) => ({ sql, sources: [] })) }));

import { generateText } from 'ai';
import { answerQuestion } from '@/lib/explorer-query/answer';
import { lendingQuestion } from '@/lib/explorer-query/lending';
import { NETWORK_ID } from '@/lib/explorer-query/target';

const ask = (chainId: number, prompt: string) =>
  answerQuestion({ chainId, chainName: chainId === NETWORK_ID ? 'Avalanche' : 'Avalanche C-Chain', symbol: 'AVAX', prompt, history: [], baseUrl: 'http://localhost:3000', emit: () => {} });

/** the system prompt and the last turn of the first model call */
function sent(): { system: string; turn: string } {
  const [call] = vi.mocked(generateText).mock.calls;
  expect(call, 'no model call').toBeDefined();
  const { system, messages } = call[0] as { system: { content: string }; messages: { content: unknown }[] };
  return { system: system.content, turn: String(messages.at(-1)?.content) };
}

describe('an ICTT or ICM question asked', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset().mockRejectedValue(new Error('no model in this test'));
  });

  it('stays on the network when it names ICTT, where the same words with no ICTT go to the C-Chain', async () => {
    const q = 'ICTT tokens deposited on Aave this week';
    // the C-Chain's lending gate takes it, as Aave is lending's
    expect(lendingQuestion(43114, q)).toBe(true);
    expect(await ask(NETWORK_ID, q)).toBeNull();
    expect(sent().system).toContain('## Interchain token transfers and ICM');
    vi.mocked(generateText).mockClear();
    expect((await ask(NETWORK_ID, 'Aave deposits this week'))?.route).toBe('c-chain');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('gives the writer the ICTT chapter and its turn on the C-Chain, an L1 and the network', async () => {
    for (const chainId of [43114, 8021, NETWORK_ID]) {
      vi.mocked(generateText).mockClear();
      await ask(chainId, 'How many stablecoins are currently held in the ICTT bridges?');
      const { system, turn } = sent();
      expect(system, String(chainId)).toContain('## Interchain token transfers and ICM');
      expect(turn, String(chainId)).toContain('An ICTT or ICM question (the ICTT rules)');
    }
    // a question about anything else gets neither
    vi.mocked(generateText).mockClear();
    await ask(43114, 'Busiest contracts this hour');
    expect(sent().system).not.toContain('## Interchain token transfers and ICM');
  });
});
