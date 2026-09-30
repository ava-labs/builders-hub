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
    // what it did is its logs, never the calls sent to it; GMX v2's actions are named in topic1 of its EventEmitter's logs
    expect(turn).toContain('Count what GMX did from the logs these contracts emit, by event');
    expect(turn).toContain('never offer a count of calls in their place.');
    expect(turn).toContain("OrderExecuted unhex('680f10f06595d3d707241f604672ec4b6ae50eb82728ec2f3c65f6789e897760')");
    expect(turn).toContain('0xdb17b211c34240b014ab6d61d4a31fa0c0e20c26 (GMX V2 EventEmitter)');
    // GMX's trader is the position's account, never the keeper that sends the transaction
    expect(turn).toContain("topic2 is its account, the trader: tx_from is GMX's keeper");
    // Yield Yak's strategies are found by their Reinvest event, as the registry lists none of them
    const yak = registryTurn(43114, 'yield yak reinvests today');
    expect(yak).toContain("YakStrategy's Reinvest(uint256,uint256) unhex('c7606d21ac05cd309191543e409f0845c016120563783d70e4f41419dc0ef234')");
    expect(yak).toContain('Count what Yield Yak did from the logs these contracts and the ones the line above finds by its event emit');
    expect(yak).toContain('The note says the count covers the contracts found that way.');
    // a protocol with no event line still gets the rule
    expect(registryTurn(43114, 'Platypus swaps this week')).toContain('Count what Platypus did from the logs these contracts emit');
    expect(userTurn(43114, 'GMX activity last 7 days', new Date('2026-09-29T12:00:00Z'))).toBe(`Today is 2026-09-29 (UTC).${turn}\n\nGMX activity last 7 days`);
    expect(registryNames(43114, 'yield yak users this week')).toEqual(['Yield Yak']);
    // a chapter's protocol, under any name the registry gives it, is the chapter's
    for (const q of ['pharaoh activity last 7 days', 'lfj activity', 'Pharaoh Exchange swaps', 'aave deposits today', 'Aave v3 borrows', 'LFJ v2.1 swaps']) expect(registryNames(43114, q)).toEqual([]);
    // unless it names a version no chapter reads: Aave V2 is not the Aave v3 chapter's
    expect(registryNames(43114, 'Aave V2 activity this month')).toEqual(['Aave V2']);
    expect(registryTurn(43114, 'Aave V2 activity this month')).toContain('0x4f01aed16d97e3ab5ab2b501154dc9bb0f1a5a2c (Aave V2 LendingPool)');
    // an English word that is a protocol's name as well is named only with its capital
    expect(registryNames(43114, 'tokens sold on a bonding curve')).toEqual([]);
    expect(registryNames(43114, 'Curve activity this week')).toEqual(['Curve']);
    expect(registryTurn(43113, 'GMX activity last 7 days')).toBe('');
  });

  it('keeps the recipe key of every question that names no such protocol', () => {
    const key = (q: string, named = '') => createHash('sha256').update(`43114\n${promptVersion(43114)}\n${q}\n${named && `\n${named}`}`).digest('hex').slice(0, 32);
    expect(recipeKey(43114, 'Fees burned per 5 minutes')).toBe(key('fees burned per 5 minutes'));
    // a question that names a registry protocol holds its turn, so new lines or contracts ask again
    expect(recipeKey(43114, 'GMX activity last 7 days')).toBe(key('gmx activity last 7 days', registryTurn(43114, 'GMX activity last 7 days')));
  });
});
