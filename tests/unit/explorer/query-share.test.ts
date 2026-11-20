import { describe, expect, it } from 'vitest';

import { fixedRecipe } from '@/lib/explorer-query/fixed';
import { GENERIC_CARD, QUESTION_MAX, SHAPE_LABEL, TITLE_MAX, askedOf, shapeOf, shareCard, shareChain, shareImageUrl, titleLines } from '@/lib/explorer-query/share';
import { NETWORK_ID } from '@/lib/explorer-query/target';

const CCHAIN = shareChain('mainnet', 'c-chain')!;
const QUESTION = 'Most called methods';

describe('shareChain', () => {
  it('names the chains a mainnet Query link can ask', () => {
    expect(CCHAIN).toEqual({ slug: 'c-chain', chainId: 43114, name: 'C-Chain', subject: 'the C-Chain' });
    expect(shareChain('mainnet', 'p-chain')).toEqual({ slug: 'p-chain', chainId: 1, name: 'P-Chain', subject: 'the P-Chain' });
    expect(shareChain('mainnet', 'all')).toEqual({ slug: 'all', chainId: NETWORK_ID, name: 'All chains', subject: 'every chain' });
  });

  it('resolves no chain for Fuji, an unknown slug or no slug', () => {
    expect(shareChain('fuji', 'c-chain')).toBeNull();
    expect(shareChain('testnet', 'p-chain')).toBeNull();
    expect(shareChain('mainnet', 'no-such-chain')).toBeNull();
    expect(shareChain('mainnet', '../../etc/passwd')).toBeNull();
    expect(shareChain('mainnet', undefined)).toBeNull();
  });
});

describe('askedOf', () => {
  it('reads one line of at most QUESTION_MAX characters', () => {
    expect(askedOf('  Most   called\n methods ')).toBe(QUESTION);
    expect(askedOf(['first', 'second'])).toBe('first');
    expect(askedOf('a\u0000b\u200bc')).toBe('a b c');
    expect(askedOf('x'.repeat(5000))).toHaveLength(QUESTION_MAX);
  });

  it('reads no question from an empty or non-text value', () => {
    for (const raw of [undefined, null, '', '   ', '\n\t', 7, {}, []]) expect(askedOf(raw)).toBeNull();
  });
});

describe('shareCard', () => {
  it('takes the title and the note of a recipe', () => {
    const recipe = fixedRecipe(43114, QUESTION)!;
    expect(recipe).not.toBeNull();
    const card = shareCard(CCHAIN, QUESTION, recipe);
    expect(card.title).toBe(recipe.title);
    expect(recipe.note.startsWith(card.description.replace(/…$/, ''))).toBe(true);
    expect(card.description.length).toBeLessThanOrEqual(200);
    expect(card.imageUrl).toBe('/api/og/query/mainnet/c-chain?q=Most%20called%20methods&v=1');
  });

  it('shows the question, cut at TITLE_MAX characters, when no recipe is kept', () => {
    const card = shareCard(CCHAIN, QUESTION, null);
    expect(card.title).toBe(QUESTION);
    expect(card.description).toBe('A question asked of the C-Chain on the Avalanche Explorer. Query answers it with a chart and its SQL.');

    const long = shareCard(CCHAIN, 'x'.repeat(200), null);
    expect(long.title).toBe(`${'x'.repeat(TITLE_MAX - 1)}\u2026`);
    // the cut falls between words when a space is near
    expect(shareCard(CCHAIN, 'words '.repeat(60).trim(), null).title).toBe(`${'words '.repeat(13).trim()}\u2026`);
  });

  it('falls back to the question for a recipe with an empty title or note', () => {
    const card = shareCard(shareChain('mainnet', 'all')!, QUESTION, { title: ' ', note: '' });
    expect(card.title).toBe(QUESTION);
    expect(card.description).toContain('every chain');
    expect(card.imageUrl).toContain('/api/og/query/mainnet/all?q=');
  });

  it('writes no em dash and no "subnet"', () => {
    const text = [GENERIC_CARD.title, GENERIC_CARD.description, shareCard(CCHAIN, QUESTION, null).description, ...Object.values(SHAPE_LABEL)].join(' ');
    expect(text).not.toMatch(/\u2014|subnet/i);
  });
});

describe('shareImageUrl', () => {
  it('encodes the question and cuts it', () => {
    expect(shareImageUrl('p-chain', 'a&b=c?d#e')).toBe('/api/og/query/mainnet/p-chain?q=a%26b%3Dc%3Fd%23e&v=1');
    const q = new URL(shareImageUrl('c-chain', 'y'.repeat(900)), 'http://x').searchParams.get('q');
    expect(q).toHaveLength(QUESTION_MAX);
  });
});

describe('shapeOf', () => {
  const chart = { kind: 'line' as const, series: [] };
  const panel = (kind: string) => ({ kind }) as never;
  const visual = (...kinds: string[]) => ({ stats: [], callouts: [], panels: kinds.map(panel) });

  it('reads the first panel that is not a table, else the chart', () => {
    expect(shapeOf({ chart, visual: visual('table', 'heatmap', 'hbar') })).toBe('heatmap');
    expect(shapeOf({ chart, visual: visual('table') })).toBe('table');
    expect(shapeOf({ chart, visual: null })).toBe('line');
    expect(shapeOf({ chart: { kind: 'none', series: [] }, visual: null })).toBe('table');
    expect(shapeOf(fixedRecipe(43114, QUESTION))).toBe('hbar');
  });

  it('draws a question for no recipe and a table for a kind it does not know', () => {
    expect(shapeOf(null)).toBe('ask');
    expect(shapeOf({ chart, visual: visual('ask') })).toBe('table');
    expect(shapeOf({ chart, visual: visual('pie') })).toBe('table');
    expect(shapeOf({ chart: undefined as never, visual: { panels: 'x' } as never })).toBe('table');
  });
});

describe('titleLines', () => {
  it('draws a short title large on one line', () => {
    expect(titleLines('Top senders', 720)).toEqual({ size: 76, lines: ['Top senders'] });
    expect(titleLines(QUESTION, 720)).toEqual({ size: 76, lines: ['Most called', 'methods'] });
  });

  it('wraps a longer title on whole words and shrinks it to fit 3 lines', () => {
    const title = 'Gas reserved per block in the last 30 minutes, versus the limit';
    const { size, lines } = titleLines(title, 720);
    expect(size).toBeLessThan(76);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join(' ')).toBe(title);
  });

  it('ends the third line with an ellipsis when the title is too long', () => {
    const { size, lines } = titleLines('transactions '.repeat(30).trim(), 720);
    expect(size).toBe(46);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
    expect(lines[0].endsWith('…')).toBe(false);
  });

  it('breaks a word that is wider than a line', () => {
    const { lines } = titleLines('0x' + 'ab'.repeat(150), 720);
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line.length).toBeLessThan(40);
  });

  it('gives no line for an empty title', () => {
    expect(titleLines('', 720).lines).toEqual([]);
  });
});
