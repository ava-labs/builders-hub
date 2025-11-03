import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import type { InferPageType } from 'fumadocs-core/source';
import type { documentation, academy, blog, integration } from '@/lib/source';
import { readFileSync } from 'fs';
import { join } from 'path';

// Create a union type for all possible page types
type AnyPage = InferPageType<typeof documentation> | InferPageType<typeof academy> | InferPageType<typeof blog> | InferPageType<typeof integration>;

const processor = remark()
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkMath); // Add math support like in source.config.ts

export async function getLLMText(page: AnyPage) {
  try {
    // Determine the correct file path based on the page URL
    let filePath: string;
    
    if (page.url.startsWith('/integrations/')) {
      // Integration pages - strip /integrations/ prefix
      filePath = join(process.cwd(), 'content', 'integrations', `${page.url.replace('/integrations/', '')}.mdx`);
    } else if (page.url.startsWith('/blog/')) {
      // Blog pages - strip /blog/ prefix
      filePath = join(process.cwd(), 'content', 'blog', `${page.url.replace('/blog/', '')}.mdx`);
    } else if (page.url.startsWith('/academy/')) {
      // Academy pages - strip /academy/ prefix
      filePath = join(process.cwd(), 'content', 'academy', `${page.url.replace('/academy/', '')}.mdx`);
    } else if (page.url.startsWith('/docs/')) {
      // Docs pages - strip /docs/ prefix
      filePath = join(process.cwd(), 'content', 'docs', `${page.url.replace('/docs/', '')}.mdx`);
    } else {
      // Fallback - try to use the URL as is
      filePath = join(process.cwd(), 'content', `${page.url}.mdx`);
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
    console.error(`Failed to process page ${page.data.title} (${page.url}):`, error);
    
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