import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { recipeKey } from '@/lib/explorer-query/cache';
import { familyQuestion } from '@/lib/explorer-query/families';
import { lendingQuestion } from '@/lib/explorer-query/lending';
import { mentioned, slips } from '@/lib/explorer-query/names';
import { dexQuestion, promptVersion, userTurn } from '@/lib/explorer-query/prompt';
import { registryNames, registryTurn } from '@/lib/explorer-query/registry-turn';

describe('protocol names as a question types them', () => {
  it('counts a swapped, missing, extra or wrong letter as one slip', () => {
    expect(slips('pharoah', 'pharaoh', 1)).toBe(1);
    expect(slips('pangolinn', 'pangolin', 1)).toBe(1);
    expect(slips('uniswp', 'uniswap', 1)).toBe(1);
    expect(slips('uniswap', 'uniswap', 1)).toBe(0);
    // past the most it looks for, it stops at one more
    expect(slips('platypus', 'pharaoh', 1)).toBe(2);
  });

  it('reads a name one slip off, but never an English word near one or a short name misspelled', () => {
    expect(mentioned('pharoah activity last 7 days', ['Pharaoh'])).toEqual(['Pharaoh']);
    expect(mentioned('traderjoe swaps this week', ['Trader Joe'])).toEqual(['Trader Joe']);
    expect(mentioned('USDC balance of the treasury', ['Balancer'])).toEqual([]);
    expect(mentioned('where did the money go', ['vMoney'])).toEqual([]);
    expect(mentioned('aavee deposits', ['Aave'])).toEqual([]);
  });

  it('gives a misspelled DEX or family protocol its chapter, on the mainnet C-Chain only', () => {
    expect(dexQuestion(43114, 'pharoah activity last 7 days')).toBe(true);
    expect(dexQuestion(43114, 'LFJ activity this week')).toBe(true);
    expect(familyQuestion(43114, 'opentrad pools this month')).toBe(true);
    expect(lendingQuestion(43114, 'Benqi borrowers this week')).toBe(true);
    expect(dexQuestion(43114, 'USDC balance of the treasury')).toBe(false);
    expect(dexQuestion(43113, 'pharoah activity last 7 days')).toBe(false);
  });

  it('tells a question the contracts of a registry protocol that no chapter reads', () => {
    const turn = registryTurn(43114, 'GMX activity last 7 days');
    expect(turn).toContain(' GMX is these contracts in our registry: ');
    expect(turn).toContain('0x9ab2de34a33fb459b538c43f251eb825645e8595 (GMX Vault)');
    expect(turn).toContain('Its activity is the transactions sent to them and the logs they emit.');
    expect(userTurn(43114, 'GMX activity last 7 days', new Date('2026-09-29T12:00:00Z'))).toBe(`Today is 2026-09-29 (UTC).${turn}\n\nGMX activity last 7 days`);
    expect(registryNames(43114, 'yield yak users this week')).toEqual(['Yield Yak']);
    // a chapter's protocol, under any name the registry gives it, is the chapter's
    for (const q of ['pharaoh activity last 7 days', 'lfj activity', 'Pharaoh Exchange swaps', 'aave deposits today']) expect(registryNames(43114, q)).toEqual([]);
    // an English word that is a protocol's name as well is named only with its capital
    expect(registryNames(43114, 'tokens sold on a bonding curve')).toEqual([]);
    expect(registryNames(43114, 'Curve activity this week')).toEqual(['Curve']);
    expect(registryTurn(43113, 'GMX activity last 7 days')).toBe('');
  });

  it('keeps the recipe key of every question that names no such protocol', () => {
    const key = (q: string, named = '') => createHash('sha256').update(`43114\n${promptVersion(43114)}\n${q}\n${named && `\n${named}`}`).digest('hex').slice(0, 32);
    expect(recipeKey(43114, 'Fees burned per 5 minutes')).toBe(key('fees burned per 5 minutes'));
    expect(recipeKey(43114, 'GMX activity last 7 days')).toBe(key('gmx activity last 7 days', 'GMX'));
  });
});
