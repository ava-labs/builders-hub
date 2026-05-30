import { describe, expect, it } from 'vitest';

import {
  CHUNK_WORDS,
  countOccurrences,
  makeExcerpt,
  matchesPathPrefix,
  normalizeForSearch,
  sanitizeForReflection,
  sanitizeUrl,
  scoreChunk,
  splitIntoChunks,
  tokenizeQuery,
} from '@/lib/mcp/search-utils';

describe('splitIntoChunks', () => {
  it('returns an empty array for empty content', () => {
    expect(splitIntoChunks('')).toEqual([]);
    expect(splitIntoChunks('   \n  ')).toEqual([]);
  });

  it('returns a single chunk when the content fits the chunk window', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitIntoChunks(words);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].split(' ')).toHaveLength(50);
  });

  it('splits long content into overlapping windows', () => {
    const words = Array.from({ length: 600 }, (_, i) => `w${i}`).join(' ');
    const chunks = splitIntoChunks(words);
    // 600 words / step (180-35=145) ~= 5 windows; the loop guard caps before tail-only chunk.
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.length).toBeLessThanOrEqual(6);
    // Each chunk except possibly the last should be at most CHUNK_WORDS=180 words.
    for (const chunk of chunks) {
      expect(chunk.split(/\s+/).length).toBeLessThanOrEqual(180);
    }
  });

  it('does not produce a tail chunk that is fully covered by the previous window', () => {
    // 200 words with step 145 + overlap 35: window 0..180, then start=145, 145..200 (55 words),
    // but 145+180=325 >= 200 so we break. The tail-cover guard prevents an extra small chunk.
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
    const chunks = splitIntoChunks(words);
    expect(chunks.length).toBeLessThanOrEqual(2);
  });

  it('normalizes \\r\\n to \\n before tokenizing', () => {
    const content = 'foo\r\nbar\r\nbaz';
    expect(splitIntoChunks(content)).toEqual(['foo bar baz']);
  });

  it('respects the CHUNK_WORDS constant', () => {
    expect(CHUNK_WORDS).toBe(180);
  });
});

describe('normalizeForSearch / tokenizeQuery', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeForSearch('  Foo   BAR\n\tbaz  ')).toBe('foo bar baz');
  });

  it('drops short tokens but preserves slashes and underscores in identifiers', () => {
    expect(tokenizeQuery('How do I configure platform_get_block?')).toEqual([
      'how',
      'do',
      'configure',
      'platform_get_block',
    ]);
  });
});

describe('countOccurrences', () => {
  it('counts non-overlapping occurrences', () => {
    expect(countOccurrences('abcabcabc', 'abc')).toBe(3);
  });

  it('returns 0 for empty needle and avoids infinite loops', () => {
    expect(countOccurrences('foo', '')).toBe(0);
  });
});

describe('scoreChunk', () => {
  const baseChunk = {
    url: '/docs/primary-network/overview',
    title: 'Primary Network Overview',
    description: 'Avalanche primary network composed of P, X, C chains',
    normalizedText: normalizeForSearch(
      'the primary network includes the p-chain, x-chain, and c-chain validators stake avax to validate'
    ),
  };

  it('rewards full-phrase matches more than per-term matches', () => {
    const phrase = scoreChunk(baseChunk, 'primary network', ['primary', 'network']);
    const terms = scoreChunk(baseChunk, 'primary unrelated', ['primary', 'unrelated']);
    expect(phrase).toBeGreaterThan(terms);
  });

  it('returns 0 when nothing matches', () => {
    expect(scoreChunk(baseChunk, 'nonsensequery', ['nonsensequery'])).toBe(0);
  });
});

describe('makeExcerpt', () => {
  it('returns a window around the first matching term', () => {
    const text = 'a '.repeat(200) + 'TARGET ' + 'b '.repeat(200);
    const excerpt = makeExcerpt(text, 'target', ['target']);
    expect(excerpt.toLowerCase()).toContain('target');
    expect(excerpt.startsWith('...')).toBe(true);
    expect(excerpt.endsWith('...')).toBe(true);
  });
});

describe('matchesPathPrefix', () => {
  it('matches when no prefixes are provided', () => {
    expect(matchesPathPrefix('/docs/foo', undefined)).toBe(true);
    expect(matchesPathPrefix('/docs/foo', [])).toBe(true);
  });

  it('matches when at least one prefix matches', () => {
    expect(matchesPathPrefix('/docs/acps/77', ['/docs/acps'])).toBe(true);
    expect(matchesPathPrefix('/docs/other/foo', ['/docs/acps', '/docs/rpcs'])).toBe(false);
  });
});

describe('sanitizeForReflection', () => {
  it('strips zero-width / bidi unicode characters', () => {
    const tricky = 'foo​bar‌baz‮qux﻿end';
    expect(sanitizeForReflection(tricky)).toBe('foobarbazquxend');
  });

  it('strips ASCII control characters but keeps newlines and tabs', () => {
    const text = 'line1\n\tline2\x07with\x1Fcontrol';
    expect(sanitizeForReflection(text)).toBe('line1\n\tline2withcontrol');
  });

  it('strips dangerous URL schemes from markdown links, keeping link text', () => {
    const md = 'See [click me](javascript:alert(1)) for more.';
    expect(sanitizeForReflection(md)).toBe('See click me for more.');
  });

  it('handles data: and vbscript: schemes too', () => {
    expect(sanitizeForReflection('[x](data:text/html,<script>)')).toBe('x');
    expect(sanitizeForReflection('[y](vbscript:msgbox)')).toBe('y');
    expect(sanitizeForReflection('[z](file:///etc/passwd)')).toBe('z');
  });

  it('preserves http(s) and internal markdown links', () => {
    const md = 'See [docs](https://build.avax.network/docs) and [home](/docs).';
    expect(sanitizeForReflection(md)).toBe(md);
  });

  it('neutralizes bare dangerous schemes that are not in markdown link syntax', () => {
    expect(sanitizeForReflection('try javascript:alert(1) here')).toContain('[blocked-scheme]:');
  });

  it('handles empty / non-string inputs safely', () => {
    expect(sanitizeForReflection('')).toBe('');
    // @ts-expect-error verifying runtime safety
    expect(sanitizeForReflection(null)).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('allows https and http URLs', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('allows internal absolute paths', () => {
    expect(sanitizeUrl('/docs/foo')).toBe('/docs/foo');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeUrl('//evil.com/path')).toBeUndefined();
  });

  it('rejects dangerous schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('data:text/html,xxx')).toBeUndefined();
    expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined();
    expect(sanitizeUrl('mailto:a@b.com')).toBeUndefined();
  });

  it('rejects empty or non-string input', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl('')).toBeUndefined();
    expect(sanitizeUrl('   ')).toBeUndefined();
  });
});

describe('makeExcerpt sanitization', () => {
  it('removes zero-width unicode and dangerous links from excerpts', () => {
    const text =
      'Click here​ for a [malicious](javascript:steal()) link or [safe](/docs/foo) one.';
    const out = makeExcerpt(text, 'click', ['click']);
    expect(out).not.toContain('​');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('malicious');
    expect(out).toContain('[safe](/docs/foo)');
  });
});
