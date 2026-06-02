import type { Page } from 'fumadocs-core/source';
import { readFile } from 'fs/promises';

const SITE_URL = 'https://build.avax.network';

/**
 * Discovery footer appended to every markdown document we serve (via the
 * `.md` URLs and llms-full.txt). An AI agent that fetches a page's markdown
 * can follow it to the machine-readable site index.
 *
 * This is the signal the Agent Score "llms.txt directive (markdown)" check
 * looks for — without it, the .md representations advertise no path to
 * /llms.txt and the check fails regardless of which pages get sampled.
 */
export const LLMS_TXT_DIRECTIVE =
  `\n\n---\n\n` +
  `*This document is part of the [Avalanche Builder Hub](${SITE_URL}). ` +
  `See [/llms.txt](${SITE_URL}/llms.txt) for the full machine-readable ` +
  `documentation index, or append \`.md\` to any page URL for its raw markdown.*\n`;

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
  const startsWithH1 = trimmed.startsWith('# ');
  const body = startsWithH1 ? trimmed : `# ${title || 'Untitled'}\n\n${trimmed}`;
  return `${body}${LLMS_TXT_DIRECTIVE}`;
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
