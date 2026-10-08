import { describe, expect, it } from 'vitest';

import { collapseMacros, expandMacros } from '@/lib/explorer-query/macros';
import { MEV_BOTS, MEV_NAMES, mevQuestion, mevTurn } from '@/lib/explorer-query/mev';
import { dexQuestion, promptVersion, systemPrompt } from '@/lib/explorer-query/prompt';
import { createHash } from 'node:crypto';
import { recipeKey } from '@/lib/explorer-query/cache';
import { familyQuestion } from '@/lib/explorer-query/families';
import { lendingQuestion } from '@/lib/explorer-query/lending';
import { guardSql } from '@/lib/explorer-query/guard';

const C = 43114;

describe('an MEV question', () => {
  it('is one that names MEV or a pattern, or follows a turn that read the swaps in order', () => {
    for (const q of ['How many sandwich attacks happened today?', 'Top arbitrage contracts this week', 'backruns in the last hour', 'JIT liquidity on Pharaoh this week', "MEV bots' share of today's gas", 'front-running on Uniswap'])
      expect(mevQuestion(C, q), q).toBe(true);
    for (const q of ['USDC transfers today', 'gas burned per day over the last 7 days', 'the largest swaps on Pharaoh today']) expect(mevQuestion(C, q), q).toBe(false);
    expect(mevQuestion(43113, 'sandwiches today')).toBe(false);
    expect(mevQuestion(C, 'Show that per hour', [{ prompt: 'x', sql: '$SWAPORDER(toStartOfDay(now())) SELECT count() FROM swap_order' }])).toBe(true);
  });

  it("is told in its turn that the swaps' order answers it, and never to refuse for want of a label", () => {
    expect(mevTurn(C, 'sandwich attacks today')).toMatch(/\$SWAPORDER.*never answer kind "none" for want of a label/);
    // a pattern finds signers and contracts; a bot is only what the registry labels one (the r6 audit's M09 called
    // every backrunning signer a bot)
    expect(mevTurn(C, 'backruns per hour today')).toContain('a bot only where mev_bots lists it');
    // its recipe key holds that line, so a kept recipe written before a new line is asked again
    const q = 'backruns per hour today';
    const version = promptVersion(C, dexQuestion(C, q), lendingQuestion(C, q), familyQuestion(C, q), mevQuestion(C, q));
    expect(recipeKey(C, q)).toBe(createHash('sha256').update(`${C}\n${version}\n${q}\n\n${mevTurn(C, q)}`).digest('hex').slice(0, 32));
    expect(mevTurn(C, 'USDC transfers today')).toBe('');
    expect(mevTurn(43113, 'sandwich attacks today')).toBe('');
  });

  it("finds an arbitrage by what its pools paid out, and sizes it by its largest swap (r11's G07)", () => {
    expect(mevTurn(C, 'Largest arbitrage transactions this week')).toContain("Open the query with $DEX: an arbitrage's size is its largest swap's value, max(usd) over its swaps in legs, never the fee it paid, and never answer");
    expect(mevTurn(C, 'Top arbitrage contracts this week')).toContain('Open the query with $SWAPORDER, and never answer');
    expect(mevTurn(C, 'the largest sandwiches today')).toContain('Open the query with $SWAPORDER');
    // both arbitrage examples and their drills pass the guard, and the three that find arbitrages read one test
    const prompt = systemPrompt({ chainId: C, chainName: 'C-Chain', symbol: 'AVAX', schema: '', coverage: null, mev: true });
    const lines = prompt.split('\n').filter((l) => /^(drill: )?\$(DEX|SWAPORDER)\(/.test(l) && /\bpool_list\b|FROM legs WHERE tx =/.test(l));
    expect(lines).toHaveLength(4);
    for (const l of lines) {
      const sql = l.replace(/^drill: /, '').replace(/\{\{(\w+):bytes\}\}/g, (_m, c: string) => `unhex('${'00'.repeat(c === 'tx_hash' ? 32 : 20)}')`);
      const g = guardSql(sql, C);
      expect(g.ok ? '' : g.error, l.slice(0, 60)).toBe('');
    }
    expect(lines.filter((l) => l.includes('HAVING tokens >= 2 AND min(paid) >= 0 AND max(paid) > 0'))).toHaveLength(3);
    // the univ4 PoolManager is one of a transaction's pools when it swaps in a univ4 pool, written out for swap_order and
    // as bytes for legs; counted in every transaction, it took back the profit a bot keeps there (r12's 0xb2a231bd)
    expect(lines[0]).toContain("arrayConcat(groupUniqArray(pool), if(countIf(length(pool) = 66) > 0, ['0x06380c0e0912312b5150364b9dc4542ba0dbbc85'], []))");
    expect(lines[2]).toContain("arrayConcat(groupUniqArray(pool), if(countIf(length(pool) = 32) > 0, [unhex('06380c0e0912312b5150364b9dc4542ba0dbbc85')], []))");
    expect(lines[2]).toContain('ORDER BY size_usd DESC NULLS LAST LIMIT 15');
    // no arbitrage is read from its first and last Transfer: a flash loan and its repayment passed that test
    expect(prompt).not.toContain('first and last ERC-20 Transfer');
  });

  it("carries the MEV chapter in its prompt, under a prompt version of its own", () => {
    const base = { chainId: C, chainName: 'C-Chain', symbol: 'AVAX', schema: '', coverage: null };
    expect(systemPrompt({ ...base, mev: true })).toContain('## MEV');
    expect(systemPrompt(base)).not.toContain('## MEV');
    expect(promptVersion(C, false, false, false, true)).not.toBe(promptVersion(C));
  });
});

describe('$SWAPORDER', () => {
  it('writes out one row per block, pool and transaction of the window, in order', () => {
    const x = expandMacros('$SWAPORDER(toMonday(now())) SELECT count() FROM swap_order', C);
    expect(x.ok).toBe(true);
    if (!x.ok) return;
    expect(x.sql).toMatch(/swap_order AS \(SELECT block_number, any\(block_time\) AS block_time, tx_index, tx, any\(signer\) AS signer, any\(bot\) AS bot, pool, argMin\(dir, log_index\) AS dir, count\(\) AS swaps/);
    expect(x.sql).toContain('block_time >= toMonday(now()) AND topic0 IN (v2_swap, v3_swap, lb_swap, v4_swap)');
    // each branch hexed apart: an address cast to a String first loses its trailing zero bytes
    expect(x.sql).toContain("lower(concat('0x', if(topic0 = v4_swap, hex(assumeNotNull(topic1)), hex(address)))) AS pool");
    const ended = expandMacros("$SWAPORDER(toDateTime('2026-09-28 00:00:00'), toDateTime('2026-09-29 00:00:00')) SELECT 1 FROM swap_order", C);
    expect(ended.ok && ended.sql).toContain("block_time >= toDateTime('2026-09-28 00:00:00') AND block_time < toDateTime('2026-09-29 00:00:00') AND topic0");
  });

  it('takes no slug, and goes back to its shorthand in a later turn', () => {
    const slug = expandMacros("$SWAPORDER(toMonday(now()), 'pharaoh') SELECT 1 FROM swap_order", C);
    expect(slug.ok).toBe(false);
    const x = expandMacros('$SWAPORDER(toMonday(now())) SELECT count() FROM swap_order', C);
    expect(x.ok && collapseMacros(x.sql, C)).toBe('$SWAPORDER(toMonday(now())) SELECT count() FROM swap_order');
  });
});

describe('mev_bots', () => {
  it("lists the registry's MEV contracts as 20-byte FixedStrings, the vanity bot that ends in zeros too", () => {
    expect(MEV_BOTS.length).toBeGreaterThan(50);
    expect(MEV_NAMES.mev_bots).toMatch(/^arrayMap\(x -> toFixedString\(base64Decode\(x\), 20\), \[/);
    expect(MEV_NAMES.mev_bots.match(/'[A-Za-z0-9+/]{27}='/g)).toHaveLength(MEV_BOTS.length);
    const vanity = MEV_BOTS.find((b) => /00000000$/.test(b.address));
    expect(vanity).toBeDefined();
    expect(MEV_NAMES.mev_bots).toContain(`'${Buffer.from(vanity!.address.slice(2), 'hex').toString('base64')}'`);
  });
});
