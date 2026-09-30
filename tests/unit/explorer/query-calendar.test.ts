import { describe, expect, it } from 'vitest';
import { pchainPrompt, systemPrompt, userTurn } from '@/lib/explorer-query/prompt';
import { scopeError, sqlWindow } from '@/lib/explorer-query/scope';

// a worked example's date near today reads as this week's to a writer, which then copies it into its note
const calendarOf = (prompt: string) => prompt.split('\n').find((l) => l.startsWith('- Calendar words')) ?? '';
const datesOf = (line: string) => [...line.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => Date.parse(`${m[1]}T00:00:00Z`));
const YEAR = 365 * 86_400_000;

describe('the calendar rule', () => {
  it('writes its worked examples with dates years from today on mainnet', () => {
    const prompts = [
      systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null }),
      systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, dex: true }),
      systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, lending: true }),
      pchainPrompt({ chainId: 1, network: 'Mainnet', schema: '', coverage: null }),
    ];
    for (const prompt of prompts) {
      const line = calendarOf(prompt);
      expect(line).toContain('the week of Monday March 7, 2022 is');
      expect(datesOf(line).length).toBe(3);
      for (const d of datesOf(line)) expect(Math.abs(Date.now() - d)).toBeGreaterThan(2 * YEAR);
    }
  });

  it("gives an EVM chain's series with no window a default, in words the window check takes", () => {
    const evm = (chainId: number) => calendarOf(systemPrompt({ chainId, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null }));
    const DEFAULTS = [
      ['toStartOfDay(now()) - INTERVAL 30 DAY', 'in the last 30 days'],
      ['toMonday(now()) - INTERVAL 7 WEEK', 'in the last 8 weeks'],
      ['toStartOfMonth(now()) - INTERVAL 11 MONTH', 'in the last 12 months'],
    ] as const;
    for (const line of [evm(43114), evm(432204)]) {
      expect(line).toContain('A daily, weekly or monthly series whose question names no window never reads the whole history');
      for (const [start, words] of DEFAULTS) {
        expect(line).toContain(`from ${start}`);
        expect(line).toContain(`"${words}"`);
      }
    }
    // the P-Chain's worked examples read their own windows, and Fuji keeps its line
    const pchain = (chainId: number) => calendarOf(pchainPrompt({ chainId, network: 'x', schema: '', coverage: null }));
    for (const line of [pchain(1), pchain(5), evm(43113)]) expect(line).not.toContain('names no window');
    // every few hours of a year, Mondays, month ends and the 1st included: each start reads a window its words fit
    for (let now = Date.UTC(2026, 0, 1, 0, 7); now < Date.UTC(2027, 0, 1); now += 5 * 3_600_000 + 13 * 60_000) {
      for (const [start, words] of DEFAULTS) {
        const w = sqlWindow(`SELECT count() AS txs FROM raw_txs WHERE block_time >= ${start}`, now);
        if (w === null || w === 'unknown') throw new Error(`no window read from ${start}`);
        expect(scopeError(`Transactions per bucket ${words}`, `Counted ${words}.`, w, now)).toBeNull();
      }
    }
  });

  it('repeats the default in the turn of a series question on its own that names no window', () => {
    const at = new Date(Date.UTC(2026, 8, 28, 16));
    const turn = (q: string, chainId = 43114, alone = true) => userTurn(chainId, q, at, alone).split('\n\n')[0];
    expect(turn('New pools per week per DEX')).toBe('Today is 2026-09-28 (UTC). The question names no window: a weekly series reads the current week and the 7 before it.');
    expect(userTurn(43114, 'New pools per week per DEX', at)).toMatch(/\.\n\nNew pools per week per DEX$/);
    expect(turn('How many unique borrowers does each protocol have per week?', 432204)).toMatch(/: a weekly series reads the current week and the 7 before it\.$/);
    expect(turn('Daily active addresses')).toMatch(/: a daily series reads 30 days\.$/);
    expect(turn('Monthly volume by DEX')).toMatch(/: a monthly series reads 12 months, or as far back as its table allows\.$/);
    // a window of its own, another time word or two buckets: the date alone
    for (const q of ['Swaps per day per DEX this week', 'the sAVAX exchange rate per day over the last 30 days', 'Weekly volume in 2025', 'Monthly volume since launch', 'Pharaoh volume per day on September 21', 'AVAX price per hour', 'Daily and weekly swaps', 'Uniswap volume on September 26']) {
      expect(turn(q), q).toBe('Today is 2026-09-28 (UTC).');
    }
    // a follow-up and the P-Chain too, and Fuji's turn is the question
    expect(turn('make it weekly', 43114, false)).toBe('Today is 2026-09-28 (UTC).');
    // a follow-up is told the window of the chart before it: the follow-up audit's T01 went from 6 hours to 24
    const six = 'SELECT toStartOfFiveMinutes(block_time) AS t, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfFiveMinutes(now()) - INTERVAL 6 HOUR GROUP BY t ORDER BY t';
    expect(userTurn(43114, 'Show it per hour instead', at, false, six).split('\n\n')[0]).toBe('Today is 2026-09-28 (UTC). This question follows the chart before it, which read from 2026-09-28 10:00 UTC to now: keep that window unless this question names another.');
    const day = 'SELECT toStartOfHour(block_time) AS t, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 24 HOUR GROUP BY t ORDER BY t';
    expect(userTurn(43114, 'Only the reverted ones', at, false, day).split('\n\n')[0]).toMatch(/which read in the last 24 hours \(from 2026-09-27 16:00 UTC to now\): keep that window/);
    const week = 'SELECT toDate(block_time) AS t, avg(base_fee_per_gas) AS fee FROM raw_blocks WHERE chain_id = 43114 AND block_time >= toStartOfDay(now()) - INTERVAL 7 DAY GROUP BY t ORDER BY t';
    expect(userTurn(43114, 'Show it per hour instead', at, false, week).split('\n\n')[0]).toMatch(/which read from 2026-09-21 00:00 UTC to now: keep that window/);
    // a chart with no window, the P-Chain and Fuji: no such line
    expect(userTurn(43114, 'Per hour instead', at, false, 'SELECT count() FROM raw_txs WHERE chain_id = 43114').split('\n\n')[0]).toBe('Today is 2026-09-28 (UTC).');
    expect(userTurn(1, 'Per week instead', at, false, week).split('\n\n')[0]).toBe('Today is 2026-09-28 (UTC).');
    expect(userTurn(43113, 'Per hour instead', at, false, six)).toBe('Per hour instead');
    // a question about one token's transfers is told to count its mints and burns (the regression audit's R13)
    const token = 'How many transfers did the token 0x9ed98e159be43a8d42b64053831fcae5e4d7d271 have in the last 24 hours?';
    expect(userTurn(43419, token, at).split('\n\n')[0]).toBe("Today is 2026-09-28 (UTC). A question about a token's transfers counts its mints (transfers from the zero address) and burns (to it) in columns of their own.");
    expect(userTurn(43114, 'How many transactions were there today?', at).split('\n\n')[0]).toBe('Today is 2026-09-28 (UTC).');
    expect(userTurn(43113, token, at)).toBe(token);
    // a question about tokens' transfers that names no token and no NFT reads ERC-20 Transfers only (r7's E03)
    const erc20 = " A token transfer is an ERC-20 Transfer log, topic3 IS NULL: an NFT's Transfer (ERC-721) has the same topic0 and its token id in topic3.";
    expect(userTurn(43114, 'Which tokens had the most transfers today?', at).split('\n\n')[0]).toBe(`Today is 2026-09-28 (UTC).${erc20}`);
    expect(userTurn(43114, 'Which NFT collections had the most transfers today?', at)).not.toContain('topic3 IS NULL');
    expect(userTurn(43114, 'Top ERC-721 tokens by transfers this week', at)).not.toContain('topic3 IS NULL');
    expect(userTurn(43114, token, at)).not.toContain('topic3 IS NULL');
    // a P-Chain question about validators that started or were added counts nodes beside registrations (r7's P01)
    const nodes = ' A count of validators counts nodes, uniqExact(node_id), beside the registrations (a node that renews registers again), and the new ones: the nodes with no registration before the window.';
    expect(turn('Validators added per week', 1)).toBe(`Today is 2026-09-28 (UTC).${nodes}`);
    expect(turn('How many validators started validating the Primary Network this week?', 1)).toBe(`Today is 2026-09-28 (UTC).${nodes}`);
    expect(turn('How many validators joined L1s this week?', 1)).toBe('Today is 2026-09-28 (UTC).');
    expect(turn('Validator uptime by version', 1)).toBe('Today is 2026-09-28 (UTC).');
    for (const chainId of [43113, 5]) expect(userTurn(chainId, 'New pools per week per DEX', at)).toBe('New pools per week per DEX');
  });

  it('leaves Fuji\'s as it was', () => {
    const line = calendarOf(systemPrompt({ chainId: 43113, chainName: 'Avalanche C-Chain (Fuji)', symbol: 'AVAX', schema: '', coverage: null }));
    expect(line).toMatch(/^- Calendar words are calendar windows: "today" starts at toStartOfDay\(now\(\)\)/);
    expect(datesOf(line)).toEqual([]);
  });
});
