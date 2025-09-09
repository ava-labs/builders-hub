import { streamText } from 'ai';
import { getModel } from './ai';
import { generateSystemPrompt } from './prompt';
import { searchContent } from './search';
import { suggestConsoleTools } from './console-tools';

export const runtime = 'edge';

// Cache for valid URLs
let validUrlsCache: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getValidUrls(): Promise<Set<string>> {
  const now = Date.now();
  
  if (validUrlsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return validUrlsCache;
  }
  
  try {
    const response = await fetch(new URL('/static.json', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
    const data = await response.json();
    
    validUrlsCache = new Set(data.map((item: any) => item.url));
    cacheTimestamp = now;
    
    console.log(`Cached ${validUrlsCache.size} valid URLs`);
    return validUrlsCache;
  } catch (error) {
    console.error('Error fetching valid URLs:', error);
    return new Set();
  }
}

export async function POST(req: Request) {
  const { messages, model = 'anthropic' } = await req.json();
  
  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
  
  const validUrls = await getValidUrls();
  
  let relevantContext = '';
  if (lastUserMessage) {
    const relevantSections = await searchContent(lastUserMessage.content);
    console.log(`Query: "${lastUserMessage.content}"`);
    console.log(`Found ${relevantSections.length} relevant sections`);
    if (relevantSections.length > 0) {
      console.log('Top 5 results:');
      relevantSections.slice(0, 5).forEach((section, i) => {
        console.log(`  ${i + 1}. ${section.title} (score: ${section.score})`);
      });
    }
    
    const consolePicks = suggestConsoleTools(lastUserMessage.content);

    if (relevantSections.length > 0) {
      relevantContext = '\n\n=== COMPREHENSIVE DOCUMENTATION CONTEXT ===\n';
      relevantContext += `Found ${relevantSections.length} relevant documents. Providing extensive context for confident, accurate answers.\n\n`;

      if (consolePicks.length > 0) {
        relevantContext += '--- CONSOLE SUGGESTIONS ---\n';
        consolePicks.forEach((p, idx) => {
          relevantContext += `${idx + 1}. ${p.name} → https://build.avax.network/console/${p.path} (${p.reason})\n`;
        });
        relevantContext += '--- END CONSOLE SUGGESTIONS ---\n\n';
      }
      
      const detailedDocs = Math.min(relevantSections.length, 12);
      
      relevantSections.slice(0, detailedDocs).forEach((section, index) => {
        const fullUrl = `https://build.avax.network${section.url}`;
        relevantContext += `--- Document ${index + 1} of ${detailedDocs} ---\n`;
        relevantContext += `Title: ${section.title}\n`;
        relevantContext += `Source URL: ${fullUrl}\n`;
        relevantContext += `Relevance Score: ${section.score}`;
        
        if (section.score > 200) {
          relevantContext += ' (EXACT MATCH - Highest Relevance)\n';
        } else if (section.score > 100) {
          relevantContext += ' (HIGH Relevance)\n';
        } else if (section.score > 50) {
          relevantContext += ' (GOOD Relevance)\n';
        } else {
          relevantContext += ' (MODERATE Relevance)\n';
        }
        
        relevantContext += `Section: ${section.url.split('/')[1]}\n`;
        
        // Headings preview (if available)
        if ((section as any).headings && (section as any).headings.length) {
          const headings = (section as any).headings.slice(0, 8).join(' | ');
          relevantContext += `Headings: ${headings}\n`;
        }

        relevantContext += `Content Preview:\n`;
        
        const contentLength = 6000;
        const fullContent = section.content;
        
        if (fullContent.length > contentLength) {
          const truncatedContent = fullContent.substring(0, contentLength);
          const lastParagraph = truncatedContent.lastIndexOf('\n\n');
          const lastSentence = truncatedContent.lastIndexOf('. ');
          const lastCodeBlock = truncatedContent.lastIndexOf('```');
          
          let cutPoint = contentLength;
          if (lastParagraph > contentLength * 0.8) {
            cutPoint = lastParagraph;
          } 
          else if (lastCodeBlock > contentLength * 0.7) {
            const codeBlockEnd = truncatedContent.indexOf('```', lastCodeBlock + 3);
            if (codeBlockEnd === -1) {
              cutPoint = lastCodeBlock;
            }
          }
          else if (lastSentence > contentLength * 0.8) {
            cutPoint = lastSentence + 1;
          }
          
          relevantContext += fullContent.substring(0, cutPoint);
          relevantContext += '\n\n[... Content truncated for length. Full documentation available at the source URL above ...]\n';
        } else {
          relevantContext += fullContent;
        }
        
        relevantContext += '\n--- End of Document ---\n\n';
      });
      
      relevantContext += '=== SEARCH SUMMARY ===\n';
      relevantContext += `Found ${relevantSections.length} highly relevant documents for your query.\n`;
      
      const topScore = relevantSections[0].score;
      if (topScore > 200) {
        relevantContext += 'CONFIDENCE: VERY HIGH - Found exact matches and comprehensive documentation.\n';
      } else if (topScore > 100) {
        relevantContext += 'CONFIDENCE: HIGH - Found relevant documentation with good coverage.\n';
      } else if (topScore > 50) {
        relevantContext += 'CONFIDENCE: MODERATE - Found related documentation that should help.\n';
      } else {
        relevantContext += 'CONFIDENCE: LOW - Found potentially related documentation.\n';
      }
      
      if (relevantSections.length > detailedDocs) {
        relevantContext += `\nAdditional ${relevantSections.length - detailedDocs} related documents for reference:\n`;
        relevantSections.slice(detailedDocs).forEach((section) => {
          relevantContext += `- ${section.title} (Score: ${section.score}): https://build.avax.network${section.url}\n`;
        });
      }
      
      relevantContext += '\n=== CONTEXT ANALYSIS ===\n';
      const sectionCoverage = new Map<string, number>();
      relevantSections.forEach(s => {
        const section = s.url.split('/')[1];
        sectionCoverage.set(section, (sectionCoverage.get(section) || 0) + 1);
      });
      
      relevantContext += 'Documentation coverage by section:\n';
      Array.from(sectionCoverage.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([section, count]) => {
          relevantContext += `- ${section}: ${count} documents\n`;
        });
      
      relevantContext += '=== END OF COMPREHENSIVE DOCUMENTATION CONTEXT ===\n';
    } else {
      relevantContext = '\n\n=== DOCUMENTATION CONTEXT ===\n';
      relevantContext += 'No specific documentation sections were found for this query in the indexed content.\n';
      relevantContext += 'However, you should still try to help the user by:\n';
      relevantContext += '1. Checking if any Console tools can help with their task (Console-first).\n';
      relevantContext += '2. Providing general guidance while noting it\'s not from specific Avalanche docs.\n';
      relevantContext += '3. Suggesting relevant documentation sections they might want to explore.\n';
      relevantContext += '=== END OF DOCUMENTATION CONTEXT ===\n';
    }
  }

  const selectedModel = getModel(model as 'anthropic' | 'openai');
  const systemPrompt = generateSystemPrompt(relevantContext);

  const result = streamText({
    model: selectedModel,
    messages: messages,
    system: systemPrompt,
    onFinish: async ({ text }) => {
      const urlPattern = /https:\/\/build\.avax\.network([^)\s]+)/g;
      const matches = text.match(urlPattern);
      
      if (matches) {
        console.log('Generated URLs:');
        for (const url of matches) {
          const path = url.replace('https://build.avax.network', '');
          const isValid = validUrls.has(path);
          console.log(`  ${url} - ${isValid ? 'VALID' : 'INVALID'}`);
        }
      }
    },
  });

  return result.toDataStreamResponse();
}
