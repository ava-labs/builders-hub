import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import type { InferPageType } from 'fumadocs-core/source';
import type { documentation, academy, guide, integration } from '@/lib/source';
import { readFileSync } from 'fs';
import { join } from 'path';

// Create a union type for all possible page types
type AnyPage = InferPageType<typeof documentation> | InferPageType<typeof academy> | InferPageType<typeof guide> | InferPageType<typeof integration>;

const processor = remark()
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkMath); // Add math support like in source.config.ts

export async function getLLMText(page: AnyPage) {
  try {
    // Determine the correct file path based on the page URL
    let filePath: string;
    
    if (page.url.startsWith('/integrations/')) {
      // Integration pages need the integrations directory prefix
      filePath = join(process.cwd(), 'content', 'integrations', page.file.path);
    } else if (page.url.startsWith('/guides/')) {
      // Guide pages need the guides directory prefix
      filePath = join(process.cwd(), 'content', 'guides', page.file.path);
    } else if (page.url.startsWith('/academy/')) {
      // Academy pages need the academy directory prefix
      filePath = join(process.cwd(), 'content', 'academy', page.file.path);
    } else if (page.url.startsWith('/docs/')) {
      // Docs pages need the docs directory prefix
      filePath = join(process.cwd(), 'content', 'docs', page.file.path);
    } else {
      // Fallback - try to use the file path as is
      filePath = join(process.cwd(), 'content', page.file.path);
    }
    
    let rawContent = readFileSync(filePath, 'utf-8');
    
    // Remove frontmatter if present
    rawContent = rawContent.replace(/^---[\s\S]*?---\n/, '');
    
    // Process the MDX content
    const processed = await processor.process({
      path: filePath,
      value: rawContent,
    });

    return `# ${page.data.title}
URL: ${page.url}

${page.data.description || ''}

${processed.value}`;
  } catch (error) {
    console.error(`Failed to process page ${page.data.title} (${page.file.path}):`, error);
    
    // Fallback: try to load the content asynchronously if available
    try {
      if ('load' in page.data && typeof page.data.load === 'function') {
        const { body } = await page.data.load();
        return `# ${page.data.title}
URL: ${page.url}

${page.data.description || ''}

Note: This content was loaded asynchronously and may contain React components.`;
      }
    } catch (loadError) {
      console.error(`Failed to load content for page ${page.data.title}:`, loadError);
    }
    
    // Final fallback
    return `# ${page.data.title}
URL: ${page.url}

${page.data.description || ''}`;
  }
}