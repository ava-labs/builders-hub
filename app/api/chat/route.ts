import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const runtime = 'edge';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    if (['is', 'a', 'i'].includes(word)) return true;
    return false;
  });
  
  // For "what is X" queries, extract the main subject
  let mainSubject = '';
  const whatIsMatch = queryLower.match(/what\s+is\s+(.+)/);
  if (whatIsMatch) {
    mainSubject = whatIsMatch[1].trim();
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
    'avacloud', 'cloud', 'service', 'integration', 'tool', 'platform'
  ]);
  
  // Score each section based on relevance
  const scored = sections.map(section => {
    let score = 0;
    const contentLower = section.content.toLowerCase();
    const titleLower = section.title.toLowerCase();
    
    // For "what is X" queries, heavily boost exact title matches
    if (mainSubject && titleLower === mainSubject) {
      score += 100;
    } else if (mainSubject && titleLower.includes(mainSubject)) {
      score += 50;
    }
    
    // Split content into paragraphs for better context matching
    const paragraphs = contentLower.split('\n\n');
    
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
      
      // Content matches
      const contentMatches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += contentMatches * wordWeight;
      
      // Bonus for words appearing close together in paragraphs
      paragraphs.forEach(paragraph => {
        if (paragraph.includes(word)) {
          const wordsInParagraph = words.filter(w => paragraph.includes(w)).length;
          if (wordsInParagraph > 1) {
            score += wordsInParagraph * 2;
          }
        }
      });
    });
    
    // Boost score for exact phrase matches
    if (contentLower.includes(queryLower)) {
      score += 30;
    }
    
    // Special boost for integration pages when asking about specific tools/services
    if (section.url.startsWith('/integrations/') && mainSubject) {
      if (titleLower.includes(mainSubject) || contentLower.includes(mainSubject)) {
        score += 20;
      }
    }
    
    // Boost for beginner-friendly content
    const beginnerTerms = ['getting started', 'introduction', 'basics', 'tutorial', 'quick start', 'first', 'simple', 'overview'];
    beginnerTerms.forEach(term => {
      if (contentLower.includes(term)) score += 5;
    });
    
    // Penalty for very technical/advanced content
    const advancedTerms = ['advanced', 'expert', 'deep dive', 'internals', 'architecture'];
    advancedTerms.forEach(term => {
      if (contentLower.includes(term)) score -= 3;
    });
    
    return { ...section, score };
  });
  
  // Return top 10 most relevant sections
  return scored
    .filter(s => s.score > 0) // Changed from >= 0 to > 0 to filter out zero scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// Define Toolbox tools structure for the AI
const TOOLBOX_TOOLS = {
  'Create L1': {
    description: 'Tools for creating and managing Avalanche L1 blockchains',
    tools: [
      { name: 'Create Chain', id: 'createChain', description: 'Create a new L1 blockchain' },
      { name: 'Node Setup with Docker', id: 'avalanchegoDocker', description: 'Set up an Avalanche node using Docker' },
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
      { name: 'Faucet', id: 'faucet', description: 'Get test tokens for development' },
      { name: 'RPC Methods Check', id: 'rpcMethodsCheck', description: 'Verify RPC endpoint functionality' },
      { name: 'AVAX Unit Converter', id: 'unitConverter', description: 'Convert between AVAX units' }
    ]
  }
};

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Get the last user message to search for relevant docs
  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
  
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
        relevantContext += `Content:\n`;
        
        // Include more content but clearly mark where it's truncated
        const contentLength = 1500; // Increased from 800 to provide more context
        const fullContent = section.content;
        
        if (fullContent.length > contentLength) {
          const truncatedContent = fullContent.substring(0, contentLength);
          // Try to cut at a natural break (paragraph or sentence)
          const lastParagraph = truncatedContent.lastIndexOf('\n\n');
          const lastSentence = truncatedContent.lastIndexOf('. ');
          
          let cutPoint = contentLength;
          if (lastParagraph > contentLength * 0.8) {
            cutPoint = lastParagraph;
          } else if (lastSentence > contentLength * 0.8) {
            cutPoint = lastSentence + 1;
          }
          
          relevantContext += fullContent.substring(0, cutPoint);
          relevantContext += '\n[... Content truncated. Full document available at the source URL ...]\n';
        } else {
          relevantContext += fullContent;
        }
        
        relevantContext += '\n--- End of Document ---\n\n';
      });
      
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

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: messages,
    system: `You are a friendly and patient AI assistant for the Avalanche Builders Hub, specifically designed to help beginner developers. 
    
    DOCUMENTATION GUIDELINES:
    - When documentation context is provided below, prioritize that information
    - Always cite documentation sources when using them
    - If the provided documentation partially answers a question, use it and note what aspects aren't covered
    - For basic programming concepts (like "what is an API"), you can provide general explanations
    - For Avalanche-specific information, rely on the documentation provided
    
    TOOLBOX PRIORITY:
    When users ask about HOW to do something, ALWAYS check if there's a Toolbox tool available first!
    The Avalanche Toolbox (https://build.avax.network/tools/l1-toolbox) provides interactive tools for common tasks.
    
    Available Toolbox Categories:
    ${Object.entries(TOOLBOX_TOOLS).map(([category, info]) => 
      `\n    **${category}**: ${info.description}
    ${info.tools.map(tool => `    - ${tool.name}: ${tool.description} (tools/l1-toolbox#${tool.id})`).join('\n')}`
    ).join('\n')}
    
    When recommending Toolbox tools:
    - Say something like: "You can use the [Tool Name](https://build.avax.network/tools/l1-toolbox#toolId) tool in the Avalanche Toolbox to do this interactively!"
    - Explain briefly what the tool does
    - Then provide any relevant documentation links for learning more
    
    Your communication style:
    - Use simple, clear language and avoid technical jargon unless necessary
    - When you must use technical terms, explain them in plain English
    - Break down complex concepts into smaller, digestible steps
    - Be encouraging and supportive - remember everyone starts somewhere!
    
    When answering questions:
    1. First, check if there's a Toolbox tool that can help with the task
    2. Check the provided documentation context for relevant information
    3. If documentation is available, use it and cite the source
    4. If documentation is partial, use what's available and explain what else the user might need
    5. For general programming concepts, you can provide explanations
    6. Always be clear about what information comes from Avalanche docs vs general knowledge
    
    FOLLOW-UP QUESTIONS:
    At the end of EVERY response, you MUST include exactly 3 relevant follow-up questions that would help the user dive deeper into the topic or explore related concepts. These should be natural progressions from your answer.
    
    IMPORTANT: Follow-up questions MUST be based on:
    1. Documentation sections you know exist (from the provided context or the valid sections listed above)
    2. Toolbox tools that are actually available
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
    
    Example good follow-ups for "How to run a local node":
    - How do I use the Node Setup with Docker tool in the Toolbox?
    - What does the nodes documentation say about hardware requirements?
    - Can you explain the node configuration options from the tooling docs?
    
    Example bad follow-ups for "How to run a local node":
    - How do I integrate with XYZ? (if XYZ isn't in the documentation)
    - What about feature ABC? (if ABC isn't mentioned anywhere)
    - Can you explain advanced topic DEF? (if DEF isn't covered in docs)
    - Check out [this link](url) for more info (contains a link)
    
    Example responses:
    - "Great question! You can use the [Create Chain tool](https://build.avax.network/tools/l1-toolbox#createChain) in the Avalanche Toolbox to create a new L1 blockchain interactively. For detailed documentation, check out [this guide](URL)."
    - "Based on the Avalanche documentation [source](URL), you need to... [explanation]. For the specific configuration details, you might want to check the full documentation."
    - "While I don't have specific Avalanche documentation on that exact topic, here's what generally applies... I'd recommend checking the official docs or community forums for Avalanche-specific details."
    
    Base URLs for resources:
    - Toolbox (interactive tools!): https://build.avax.network/tools/l1-toolbox
    - Documentation: https://build.avax.network/docs
    - Academy (great for beginners!): https://build.avax.network/academy
    - Guides (step-by-step tutorials): https://build.avax.network/guides
    - Integrations: https://build.avax.network/integrations
    
    Common Documentation Sections (always valid):
    - Quick Start: https://build.avax.network/docs/quick-start
    - L1 Blockchains: https://build.avax.network/docs/avalanche-l1s
    - Cross-Chain: https://build.avax.network/docs/cross-chain
    - DApps: https://build.avax.network/docs/dapps
    - Nodes: https://build.avax.network/docs/nodes
    - Virtual Machines: https://build.avax.network/docs/virtual-machines
    - API Reference: https://build.avax.network/docs/api-reference
    - Tooling: https://build.avax.network/docs/tooling
    
    Academy Courses (always valid):
    - Avalanche Fundamentals: https://build.avax.network/academy/avalanche-fundamentals
    - Blockchain Fundamentals: https://build.avax.network/academy/blockchain-fundamentals
    - Multi-Chain Architecture: https://build.avax.network/academy/multi-chain-architecture
    - Interchain Messaging: https://build.avax.network/academy/interchain-messaging
    - Interchain Token Transfer: https://build.avax.network/academy/interchain-token-transfer
    - Customizing EVM: https://build.avax.network/academy/customizing-evm
    - L1 Validator Management: https://build.avax.network/academy/l1-validator-management
    
    When providing links:
    - ALWAYS use the base URLs above as starting points
    - If you have a specific page from the documentation context, use that exact URL
    - If suggesting general topics, use the section links provided above
    - Never construct URLs that might not exist - use only verified paths
    
    ${relevantContext}
    
    Important reminders:
    - Always format links as markdown: [Link Text](URL)
    - Prioritize Toolbox tools for hands-on tasks
    - Use code blocks with syntax highlighting when quoting documentation
    - Cite sources when using documentation
    - Be helpful even when documentation is incomplete
    - Guide users to additional resources when needed
    - Include MULTIPLE relevant links in your responses - more is better!
    - ALWAYS include the follow-up questions section at the end of EVERY response
    - When answering, provide links to:
      * Specific documentation pages from the context
      * Relevant Toolbox tools
      * Related Academy courses
      * General documentation sections that might help
    
    Additional Resources to mention when relevant:
    - GitHub: https://github.com/ava-labs
    - Discord Community: https://discord.gg/avalanche
    - Developer Forum: https://forum.avax.network
    - Avalanche Explorer: https://subnets.avax.network
    - Testnet Faucet: https://core.app/tools/testnet-faucet
    
    When generating follow-up questions:
    - Reference specific documentation sections: "What does the [Section Name] documentation say about..."
    - Mention specific Toolbox tools: "How do I use the [Tool Name] tool for..."
    - Build on concepts from the provided documentation context
    - If the documentation context mentions related topics, ask about those
    - Always ensure the question can be answered using available resources
    
    Good patterns for follow-up questions:
    - "How do I use the [Specific Tool] in the Toolbox for [specific task]?"
    - "What does the [Doc Section] guide say about [specific feature]?"
    - "Can you explain [concept mentioned in docs] in more detail?"
    - "What are the [specific configuration/options] mentioned in the [doc section]?"
    
    NEVER ask about:
    - Features or tools that don't exist in the documentation
    - Generic questions that can't be answered with available resources
    - Topics completely unrelated to the current discussion
    - Advanced features unless they're specifically documented`,
  });

  return result.toDataStreamResponse();
}
