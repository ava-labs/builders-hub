import type { Page } from 'fumadocs-core/source';
import { readFile } from 'fs/promises';

const SITE_URL = 'https://build.avax.network';

/**
 * Discovery directive embedded near the top of every markdown document we
 * serve (the `.md` URLs and llms-full.txt). An AI agent that fetches a page's
 * markdown can follow it to the machine-readable site index.
 *
 * This is the signal the Agent Score "llms.txt directive (markdown)" check
 * looks for. It is placed immediately under the H1 (not in a footer) because
 * afdocs warns when the directive sits past the 50% mark of the document.
 */
export const LLMS_TXT_DIRECTIVE =
  `> 📚 Machine-readable index: [/llms.txt](${SITE_URL}/llms.txt). ` +
  `Append \`.md\` to any page URL for its raw markdown.`;

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

/**
 * Normalizes raw page markdown into an LLM-friendly document:
 *   1. Guarantees the document opens with a single H1 — never a blank line or
 *      a duplicated title — so content starts immediately (Agent Score
 *      "content start position").
 *   2. Appends the llms.txt discovery directive (Agent Score
 *      "llms.txt directive (markdown)").
 *
 * Kept pure and synchronous so the invariants above can be unit-tested without
 * touching the filesystem or fumadocs sources. See tests/unit/seo/.
 */
export function formatLLMDocument(title: string | undefined, rawContent: string): string {
  const trimmed = rawContent.trimStart();

  if (trimmed.startsWith('# ')) {
    // Insert the directive on its own line right after the existing H1.
    const nl = trimmed.indexOf('\n');
    const h1 = nl === -1 ? trimmed : trimmed.slice(0, nl);
    const rest = nl === -1 ? '' : trimmed.slice(nl + 1).replace(/^\n+/, '');
    return rest
      ? `${h1}\n\n${LLMS_TXT_DIRECTIVE}\n\n${rest}`
      : `${h1}\n\n${LLMS_TXT_DIRECTIVE}\n`;
  }

  return `# ${title || 'Untitled'}\n\n${LLMS_TXT_DIRECTIVE}\n\n${trimmed}`;
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

  return formatLLMDocument(page.data.title, content);
}
