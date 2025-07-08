import { documentation, academy, guide, integration } from '@/lib/source';
import { getLLMText } from '../../lib/getLLMText';

// cached forever
export const revalidate = false;

// In-memory cache for the processed content
let cachedContent: string | null = null;
let cacheTimestamp: Date | null = null;

export async function GET() {
  try {
    // Return cached content if available
    if (cachedContent) {
      console.log(`Serving cached llms.txt from ${cacheTimestamp?.toISOString()}`);
      return new Response(cachedContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Cache': 'HIT',
          'X-Cache-Timestamp': cacheTimestamp?.toISOString() || '',
        },
      });
    }

    // Get pages from all sources
    const allPages = [
      ...documentation.getPages(),
      ...academy.getPages(),
      ...guide.getPages(),
      ...integration.getPages()
    ];
    
    console.log(`Processing ${allPages.length} pages for llms.txt`);
    
    const scan = allPages.map(getLLMText);
    const scanned = await Promise.all(scan);
    
    // Cache the result
    cachedContent = scanned.join('\n\n');
    cacheTimestamp = new Date();
    console.log(`Cached llms.txt at ${cacheTimestamp.toISOString()}`);

    return new Response(cachedContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Cache': 'MISS',
        'X-Cache-Timestamp': cacheTimestamp.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in llms.txt route:', error);
    return new Response(`Error generating llms.txt: ${error}`, { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}