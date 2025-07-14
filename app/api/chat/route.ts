import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const runtime = 'edge';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for valid URLs
let validUrlsCache: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getValidUrls(): Promise<Set<string>> {
  const now = Date.now();
  
  // Return cached URLs if still valid
  if (validUrlsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return validUrlsCache;
  }
  
  try {
    // Fetch valid URLs from static.json
    const response = await fetch(new URL('/static.json', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
    const data = await response.json();
    
    // Extract URLs and create a Set for fast lookup
    validUrlsCache = new Set(data.map((item: any) => item.url));
    cacheTimestamp = now;
    
    console.log(`Cached ${validUrlsCache.size} valid URLs`);
    return validUrlsCache;
  } catch (error) {
    console.error('Error fetching valid URLs:', error);
    // Return empty set if error, don't block the response
    return new Set();
  }
}

function validateAndFixUrls(content: string, validUrls: Set<string>): string {
  // Pattern to match markdown links
  const linkPattern = /\[([^\]]+)\]\(https:\/\/build\.avax\.network([^)]+)\)/g;
  
  return content.replace(linkPattern, (match, linkText, path) => {
    // Check if the path exists in valid URLs
    if (validUrls.has(path)) {
      return match; // URL is valid, keep it
    }
    
    // Try to find a similar valid URL
    const pathLower = path.toLowerCase();
    const pathParts = pathLower.split('/').filter(Boolean);
    
    // Look for the best matching URL
    let bestMatch = '';
    let bestScore = 0;
    
    for (const validUrl of validUrls) {
      const validLower = validUrl.toLowerCase();
      const validParts = validLower.split('/').filter(Boolean);
      
      // Calculate similarity score
      let score = 0;
      
      // Check if it's in the same section (docs, academy, etc.)
      if (pathParts[0] === validParts[0]) {
        score += 10;
      }
      
      // Check for matching segments
      for (const part of pathParts) {
        if (validLower.includes(part)) {
          score += 1;
        }
      }
      
      // Prefer shorter paths for general topics
      if (validParts.length <= pathParts.length) {
        score += 0.5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = validUrl;
      }
    }
    
    if (bestMatch && bestScore >= 10) {
      // Found a reasonable match
      console.log(`Replaced invalid URL ${path} with ${bestMatch}`);
      return `[${linkText}](https://build.avax.network${bestMatch})`;
    } else {
      // No good match found, link to the section root
      const section = pathParts[0] || 'docs';
      const sectionUrl = `/${section}`;
      
      // Check if section root exists
      if (validUrls.has(sectionUrl)) {
        console.log(`Replaced invalid URL ${path} with section root ${sectionUrl}`);
        return `[${linkText}](https://build.avax.network${sectionUrl})`;
      } else {
        // Default to docs
        console.log(`Replaced invalid URL ${path} with /docs`);
        return `[${linkText}](https://build.avax.network/docs)`;
      }
    }
  });
}

async function loadLLMsContent() {
  try {
    const response = await fetch(new URL('/llms.txt', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
    const llmsContent = await response.text();
    
    // Parse the content into sections
    const sections = llmsContent.split('\n\n').filter(section => section.trim());
    
    const contentSections = sections.map(section => {
      const lines = section.split('\n');
      const titleLine = lines.find(line => line.startsWith('# '));
      const urlLine = lines.find(line => line.startsWith('URL: '));
      
      return {
        title: titleLine ? titleLine.replace('# ', '') : '',
        url: urlLine ? urlLine.replace('URL: ', '') : '',
        content: section
      };
    }).filter(s => s.title && s.url);
    
    return contentSections;
  } catch (error) {
    console.error('Error loading llms.txt:', error);
    return [];
  }
}

function searchContent(query: string, sections: Array<{ title: string; url: string; content: string }>) {
  const queryLower = query.toLowerCase();
  
  // Extract words but be smarter about filtering
  // Keep words that are 2+ chars, or are important short words like "is"
  const words = queryLower.split(/\s+/).filter(word => {
    // Keep words that are 2+ characters
    if (word.length >= 2) return true;
    // Keep important short words
    if (['is', 'a', 'i', 'to', 'on', 'in', 'of'].includes(word)) return true;
    return false;
  });
  
  // Extract query patterns for better understanding
  let mainSubject = '';
  let queryType = 'general';
  
  // Pattern: "what is X"
  const whatIsMatch = queryLower.match(/what\s+is\s+(.+)/);
  if (whatIsMatch) {
    mainSubject = whatIsMatch[1].trim();
    queryType = 'definition';
  }
  
  // Pattern: "how to X" or "how do I X"
  const howToMatch = queryLower.match(/how\s+(?:to|do\s+i)\s+(.+)/);
  if (howToMatch) {
    mainSubject = howToMatch[1].trim();
    queryType = 'tutorial';
  }
  
  // Pattern: "X tutorial" or "X guide"
  const tutorialMatch = queryLower.match(/(.+?)\s+(?:tutorial|guide|example)/);
  if (tutorialMatch) {
    mainSubject = tutorialMatch[1].trim();
    queryType = 'tutorial';
  }
  
  // Pattern: "error" or "issue" or "problem"
  if (queryLower.match(/error|issue|problem|fix|troubleshoot/)) {
    queryType = 'troubleshooting';
  }
  
  // Pattern: questions about specific features
  const featureMatch = queryLower.match(/(?:does|can|support|have|include)\s+(.+?)\s+(?:support|have|include|work|compatible)/);
  if (featureMatch) {
    mainSubject = featureMatch[1].trim();
    queryType = 'feature-check';
  }
  
  // Pattern: comparison queries
  if (queryLower.match(/difference|compare|versus|vs\.|between/)) {
    queryType = 'comparison';
  }
  
  // Pattern: requirements/specifications queries
  if (queryLower.match(/requirement|specification|minimum|hardware|system.*requirement/)) {
    queryType = 'requirements';
    // Extract what requirements they're asking about
    const reqMatch = queryLower.match(/(?:hardware|system|software|minimum|recommended)\s*requirements?\s*(?:for\s+)?(.+)?/);
    if (reqMatch && reqMatch[1]) {
      mainSubject = reqMatch[1].trim();
    }
  }
  
  // Pattern: faucet/funding queries
  if (queryLower.match(/faucet|test.*(?:avax|tokens?)|get.*(?:avax|tokens?)|fund|funding|gas.*money|fuji.*(?:avax|tokens?)/)) {
    queryType = 'faucet';
    mainSubject = 'faucet';
  }
  
  // Define important keywords that should be weighted more heavily
  const importantKeywords = new Set([
    'deploy', 'create', 'build', 'install', 'setup', 'configure', 'start',
    'avalanche', 'subnet', 'chain', 'contract', 'token', 'wallet', 'node',
    'error', 'issue', 'problem', 'help', 'how', 'what', 'why', 'when',
    'tutorial', 'guide', 'example', 'documentation',
    // Add more Avalanche-specific terms
    'l1', 'validator', 'stake', 'delegate', 'teleporter', 'icm', 'ictt',
    'evm', 'rpc', 'api', 'endpoint', 'network', 'testnet', 'mainnet',
    'bridge', 'cross-chain', 'interchain', 'message', 'transfer',
    'precompile', 'native', 'minter', 'fee', 'reward', 'warp',
    // Add integration-specific terms
    'avacloud', 'cloud', 'service', 'integration', 'tool', 'platform',
    'monitor', 'analytics', 'indexer', 'oracle', 'sdk', 'framework',
    'infrastructure', 'provider', 'explorer', 'audit', 'security',
    // Add node and system-specific terms
    'hardware', 'requirements', 'system', 'cpu', 'ram', 'memory', 'storage',
    'disk', 'ssd', 'specifications', 'minimum', 'recommended', 'performance',
    // Add faucet-specific terms
    'faucet', 'avax', 'fuji', 'test', 'tokens', 'fund', 'funding', 'gas'
  ]);
  
  // Score each section based on relevance
  const scored = sections.map(section => {
    let score = 0;
    const contentLower = section.content.toLowerCase();
    const titleLower = section.title.toLowerCase();
    
    // Query type specific scoring
    if (queryType === 'definition') {
      // For "what is X" queries, heavily boost exact title matches
      if (mainSubject && titleLower === mainSubject) {
        score += 100;
      } else if (mainSubject && titleLower.includes(mainSubject)) {
        score += 50;
      }
      // Boost overview sections
      if (contentLower.includes('## overview') || contentLower.includes('# overview')) {
        score += 20;
      }
    } else if (queryType === 'tutorial') {
      // For "how to" queries, boost tutorial/guide content
      if (section.url.includes('/guides/') || section.url.includes('/academy/')) {
        score += 30;
      }
      // Boost step-by-step content
      if (contentLower.match(/step\s+\d+|getting\s+started|how\s+to|tutorial|guide/gi)) {
        score += 25;
      }
    } else if (queryType === 'troubleshooting') {
      // Boost troubleshooting sections
      if (contentLower.match(/troubleshoot|common\s+errors|debugging|solution|fix/gi)) {
        score += 25;
      }
    } else if (queryType === 'feature-check') {
      // Boost feature lists and capability descriptions
      if (contentLower.match(/features|capabilities|supports|compatible|includes/gi)) {
        score += 20;
      }
    } else if (queryType === 'comparison') {
      // Boost comparison content
      if (contentLower.match(/comparison|difference|versus|compared\s+to|unlike/gi)) {
        score += 20;
      }
    } else if (queryType === 'requirements') {
      // Heavily boost requirements documentation
      if (titleLower.includes('requirements') || titleLower.includes('specifications')) {
        score += 60;
      }
      if (section.url.includes('requirements') || section.url.includes('specifications')) {
        score += 40;
      }
      // Boost content with requirement details
      if (contentLower.match(/\b(cpu|ram|memory|storage|disk|ssd|hdd|operating system|os|ubuntu|macos|windows):/gi)) {
        score += 35;
      }
    } else if (queryType === 'faucet') {
      // For faucet queries, slightly reduce doc priority since Toolbox is preferred
      // But still include faucet-related documentation
      if (titleLower.includes('faucet') || contentLower.includes('faucet')) {
        score += 30;
      }
      if (contentLower.match(/test.*tokens?|fuji.*avax|testnet.*fund/gi)) {
        score += 20;
      }
    }
    
    // Special boost for fundamental/reference documentation
    if (queryLower.match(/requirement|specification|minimum|hardware|system/)) {
      // Boost system requirements and specification pages
      if (section.url.includes('/system-requirements') || 
          section.url.includes('/specifications') ||
          section.url.includes('/requirements') ||
          titleLower.includes('requirements') ||
          titleLower.includes('specifications')) {
        score += 50;
      }
      
      // Boost content that contains requirement tables or lists
      if (contentLower.match(/cpu:|ram:|memory:|storage:|disk:|operating system:|os:/gi)) {
        score += 30;
      }
    }
    
    // Boost node-specific documentation when asking about nodes
    if (queryLower.includes('node')) {
      if (section.url.includes('/nodes/') || titleLower.includes('node')) {
        score += 25;
      }
    }
    
    // Split content into paragraphs for better context matching
    const paragraphs = contentLower.split('\n\n');
    
    // Calculate word relevance scores
    words.forEach(word => {
      const isImportant = importantKeywords.has(word);
      const wordWeight = isImportant ? 2 : 1;
      
      // Title matches are weighted heavily
      if (titleLower.includes(word)) {
        score += 15 * wordWeight;
      }
      
      // Check if word appears in headers (lines starting with #)
      const headerMatches = section.content.match(new RegExp(`^#+.*${word}.*$`, 'gmi'));
      if (headerMatches) {
        score += 8 * wordWeight * headerMatches.length;
      }
      
      // Content matches with proximity bonus
      const contentMatches = (contentLower.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
      score += Math.min(contentMatches * wordWeight, 50); // Cap to prevent spam matches
      
      // Bonus for words appearing close together in paragraphs
      paragraphs.forEach(paragraph => {
        if (paragraph.includes(word)) {
          const wordsInParagraph = words.filter(w => paragraph.includes(w)).length;
          if (wordsInParagraph > 1) {
            score += wordsInParagraph * 3;
          }
        }
      });
    });
    
    // Boost score for exact phrase matches
    if (contentLower.includes(queryLower)) {
      score += 40;
    }
    
    // Special boost for integration pages when asking about specific tools/services
    if (section.url.startsWith('/integrations/')) {
      // Always give integrations a base boost since they're often very relevant
      score += 15;
      
      if (mainSubject && (titleLower.includes(mainSubject) || contentLower.includes(mainSubject))) {
        score += 30;
      }
      
      // Boost integrations for common use cases
      const integrationKeywords = ['deploy', 'build', 'monitor', 'analyze', 'bridge', 'oracle', 'indexer', 'api', 'sdk', 'wallet', 'explorer', 'node', 'rpc'];
      integrationKeywords.forEach(keyword => {
        if (queryLower.includes(keyword) && contentLower.includes(keyword)) {
          score += 10;
        }
      });
    }
    
    // Boost for beginner-friendly content
    const beginnerTerms = ['getting started', 'introduction', 'basics', 'tutorial', 'quick start', 'first', 'simple', 'overview', 'beginner'];
    beginnerTerms.forEach(term => {
      if (contentLower.includes(term)) score += 5;
    });
    
    // Boost for code examples
    if (section.content.includes('```')) {
      score += 10;
    }
    
    // Penalty for very technical/advanced content (unless specifically asked for)
    if (!queryLower.includes('advanced') && !queryLower.includes('deep')) {
      const advancedTerms = ['advanced', 'expert', 'deep dive', 'internals', 'architecture'];
      advancedTerms.forEach(term => {
        if (contentLower.includes(term)) score -= 5;
      });
    }
    
    // Boost recent/updated content (if mentioned)
    if (contentLower.match(/updated|recent|latest|new\s+in/gi)) {
      score += 5;
    }
    
    return { ...section, score };
  });
  
  // Return top 10 most relevant sections, but ensure minimum score threshold
  const filtered = scored.filter(s => s.score > 5); // Increased minimum score threshold
  
  // If we have many high-scoring results, be more selective
  if (filtered.length > 20) {
    const topScore = filtered[0]?.score || 0;
    // Keep only results that are at least 20% of the top score
    return filtered
      .filter(s => s.score >= topScore * 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
  
  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// Define Toolbox tools structure for the AI
const TOOLBOX_TOOLS = {
  'Create L1': {
    description: 'Tools for creating and managing Avalanche L1 blockchains',
    tools: [
      { name: 'Create Chain', id: 'createChain', description: 'Create a new L1 blockchain' },
      { name: 'Node Setup with Docker', id: 'avalanchegoDockerL1', description: 'Set up an Avalanche node for your L1 using Docker' },
      { name: 'Convert Subnet to L1', id: 'convertToL1', description: 'Convert an existing subnet to an L1' },
      { name: 'Self-Hosted Explorer', id: 'selfHostedExplorer', description: 'Deploy your own blockchain explorer' }
    ]
  },
  'Validator Manager': {
    description: 'Tools for managing validators on your L1',
    tools: [
      { name: 'Deploy Proxy Contract', id: 'deployProxyContract', description: 'Deploy upgradeable proxy for validator management' },
      { name: 'Deploy Validator Manager', id: 'deployValidatorManager', description: 'Deploy the main validator manager contract' },
      { name: 'Initialize Validator Set', id: 'initValidatorSet', description: 'Set up initial validators for your L1' },
      { name: 'Add L1 Validator', id: 'addValidator', description: 'Add new validators to your L1' },
      { name: 'Query L1 Validator Set', id: 'queryL1ValidatorSet', description: 'Check current validators and their status' }
    ]
  },
  'Interchain Messaging': {
    description: 'Tools for cross-chain communication between L1s',
    tools: [
      { name: 'Deploy Teleporter Messenger', id: 'teleporterMessenger', description: 'Deploy cross-chain messaging infrastructure' },
      { name: 'ICM Relayer Setup', id: 'icmRelayer', description: 'Set up relayer for message passing' },
      { name: 'Send ICM Message', id: 'sendICMMessage', description: 'Send messages between chains' }
    ]
  },
  'Interchain Token Transfer': {
    description: 'Tools for bridging tokens between L1s',
    tools: [
      { name: 'Deploy Example ERC20', id: 'deployExampleERC20', description: 'Deploy a test ERC20 token' },
      { name: 'Deploy Token Home', id: 'deployTokenHome', description: 'Deploy home contract for token bridging' },
      { name: 'Deploy Token Remote', id: 'deployERC20TokenRemote', description: 'Deploy remote contract on destination chain' },
      { name: 'Test Sending Tokens', id: 'testSend', description: 'Test cross-chain token transfers' }
    ]
  },
  'Utils': {
    description: 'Utility tools for development',
    tools: [
      { name: 'Faucet', id: 'faucet', description: 'Get testnet / test AVAX tokens for development on Fuji network' },
      { name: 'RPC Methods Check', id: 'rpcMethodsCheck', description: 'Verify RPC endpoint functionality' },
      { name: 'AVAX Unit Converter', id: 'unitConverter', description: 'Convert between AVAX units' }
    ]
  },
  'Primary Network': {
    description: 'Tools for working with the Avalanche Primary Network',
    tools: [
      { name: 'Primary Network Node Setup with Docker', id: 'avalanchegoDockerPrimaryNetwork', description: 'Set up a Docker container running a validator or RPC node for the Avalanche Primary Network (P-Chain, X-Chain, and C-Chain)' },
      { name: 'Cross-Chain Transfer', id: 'crossChainTransfer', description: 'Transfer AVAX between P-Chain, X-Chain, and C-Chain on the Primary Network' }
    ]
  }
};

export async function POST(req: Request) {
  const { messages, model = 'anthropic' } = await req.json();
  
  // Get the last user message to search for relevant docs
  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
  
  // Get valid URLs for validation
  const validUrls = await getValidUrls();
  
  let relevantContext = '';
  if (lastUserMessage) {
    const sections = await loadLLMsContent();
    console.log(`Total sections loaded: ${sections.length}`);
    
    const relevantSections = searchContent(lastUserMessage.content, sections);
    console.log(`Query: "${lastUserMessage.content}"`);
    console.log(`Found ${relevantSections.length} relevant sections`);
    if (relevantSections.length > 0) {
      console.log('Top 3 results:');
      relevantSections.slice(0, 3).forEach((section, i) => {
        console.log(`  ${i + 1}. ${section.title} (score: ${section.score})`);
      });
    }
    
    if (relevantSections.length > 0) {
      relevantContext = '\n\n=== AVAILABLE DOCUMENTATION CONTEXT ===\n';
      relevantContext += 'The following information is from the official Avalanche documentation:\n\n';
      
      relevantSections.forEach((section, index) => {
        const fullUrl = `https://build.avax.network${section.url}`;
        relevantContext += `--- Document ${index + 1} ---\n`;
        relevantContext += `Title: ${section.title}\n`;
        relevantContext += `Source URL: ${fullUrl}\n`;
        relevantContext += `Relevance Score: ${section.score}\n`;
        relevantContext += `Content:\n`;
        
        // Significantly increase content length for better context
        const contentLength = 3000; // Doubled from 1500
        const fullContent = section.content;
        
        if (fullContent.length > contentLength) {
          const truncatedContent = fullContent.substring(0, contentLength);
          // Try to cut at a natural break (paragraph or sentence)
          const lastParagraph = truncatedContent.lastIndexOf('\n\n');
          const lastSentence = truncatedContent.lastIndexOf('. ');
          const lastCodeBlock = truncatedContent.lastIndexOf('```');
          
          let cutPoint = contentLength;
          // Prefer paragraph breaks
          if (lastParagraph > contentLength * 0.8) {
            cutPoint = lastParagraph;
          } 
          // But avoid cutting in the middle of a code block
          else if (lastCodeBlock > contentLength * 0.7) {
            // Check if we're in the middle of a code block
            const codeBlockEnd = truncatedContent.indexOf('```', lastCodeBlock + 3);
            if (codeBlockEnd === -1) {
              // We're in a code block, try to cut before it
              cutPoint = lastCodeBlock;
            }
          }
          // Otherwise try sentence breaks
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
      
      // Add a summary of what was found
      relevantContext += '=== SEARCH SUMMARY ===\n';
      relevantContext += `Found ${relevantSections.length} relevant documents for your query.\n`;
      if (relevantSections.length > 5) {
        relevantContext += `Showing the top ${Math.min(relevantSections.length, 10)} most relevant results.\n`;
        relevantContext += 'Additional related documents:\n';
        relevantSections.slice(5, 10).forEach((section) => {
          relevantContext += `- ${section.title}: https://build.avax.network${section.url}\n`;
        });
      }
      relevantContext += '=== END OF DOCUMENTATION CONTEXT ===\n';
    } else {
      relevantContext = '\n\n=== DOCUMENTATION CONTEXT ===\n';
      relevantContext += 'No specific documentation sections were found for this query in the indexed content.\n';
      relevantContext += 'However, you should still try to help the user by:\n';
      relevantContext += '1. Checking if any Toolbox tools can help with their task\n';
      relevantContext += '2. Providing general guidance while noting it\'s not from specific Avalanche docs\n';
      relevantContext += '3. Suggesting relevant documentation sections they might want to explore\n';
      relevantContext += '=== END OF DOCUMENTATION CONTEXT ===\n';
    }
  }

  // Select the appropriate model based on the request
  const selectedModel = model === 'openai' 
    ? openai('gpt-4o-mini')
    : anthropic('claude-3-5-sonnet-20241022');

  const result = streamText({
    model: selectedModel,
    messages: messages,
    onFinish: async ({ text }) => {
      // Log any URLs that were generated
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
    system: `You are a friendly and patient AI assistant for the Avalanche Builders Hub, specifically designed to help beginner developers. 
    
    TOOLBOX & INTEGRATIONS - Recommendations with Toolbox Preference
    
    The Avalanche ecosystem offers two main types of solutions:
    1. **Toolbox** (https://build.avax.network/tools/l1-toolbox) - Interactive tools for common tasks (preferred for simplicity)
    2. **Integrations** (https://build.avax.network/integrations) - Third-party services and tools (great for advanced features)
    
    When answering questions:
    - Check Toolbox first - if there's a relevant tool, it's often the easiest starting point
    - Consider integrations for more complex or specialized needs
    - Don't force recommendations - only suggest when genuinely relevant
    - Present options naturally, with Toolbox slightly emphasized when both are available
    
    Available Toolbox Tools (ALWAYS link to specific tools, not just the toolbox page):
    ${Object.entries(TOOLBOX_TOOLS).map(([category, info]) => 
      `\n    **${category}**: ${info.description}
    ${info.tools.map(tool => `    - ${tool.name}: ${tool.description} → Link: https://build.avax.network/tools/l1-toolbox#${tool.id}`).join('\n')}`
    ).join('\n')}
    
    CRITICAL: When recommending a Toolbox tool, ALWAYS use the specific tool link like:
    [Tool Name](https://build.avax.network/tools/l1-toolbox#toolId)
    NEVER just link to https://build.avax.network/tools/l1-toolbox without the #toolId
    
    FAUCET PRIORITY:
    When users ask about getting test tokens, testnet AVAX, or Fuji tokens:
    - The Toolbox Faucet is a great option: https://build.avax.network/tools/l1-toolbox#faucet
    - Also mention alternatives like [Core faucet](https://core.app/tools/testnet-faucet)
    
    DOCUMENTATION GUIDELINES:
    - When documentation context is provided below, prioritize that information
    - Always cite documentation sources when using them
    - If the provided documentation partially answers a question, use it and note what aspects aren't covered
    - For basic programming concepts (like "what is an API"), you can provide general explanations
    - For Avalanche-specific information, rely on the documentation provided
    - The relevance score indicates how well each document matches the query - higher scores mean better matches
    - Use multiple documents when they provide complementary information
    - If you see code examples in the documentation, include them in your response
    - When multiple related documents are found, synthesize the information to provide a comprehensive answer
    
    SMART RESOURCE RECOMMENDATIONS:
    Match resources to the user's needs and question complexity:
    
    For SIMPLE/QUICK questions (e.g., "How to get test tokens?"):
    - Lead with Toolbox tool or direct solution
    - Maybe add one doc link for reference
    
    For LEARNING questions (e.g., "Explain how L1s work"):
    - Include Academy course for structured learning
    - Add relevant documentation
    - Mention Toolbox tools for practice
    
    For IMPLEMENTATION questions (e.g., "Building a DeFi app"):
    - Start with relevant docs/guides
    - Include Toolbox for testing
    - Suggest integrations for production
    
    Be natural - not every answer needs all resource types!
    
    When to recommend integrations:
    - User asks about monitoring, analytics, or observability → Suggest relevant monitoring integrations
    - User needs node infrastructure → Recommend node-as-a-service providers
    - User wants to build DeFi → Point to DeFi protocol integrations
    - User needs indexing → Suggest indexer integrations
    - User asks about security → Recommend audit/security integrations
    
    Common integration categories:
    - **Infrastructure**: Node providers (Infura, QuickNode), API services
    - **Development**: SDKs, frameworks, development environments
    - **Analytics**: Block explorers, monitoring dashboards, data indexers
    - **DeFi**: DEXs, lending protocols, bridges
    - **Security**: Audit services, monitoring tools
    - **Wallets**: Wallet integrations and connectors
    
    Always check the documentation context for specific integrations mentioned!
    
    Your communication style:
    - Use simple, clear language and avoid technical jargon unless necessary
    - When you must use technical terms, explain them in plain English
    - Break down complex concepts into smaller, digestible steps
    - Be encouraging and supportive - remember everyone starts somewhere!
    
    When answering questions:
    1. Check the provided documentation context for relevant information
    2. Look for relevant Toolbox tools first (they're often the quickest solution)
    3. Consider integrations for advanced features or when Toolbox doesn't cover the need
    4. Provide relevant resources based on the user's needs:
       - For complex topics or beginners → Include Academy courses
       - For technical details → Include documentation
       - For hands-on tasks → Prioritize Toolbox tools
       - For production needs → Suggest integrations
    5. Present multiple approaches when appropriate, with Toolbox mentioned first if applicable
    6. For general programming concepts, you can provide explanations
    7. Always be clear about what information comes from Avalanche docs vs general knowledge
    8. Focus on solving the user's problem with appropriate resources
    
    FOLLOW-UP QUESTIONS:
    At the end of EVERY response, you MUST include exactly 3 relevant follow-up questions that would help the user dive deeper into the topic or explore related concepts. These should be natural progressions from your answer.
    
    IMPORTANT: Follow-up questions MUST be based on:
    1. Documentation sections you know exist (from the provided context or the valid sections listed above)
    2. Toolbox tools that are actually available (when relevant to the topic)
    3. Specific features or concepts mentioned in the documentation context
    
    DO NOT suggest questions about topics that aren't covered in the documentation or tools that don't exist.
    DO NOT include any markdown links in the follow-up questions - keep them as plain text questions only.
    
    Format these questions EXACTLY like this at the very end of your response:
    
    ---FOLLOW-UP-QUESTIONS---
    1. [First follow-up question without any links]
    2. [Second follow-up question without any links]
    3. [Third follow-up question without any links]
    ---END-FOLLOW-UP-QUESTIONS---
    
    Make sure the follow-up questions are:
    - Directly related to what you just explained
    - Based on actual documentation or tools available
    - Progressive (building on the current topic, not jumping to unrelated areas)
    - Helpful for someone learning about the topic
    - Specific enough to be actionable
    - Plain text only (no markdown formatting or links)
    
    Example responses matching resources to needs (note the specific tool links):
    
    Simple question - "How do I get test tokens?":
    - "The quickest way is using the [Faucet tool](https://build.avax.network/tools/l1-toolbox#faucet) in the Toolbox. Just paste your address and get instant test AVAX! Alternative: [Core faucet](https://core.app/tools/testnet-faucet)."
    
    Learning question - "Can you explain how cross-chain messaging works?":
    - "Cross-chain messaging allows different blockchains to communicate. For a comprehensive understanding, check out the [Interchain Messaging course](https://build.avax.network/academy/interchain-messaging) in Academy. You can also explore the [cross-chain documentation](https://build.avax.network/docs/cross-chain) for technical details, and try it hands-on with the [Deploy Teleporter Messenger](https://build.avax.network/tools/l1-toolbox#teleporterMessenger)."
    
    Implementation question - "I want to create and manage validators":
    - "To set up validators, start by using the [Deploy Validator Manager](https://build.avax.network/tools/l1-toolbox#deployValidatorManager) tool. Then use [Initialize Validator Set](https://build.avax.network/tools/l1-toolbox#initValidatorSet) to configure your initial validators. You can check their status anytime with [Query L1 Validator Set](https://build.avax.network/tools/l1-toolbox#queryL1ValidatorSet)."
    
    Base URLs for resources:
    - Toolbox: https://build.avax.network/tools/l1-toolbox
    - Documentation: https://build.avax.network/docs
    - Academy (great for beginners!): https://build.avax.network/academy
    - Guides (step-by-step tutorials): https://build.avax.network/guides
    - Integrations: https://build.avax.network/integrations
    
    VERIFIED SAFE URLs - You can ALWAYS use these exact URLs:
    
    Documentation Sections:
    - Documentation Home: https://build.avax.network/docs
    - Quick Start: https://build.avax.network/docs/quick-start
    - L1 Blockchains: https://build.avax.network/docs/avalanche-l1s
    - Cross-Chain: https://build.avax.network/docs/cross-chain
    - DApps: https://build.avax.network/docs/dapps
    - Nodes: https://build.avax.network/docs/nodes
    - Virtual Machines: https://build.avax.network/docs/virtual-machines
    - API Reference: https://build.avax.network/docs/api-reference
    - Tooling: https://build.avax.network/docs/tooling
    
    Academy Courses:
    - Academy Home: https://build.avax.network/academy
    - Avalanche Fundamentals: https://build.avax.network/academy/avalanche-fundamentals
    - Blockchain Fundamentals: https://build.avax.network/academy/blockchain-fundamentals
    - Multi-Chain Architecture: https://build.avax.network/academy/multi-chain-architecture
    - Interchain Messaging: https://build.avax.network/academy/interchain-messaging
    - Interchain Token Transfer: https://build.avax.network/academy/interchain-token-transfer
    - Customizing EVM: https://build.avax.network/academy/customizing-evm
    - L1 Validator Management: https://build.avax.network/academy/l1-validator-management
    
    Other Sections:
    - Guides: https://build.avax.network/guides
    - Integrations: https://build.avax.network/integrations
    - Toolbox: https://build.avax.network/tools/l1-toolbox
    
    IMPORTANT: For any URLs not in this list, ONLY use URLs that appear in the documentation context "Source URL:" fields
    
    When providing links - CRITICAL RULES TO PREVENT 404s:
    - For specific pages: ONLY use URLs from "Source URL:" in the documentation context
    - For general topics: ONLY use the VERIFIED SAFE URLs listed above
    - NEVER combine or construct URLs (e.g., don't create /docs/nodes/system-requirements)
    - NEVER guess at URL paths
    - When in doubt, use the section root (e.g., /docs/nodes instead of a specific subpage)
    - If documentation mentions a topic but doesn't provide the URL, link to the section root
    
    ${relevantContext}
    
    Important reminders:
    - Always format links as markdown: [Link Text](URL)
    - TOOLBOX LINKS MUST BE SPECIFIC: Always use #toolId (e.g., #faucet, #createChain, #deployValidatorManager)
    - Match your resource recommendations to the question:
      * Quick task? → Specific Toolbox tool + maybe a doc link
      * Learning request? → Academy + docs + practice tools
      * Building something? → Docs + Toolbox + relevant integrations
    - Give slight preference to Toolbox tools when they solve the problem
    - Don't oversell - present options naturally
    - Toolbox is great for: quick tasks, visual interfaces, common operations
    - Integrations excel at: monitoring, infrastructure, specialized features
    - Use code blocks with syntax highlighting when appropriate
    - Cite sources when using documentation
    - Be helpful even when documentation is incomplete
    - Guide users to additional resources when needed
    - ALWAYS include the follow-up questions section at the end of EVERY response
    - Quality over quantity - 2-3 highly relevant links beats 5+ loosely related ones
    
    Additional Resources to mention when relevant:
    - GitHub: https://github.com/ava-labs
    - Discord Community: https://discord.gg/avalanche
    - Developer Forum: https://forum.avax.network
    - Avalanche Explorer: https://subnets.avax.network
    
    When generating follow-up questions:
    - Reference specific documentation sections when relevant
    - Include questions about relevant integrations if they would help
    - Build on concepts from the provided documentation context
    - If the documentation context mentions related topics, ask about those
    - Always ensure the question can be answered using available resources
    - Balance questions between docs, tools, and integrations
    
    Good patterns for follow-up questions:
    - "What integrations are available for [specific use case like monitoring/indexing]?"
    - "How do the [specific integration] features compare to doing it manually?"
    - "What does the [Doc Section] guide say about [specific feature]?"
    - "Can you explain [concept mentioned in docs] in more detail?"
    - "Which approach would be best for my use case: manual, Toolbox, or an integration?"
    - "What are the pros and cons of using [integration] versus building it myself?"
    
    NEVER ask about:
    - Features or tools that don't exist in the documentation
    - Generic questions that can't be answered with available resources
    - Topics completely unrelated to the current discussion
    - Advanced features unless they're specifically documented
    
    URL GENERATION RULES - CRITICAL:
    1. ONLY use URLs that appear in the documentation context provided
    2. NEVER construct or guess URLs - only use exact URLs from the context
    3. If you need to link to a general section, use ONLY these verified base URLs:
       - https://build.avax.network/docs
       - https://build.avax.network/academy  
       - https://build.avax.network/guides
       - https://build.avax.network/integrations
       - https://build.avax.network/tools/l1-toolbox
    4. For specific pages, ONLY use URLs that appear in "Source URL:" lines in the documentation context
    5. If you're not sure about a specific URL, link to the section root instead
    6. NEVER create URLs by combining paths - this leads to 404 errors`,
  });

  return result.toDataStreamResponse();
}
