import type { Page } from 'fumadocs-core/source';
import { readFile } from 'fs/promises';

// Type assertion for getText method (available when includeProcessedMarkdown is enabled)
interface PageDataWithText {
  getText(type: 'processed' | 'raw'): Promise<string>;
  title: string;
  [key: string]: any;
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? content.slice(match[0].length).trim() : content;
}

export async function getLLMText(page: Page) {
  // Use the RAW markdown, never 'processed'. getText('processed') runs a per-page
  // MDX compile (buildMDX + shiki + twoslash) that only fires in prod; the docs
  // search index builds this over ~1,000+ pages on the first call and blows the
  // 30s serverless budget (the docs_search 504). Raw is a plain read — no compile.
  let content: string;
  try {
    content = stripFrontmatter(await (page.data as PageDataWithText).getText('raw'));
  } catch {
    // Fallback: read raw MDX from disk and strip frontmatter.
    try {
      content = stripFrontmatter(await readFile(page.absolutePath, 'utf-8'));
    } catch {
      content = '';
    }
  }

  return `# ${page.data.title} (${page.url})\n\n${content}`;
}
