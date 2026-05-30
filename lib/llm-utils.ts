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
  let content: string;
  try {
    content = await (page.data as PageDataWithText).getText('processed');
  } catch {
    try {
      content = await (page.data as PageDataWithText).getText('raw');
    } catch {
      // Fallback: read raw MDX from disk and strip frontmatter
      try {
        const raw = await readFile(page.absolutePath, 'utf-8');
        content = stripFrontmatter(raw);
      } catch {
        content = '';
      }
    }
  }

  return `# ${page.data.title} (${page.url})\n\n${content}`;
}
