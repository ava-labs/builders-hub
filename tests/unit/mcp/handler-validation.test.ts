import { describe, expect, it, vi } from 'vitest';

// Stub fumadocs source loaders so importing the handler modules doesn't pull MDX
// content through Vite's transform pipeline (which choked on academy/*.mdx in CI).
vi.mock('@/lib/source', () => {
  const empty = { getPages: () => [] };
  return {
    documentation: empty,
    academy: empty,
    integration: empty,
    blog: empty,
  };
});

vi.mock('@/lib/llm-utils', () => ({
  getLLMText: vi.fn(async () => ''),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

import { docsTools } from '@/lib/mcp/tools/docs';
import { githubTools } from '@/lib/mcp/tools/github';

function getText(result: { content: Array<{ type: 'text'; text: string }>; isError?: boolean }) {
  return { text: result.content[0]?.text ?? '', isError: !!result.isError };
}

describe('docs_fetch URL validation', () => {
  it('rejects URLs that do not start with /', async () => {
    const result = getText(await docsTools.handlers.docs_fetch({ url: 'docs/foo' }));
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/must start with/);
  });

  it('rejects path traversal', async () => {
    const result = getText(await docsTools.handlers.docs_fetch({ url: '/docs/../secrets' }));
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/Invalid URL/);
  });

  it('rejects percent-encoded path traversal', async () => {
    const result = getText(await docsTools.handlers.docs_fetch({ url: '/docs/%2e%2e/secrets' }));
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/Invalid URL/);
  });

  it('rejects URLs with a protocol', async () => {
    const result = getText(await docsTools.handlers.docs_fetch({ url: '/docs/https://evil.com' }));
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/Invalid URL/);
  });

  it('rejects URLs outside allowed prefixes', async () => {
    const result = getText(await docsTools.handlers.docs_fetch({ url: '/api/secret' }));
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/must start with one of/);
  });

  it('rejects malformed percent-encoding', async () => {
    const result = getText(await docsTools.handlers.docs_fetch({ url: '/docs/%E0%A4%A' }));
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/percent-encoded/);
  });
});

describe('github_get_file path & ref validation', () => {
  it('rejects absolute paths', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({ repo: 'avalanchego', path: '/etc/passwd' })
    );
    expect(result.text).toMatch(/relative to the repository root/);
  });

  it('rejects path traversal', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({ repo: 'avalanchego', path: '../foo' })
    );
    expect(result.text).toMatch(/path traversal/);
  });

  it('rejects percent-encoded path traversal', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({ repo: 'avalanchego', path: '%2e%2e/foo' })
    );
    expect(result.text).toMatch(/path traversal/);
  });

  it('rejects backslash separators', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({ repo: 'avalanchego', path: 'foo\\bar' })
    );
    expect(result.text).toMatch(/forward slashes/);
  });

  it('rejects Windows drive letters', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({ repo: 'avalanchego', path: 'C:/foo' })
    );
    expect(result.text).toMatch(/absolute Windows path/);
  });

  it('rejects unknown repo', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({ repo: 'evil/repo', path: 'README.md' })
    );
    expect(result.text).toMatch(/not in the allowed list/);
  });

  it('rejects refs with invalid characters', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({
        repo: 'avalanchego',
        path: 'README.md',
        ref: 'main; echo pwn',
      })
    );
    expect(result.text).toMatch(/valid git ref/);
  });

  it('rejects refs that are too long', async () => {
    const result = getText(
      await githubTools.handlers.github_get_file({
        repo: 'avalanchego',
        path: 'README.md',
        ref: 'a'.repeat(201),
      })
    );
    expect(result.text).toMatch(/valid git ref/);
  });
});

describe('github_search_code qualifier stripping', () => {
  it('rejects empty queries (and queries that become empty after stripping qualifiers)', async () => {
    const result = getText(
      await githubTools.handlers.github_search_code({ query: 'repo:attacker/private' })
    );
    expect(result.text).toMatch(/empty after sanitization|query is required/i);
  });

  it('rejects unknown repo', async () => {
    const result = getText(
      await githubTools.handlers.github_search_code({
        query: 'foo',
        repo: 'definitely-not-a-repo',
      })
    );
    expect(result.text).toMatch(/not in the allowed list/);
  });
});
