import { describe, expect, it } from 'vitest';

import { formatLLMDocument, getLLMText, LLMS_TXT_DIRECTIVE } from '@/lib/llm-utils';

/**
 * These guard the Agent Score signals we fully control in the markdown
 * (.md) representation of every page:
 *   - content starts with an H1 (content-start-position)
 *   - the /llms.txt directive sits near the top, right under the H1, not in a
 *     footer (llms-txt-directive-md — afdocs warns when it is past 50%)
 * If a future refactor breaks either, CI fails here instead of the live score
 * silently sliding on the next audit.
 */
describe('formatLLMDocument', () => {
  it('keeps the existing H1 and does not duplicate the title heading', () => {
    const out = formatLLMDocument('Page Title', '# Real Heading\n\nbody');
    expect(out.startsWith('# Real Heading')).toBe(true);
    expect(out).not.toContain('# Page Title');
  });

  it('prepends an H1 from the title when the content has none', () => {
    const out = formatLLMDocument('Page Title', 'just body text');
    expect(out.startsWith('# Page Title\n\n')).toBe(true);
  });

  it('falls back to "Untitled" when the page has no title', () => {
    const out = formatLLMDocument(undefined, 'body without heading');
    expect(out.startsWith('# Untitled\n\n')).toBe(true);
  });

  it('trims leading whitespace so content starts at position 0', () => {
    const out = formatLLMDocument('T', '\n\n\n# Heading\n\nbody');
    expect(out.startsWith('# Heading')).toBe(true);
  });

  it('places the llms.txt directive near the top — after the H1, before the body', () => {
    const out = formatLLMDocument('T', '# Heading\n\nbody content here');
    expect(out.startsWith('# Heading')).toBe(true);
    expect(out).toContain('/llms.txt');
    // directive sits between the H1 and the body, never in a footer
    expect(out.indexOf('/llms.txt')).toBeLessThan(out.indexOf('body content here'));
  });

  it('formats the directive as an absolute-URL blockquote', () => {
    expect(LLMS_TXT_DIRECTIVE.startsWith('>')).toBe(true);
    expect(LLMS_TXT_DIRECTIVE).toContain('https://build.avax.network/llms.txt');
  });
});

describe('getLLMText', () => {
  const makePage = (title: string, text: string) =>
    ({
      url: '/docs/example',
      absolutePath: '/nonexistent.mdx',
      data: { title, getText: async () => text },
    }) as any;

  it('builds a directive-bearing document from a page', async () => {
    const out = await getLLMText(makePage('My Page', '# My Page\n\ncontent'));
    expect(out.startsWith('# My Page')).toBe(true);
    expect(out).toContain('https://build.avax.network/llms.txt');
  });
});
