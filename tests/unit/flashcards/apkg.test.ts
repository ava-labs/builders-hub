import { describe, expect, it } from 'vitest';
import { buildApkg, mdToHtml, escapeHtml, formatCloze } from '@/lib/flashcards/apkg';
import type { Deck } from '@/lib/flashcards/types';

const baseSource = { kind: 'academy' as const, path: '/academy/x', chapterTitle: 'Sample Chapter' };

describe('escapeHtml', () => {
  it('escapes the basic XSS-risky characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});

describe('mdToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(mdToHtml('')).toBe('');
  });

  it('wraps plain prose in paragraph tags', () => {
    expect(mdToHtml('hello world')).toBe('<p>hello world</p>');
  });

  it('converts inline backticks to <code>', () => {
    expect(mdToHtml('use `foo()` here')).toContain('<code>foo()</code>');
  });

  it('preserves fenced code blocks with language class', () => {
    const out = mdToHtml('```ts\nconst x = 1;\n```');
    expect(out).toContain('<pre><code class="language-ts">');
    expect(out).toContain('const x = 1;');
  });

  it('escapes HTML inside code blocks', () => {
    const out = mdToHtml('```html\n<div>hi</div>\n```');
    expect(out).toContain('&lt;div&gt;');
    expect(out).not.toContain('<div>hi</div>');
  });
});

describe('formatCloze', () => {
  it('extracts the elided answers and replaces them with underscores', () => {
    const { display, answers } = formatCloze('Avalanche uses [[Snowman]] consensus.');
    expect(display).toContain('_____');
    expect(display).not.toContain('[[Snowman]]');
    expect(answers).toEqual(['Snowman']);
  });

  it('handles multiple elisions', () => {
    const { answers } = formatCloze('[[X]] and [[Y]] both matter.');
    expect(answers).toEqual(['X', 'Y']);
  });

  it('returns the original string when no cloze marker is present', () => {
    const { display, answers } = formatCloze('Plain sentence.');
    expect(display).toBe('Plain sentence.');
    expect(answers).toEqual([]);
  });
});

describe('buildApkg', () => {
  it('produces a valid Anki .apkg zip for a small deck', async () => {
    const deck: Deck = {
      id: 'test-deck',
      title: 'Test Deck',
      sources: [baseSource],
      cards: [
        {
          id: 'a',
          type: 'qa',
          front: 'What is consensus?',
          back: 'A protocol for agreeing on shared state.',
          source: baseSource,
        },
        {
          id: 'b',
          type: 'cloze',
          front: 'Avalanche uses [[Snowman]] consensus.',
          back: 'Snowman',
          source: baseSource,
        },
        {
          id: 'c',
          type: 'code',
          front: 'Type the add-validator call:',
          back: 'avm.addValidator({ weight: 100 })',
          language: 'typescript',
          source: baseSource,
        },
      ],
    };

    const buf = await buildApkg(deck);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    // PK = local file header → valid zip prefix
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
