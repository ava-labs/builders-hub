import lunr from 'lunr';

// Cache for sections and Lunr index
let sectionsCache: Array<{ id: string; title: string; url: string; content: string; headings: string[] }> | null = null;
let lunrIndex: lunr.Index | null = null;
let sectionsCacheTimestamp: number = 0;
const SECTIONS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function loadLLMsContent() {
  const now = Date.now();
  
  // Return cached sections if still valid
  if (sectionsCache && lunrIndex && (now - sectionsCacheTimestamp) < SECTIONS_CACHE_DURATION) {
    return sectionsCache;
  }
  
  try {
    const response = await fetch(new URL('/llms.txt', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
    const llmsContent = await response.text();
    
    // Parse the content into sections
    const sections = llmsContent.split('\n\n').filter(section => section.trim());
    
    const contentSections = sections.map((section, idx) => {
      const lines = section.split('\n');
      const titleLine = lines.find(line => line.startsWith('# '));
      const urlLine = lines.find(line => line.startsWith('URL: '));
      const headings = lines
        .filter(line => line.startsWith('##'))
        .map(line => line.replace(/^##+\s*/, ''));
      
      return {
        id: idx.toString(), // Add ID for Lunr
        title: titleLine ? titleLine.replace('# ', '') : '',
        url: urlLine ? urlLine.replace('URL: ', '') : '',
        content: section,
        headings,
      };
    }).filter(s => s.title && s.url);
    
    // Build Lunr index
    const index = lunr(function(this: lunr.Builder) {
      this.ref('id');
      this.field('title', { boost: 15 });
      this.field('headings', { boost: 10 });
      this.field('content', { boost: 5 });
      this.field('url', { boost: 2 });
      
      // Custom token processor for synonyms
      const synonymExpander = function(token: lunr.Token) {
        const synonyms: { [key: string]: string[] } = {
          'l1': ['subnet', 'layer1', 'blockchain'],
          'subnet': ['l1', 'layer1', 'blockchain'],
          'icm': ['interchain', 'messaging', 'teleporter'],
          'ictt': ['interchain', 'token', 'transfer', 'bridge'],
          'avax': ['avalanche', 'token'],
          'avalanche': ['avax'],
          'faucet': ['testnet', 'tokens', 'fuji'],
          'validator': ['node', 'staking'],
          'node': ['validator', 'server'],
          'deploy': ['create', 'launch', 'build'],
          'create': ['deploy', 'make', 'build'],
          'tutorial': ['guide', 'howto', 'example'],
          'guide': ['tutorial', 'documentation'],
          'error': ['issue', 'problem', 'troubleshoot'],
          'bridge': ['transfer', 'cross-chain', 'ictt']
        };
        
        const term = token.toString().toLowerCase();
        
        // Lunr expects a single token to be returned, not an array
        // So we'll just return the original token and handle synonyms differently
        return token;
      };
      
      // Register the function
      lunr.Pipeline.registerFunction(synonymExpander, 'synonymExpander');
      
      // Configure pipeline
      this.pipeline.remove(lunr.stopWordFilter);
      this.pipeline.add(synonymExpander);
      this.pipeline.add(lunr.stemmer);
      
      // Add documents with metadata and expand synonyms at index time
      contentSections.forEach(doc => {
        // Expand content with synonyms for better matching
        const synonyms: { [key: string]: string[] } = {
          'l1': ['subnet', 'layer1', 'blockchain'],
          'subnet': ['l1', 'layer1', 'blockchain'],
          'icm': ['interchain messaging', 'teleporter'],
          'ictt': ['interchain token transfer', 'token bridge'],
          'avax': ['avalanche', 'token'],
          'avalanche': ['avax'],
          'faucet': ['testnet tokens', 'fuji avax'],
          'validator': ['node', 'staking'],
          'node': ['validator', 'server'],
          'deploy': ['create', 'launch', 'build'],
          'create': ['deploy', 'make', 'build'],
          'tutorial': ['guide', 'howto', 'example'],
          'guide': ['tutorial', 'documentation'],
          'error': ['issue', 'problem', 'troubleshoot'],
          'bridge': ['transfer', 'cross-chain', 'ictt']
        };
        
        let expandedContent = doc.content;
        let expandedTitle = doc.title;
        
        // Add synonym terms to content for better matching
        Object.entries(synonyms).forEach(([key, values]) => {
          const regex = new RegExp(`\\b${key}\\b`, 'gi');
          if (expandedContent.match(regex)) {
            expandedContent += ` ${values.join(' ')} `;
          }
          if (expandedTitle.toLowerCase().includes(key)) {
            expandedTitle += ` ${values.join(' ')} `;
          }
        });
        
        const enhancedDoc = {
          ...doc,
          title: expandedTitle,
          content: expandedContent,
          headings: doc.headings.join(' '),
        };
        this.add(enhancedDoc);
      });
    });
    
    sectionsCache = contentSections;
    lunrIndex = index;
    sectionsCacheTimestamp = now;
    
    console.log(`Cached ${contentSections.length} sections and built Lunr index`);
    return contentSections;
  } catch (error) {
    console.error('Error loading llms.txt:', error);
    return [];
  }
}

export async function searchContent(query: string) {
  const sections = await loadLLMsContent();
  if (!lunrIndex) {
    console.error('Lunr index not available');
    return [];
  }
  
  // Advanced query processing
  const queryLower = query.toLowerCase();
  const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'being', 'been', 'and', 'or', 'but', 'if', 'of', 'at', 'by', 'for', 'with', 'about', 'to', 'in', 'on', 'what', 'when', 'where', 'how', 'which', 'who', 'whom', 'why']);
  const allQueryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);
  const filteredQueryTerms = allQueryTerms.filter(t => !stopWords.has(t));
  const queryTerms = filteredQueryTerms.length > 0 ? filteredQueryTerms : allQueryTerms;
  
  // Build sophisticated Lunr query - simplified to avoid field issues
  let lunrQuery = '';
  
  // 1. Individual terms with field-specific boosts
  queryTerms.forEach(term => {
    // Escape special characters that might cause issues
    const escapedTerm = term.replace(/[^\w\s-]/g, '');
    if (escapedTerm.length > 0) {
      // Title field boost
      lunrQuery += `title:${escapedTerm} `;
      lunrQuery += `headings:${escapedTerm} `;
      // Content field
      lunrQuery += `content:${escapedTerm} `;
      // URL field
      lunrQuery += `url:${escapedTerm} `;
      // Wildcards for partial matches
      if (escapedTerm.length > 2) {
        lunrQuery += `${escapedTerm}* `;
      }
    }
  });
  
  // 2. Required terms for important keywords
  const importantTerms = ['deploy', 'create', 'error', 'tutorial', 'guide', 'l1', 'validator', 'icm', 'ictt'];
  queryTerms.forEach(term => {
    const escapedTerm = term.replace(/[^\w\s-]/g, '');
    if (importantTerms.includes(escapedTerm) && escapedTerm.length > 0) {
      lunrQuery += `+${escapedTerm} `;
    }
  });
  
  let lunrResults: lunr.Index.Result[] = [];
  
  try {
    const trimmedQuery = lunrQuery.trim();
    if (trimmedQuery) {
      lunrResults = lunrIndex!.search(trimmedQuery);
    }
  } catch (e) {
    // Fallback to simple query if advanced query fails
    console.warn('Advanced query failed, falling back to simple search:', e);
    try {
      // Try a very simple query with just the terms
      const simpleQuery = queryTerms.filter(t => t.replace(/[^\w\s-]/g, '').length > 0).join(' ');
      if (simpleQuery) {
        lunrResults = lunrIndex!.search(simpleQuery);
      }
    } catch (e2) {
      console.warn('Simple query also failed:', e2);
      lunrResults = [];
    }
  }
  
  // If no results, try individual terms
  if (lunrResults.length === 0) {
    queryTerms.forEach(term => {
      const cleanTerm = term.replace(/[^\w\s-]/g, '');
      if (cleanTerm.length > 1) {
        try {
          const termResults = lunrIndex!.search(cleanTerm);
          lunrResults.push(...termResults);
        } catch (e) {
          console.warn(`Failed to search for term ${cleanTerm}:`, e);
        }
      }
    });
    
    // Deduplicate results
    const seen = new Set<string>();
    lunrResults = lunrResults.filter(r => {
      if (seen.has(r.ref)) return false;
      seen.add(r.ref);
      return true;
    });
  }
  
  // Get all sections if Lunr returns nothing (fallback to custom scoring)
  const candidateSections = lunrResults.length > 0
    ? lunrResults.map((result: lunr.Index.Result) => {
        const section = sections.find(s => s.id === result.ref);
        return section ? { ...section, lunrScore: result.score } : null;
      }).filter(Boolean) as Array<{ id: string; title: string; url: string; content: string; headings: string[]; lunrScore: number }>
    : sections.map(s => ({ ...s, lunrScore: 0 }));
  
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
  
  // Enhanced scoring with more factors
  const scored = candidateSections.map(section => {
    let score = section.lunrScore * 20; // Increased weight for Lunr score
    
    const contentLower = section.content.toLowerCase();
    const titleLower = section.title.toLowerCase();
    const urlLower = section.url.toLowerCase();
    const headingsLower = section.headings.join(' ').toLowerCase();

    // Query terms match in headings
    queryTerms.forEach(term => {
        if (headingsLower.includes(term)) {
            score += 20;
        }
    });
    
    // URL path matching bonus
    queryTerms.forEach(term => {
      if (urlLower.includes(term)) {
        score += 25;
      }
    });
    
    // Title exact match super boost
    if (titleLower === queryLower) {
      score += 300;
    } else if (titleLower.includes(queryLower)) {
      score += 150;
    }
    
    // Check for question patterns in content
    if (queryType === 'definition' && contentLower.match(/what\s+is\s+[a-z0-9]+/gi)) {
      score += 30;
    }
    
    // Code example bonus
    const codeBlocks = (section.content.match(/```/g) || []).length / 2;
    if (codeBlocks > 0) {
      score += Math.min(codeBlocks * 15, 60);
    }
    
    // Recency bonus (if mentioned)
    if (contentLower.match(/\b(2024|2023|recent|latest|new|updated)\b/gi)) {
      score += 20;
    }
    
    // Section-specific bonuses
    if (queryLower.includes('integration') && section.url.startsWith('/integrations/')) {
      score += 100;
    }
    if (queryLower.includes('academy') && section.url.startsWith('/academy/')) {
      score += 100;
    }
    if (queryLower.includes('guide') && section.url.startsWith('/guides/')) {
      score += 100;
    }
    
    // Penalize very short content (likely navigation pages)
    if (section.content.length < 500) {
      score *= 0.5;
    }
    
    // Boost comprehensive content
    if (section.content.length > 3000) {
      score *= 1.3;
    }
    
    return { ...section, score };
  });
  
  // Smart filtering and result curation
  const sortedResults = scored.sort((a, b) => b.score - a.score);
  
  // Dynamic threshold based on top score
  const topScore = sortedResults[0]?.score || 0;
  const threshold = Math.max(topScore * 0.15, 30); // At least 15% of top score or 30
  
  const filtered = sortedResults.filter(s => s.score >= threshold);
  
  // Ensure diversity in results
  const diverseResults: typeof filtered = [];
  const seenSections = new Set<string>();
  
  for (const result of filtered) {
    const section = result.url.split('/')[1]; // Get main section (docs, academy, etc.)
    
    // Always include top 5 results regardless of section
    if (diverseResults.length < 5) {
      diverseResults.push(result);
      seenSections.add(section);
    } 
    // For remaining results, ensure diversity but be more permissive
    else if (diverseResults.length < 25) { // Increased from 15 to 25
      // Limit same section to 5 results max (increased from 3)
      const sectionCount = diverseResults.filter(r => r.url.startsWith(`/${section}/`)).length;
      if (sectionCount < 5) {
        diverseResults.push(result);
      }
    }
  }
  
  return diverseResults;
}
