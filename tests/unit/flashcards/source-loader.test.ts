import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { stripMdx, resolveMdxPath, estimateTokens } from '@/lib/flashcards/source-loader';
import type { SourceAnchor } from '@/lib/flashcards/types';

describe('stripMdx', () => {
  it('removes import statements at the top of the file', () => {
    const input = `import { Quiz } from '@/components/quiz';\nimport Foo from 'bar';\n\n# Heading\n\nBody.`;
    const out = stripMdx(input);
    expect(out).not.toContain('import');
    expect(out).toContain('# Heading');
    expect(out).toContain('Body.');
  });

  it('removes self-closing JSX components but keeps prose', () => {
    const input = `# Title\n\n<Quiz quizId="1" />\n\nThis is the prose.`;
    const out = stripMdx(input);
    expect(out).not.toContain('<Quiz');
    expect(out).toContain('This is the prose.');
  });

  it('removes paired JSX components including nested content', () => {
    const input = `# Title\n\n<Callout type="info">\n  Hidden inside JSX\n</Callout>\n\nVisible prose.`;
    const out = stripMdx(input);
    expect(out).not.toContain('Callout');
    expect(out).not.toContain('Hidden inside JSX');
    expect(out).toContain('Visible prose.');
  });

  it('preserves fenced code blocks verbatim', () => {
    const input = '# Title\n\n```ts\nconst x = 1;\n```\n\nAfter.';
    const out = stripMdx(input);
    expect(out).toContain('```ts');
    expect(out).toContain('const x = 1;');
    expect(out).toContain('After.');
  });

  it('keeps lowercase HTML and standard markdown intact', () => {
    const input = `# Title\n\nNormal **bold** and *italic* with [a link](https://example.com).\n\n<br />\n\nMore text.`;
    const out = stripMdx(input);
    expect(out).toContain('**bold**');
    expect(out).toContain('*italic*');
    expect(out).toContain('[a link](https://example.com)');
    expect(out).toContain('More text.');
  });

  it('is idempotent', () => {
    const input = `import { X } from 'y';\n\n<Comp foo="bar" />\n\nBody.`;
    const first = stripMdx(input);
    const second = stripMdx(first);
    expect(first).toEqual(second);
  });
});

describe('resolveMdxPath', () => {
  it('resolves a chapter path to its <path>.mdx file', () => {
    const anchor: SourceAnchor = {
      kind: 'academy',
      path: '/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications',
      chapterTitle: 'X',
    };
    const out = resolveMdxPath(anchor);
    expect(out.endsWith(path.normalize('content/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications.mdx'))).toBe(true);
  });

  it('falls back to <path>/index.mdx when the direct file does not exist (course root URL)', () => {
    const anchor: SourceAnchor = {
      kind: 'academy',
      path: '/academy/avalanche-l1/avalanche-fundamentals',
      chapterTitle: 'Welcome',
    };
    const out = resolveMdxPath(anchor);
    expect(out.endsWith(path.normalize('content/academy/avalanche-l1/avalanche-fundamentals/index.mdx'))).toBe(true);
  });

  it('throws a descriptive error when neither candidate exists', () => {
    const anchor: SourceAnchor = {
      kind: 'docs',
      path: '/docs/definitely-not-real/nope',
      chapterTitle: 'X',
    };
    expect(() => resolveMdxPath(anchor)).toThrow(/No MDX file found/);
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty markdown', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('approximates 1.3 tokens per word', () => {
    const words = new Array(100).fill('word').join(' ');
    const tokens = estimateTokens(words);
    expect(tokens).toBeGreaterThanOrEqual(120);
    expect(tokens).toBeLessThanOrEqual(140);
  });
});
