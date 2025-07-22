import { NextResponse } from 'next/server';

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

function extractKeywords(text: string): string[] {
  // Extract important keywords from the AI's response
  const keywords = new Set<string>();
  
  // Common technical terms and concepts
  const technicalTerms = [
    'deploy', 'create', 'build', 'install', 'setup', 'configure',
    'avalanche', 'subnet', 'l1', 'chain', 'contract', 'token', 'wallet', 'node',
    'validator', 'stake', 'delegate', 'teleporter', 'icm', 'ictt',
    'evm', 'rpc', 'api', 'endpoint', 'network', 'testnet', 'mainnet',
    'bridge', 'cross-chain', 'interchain', 'message', 'transfer',
    'precompile', 'native', 'minter', 'fee', 'reward', 'warp'
  ];
  
  const textLower = text.toLowerCase();
  
  // Find mentioned technical terms
  technicalTerms.forEach(term => {
    if (textLower.includes(term)) {
      keywords.add(term);
    }
  });
  
  // Extract URLs and convert to topics
  const urlMatches = text.match(/https:\/\/build\.avax\.network\/([^)\s]+)/g);
  if (urlMatches) {
    urlMatches.forEach(url => {
      const pathParts = url.split('/').slice(3); // Remove https://build.avax.network
      pathParts.forEach(part => {
        if (part && part.length > 3) {
          keywords.add(part.replace(/-/g, ' '));
        }
      });
    });
  }
  
  return Array.from(keywords);
}

function generateSuggestionsFromContent(keywords: string[], sections: Array<{ title: string; url: string; content: string }>): string[] {
  const suggestions: string[] = [];
  const usedTopics = new Set<string>();
  
  // Find related sections based on keywords
  const relatedSections = sections.filter(section => {
    const contentLower = section.content.toLowerCase();
    const titleLower = section.title.toLowerCase();
    
    return keywords.some(keyword => 
      contentLower.includes(keyword.toLowerCase()) || 
      titleLower.includes(keyword.toLowerCase())
    );
  }).slice(0, 10); // Limit to top 10 related sections
  
  // Generate questions from section titles
  relatedSections.forEach(section => {
    const title = section.title;
    
    // Skip if we've already covered this topic
    const topicKey = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (usedTopics.has(topicKey)) return;
    usedTopics.add(topicKey);
    
    // Generate different types of questions based on the title
    if (title.includes('Deploy') || title.includes('Create')) {
      suggestions.push(`How do I ${title.toLowerCase()}?`);
    } else if (title.includes('Configure') || title.includes('Setup')) {
      suggestions.push(`What are the steps to ${title.toLowerCase()}?`);
    } else if (title.includes('Understand') || title.includes('Learn')) {
      suggestions.push(`Can you explain ${title.toLowerCase().replace('understand', '').replace('learn', '').trim()}?`);
    } else {
      suggestions.push(`Tell me more about ${title.toLowerCase()}`);
    }
  });
  
  // Add contextual follow-up questions based on topic combinations
  const contextualQuestions: { [key: string]: { [subkey: string]: string[] } } = {
    'node': {
      'local': [
        'What are the hardware requirements for running a local node?',
        'How do I connect my local node to testnet?',
        'How can I monitor my local node\'s performance?',
        'What ports need to be open for my node?'
      ],
      'run': [
        'How long does it take to sync a node?',
        'What\'s the difference between archival and pruned nodes?',
        'How do I update my node to the latest version?',
        'Can I run multiple nodes on the same machine?'
      ],
      'setup': [
        'What configuration options should I use?',
        'How do I backup my node data?',
        'What are common node setup errors?',
        'How do I enable API endpoints on my node?'
      ]
    },
    'deploy': {
      'contract': [
        'How do I verify my deployed contract?',
        'What are gas optimization techniques for deployment?',
        'How can I upgrade my deployed contract?',
        'What tools can I use to test before deployment?'
      ],
      'smart': [
        'What are the deployment costs on Avalanche?',
        'How do I interact with my deployed contract?',
        'What security checks should I do before deployment?',
        'Can I deploy the same contract to multiple chains?'
      ]
    },
    'validator': {
      'become': [
        'What\'s the minimum stake required?',
        'How long is the validation period?',
        'What are the rewards for validation?',
        'What happens if my validator goes offline?'
      ],
      'stake': [
        'How do I calculate staking rewards?',
        'Can I unstake before the validation period ends?',
        'What\'s the difference between validation and delegation?',
        'How do I choose a good validator to delegate to?'
      ]
    },
    'subnet': {
      'create': [
        'What are the costs of creating a subnet?',
        'How do I add validators to my subnet?',
        'What VM options are available for subnets?',
        'How do I configure subnet parameters?'
      ],
      'l1': [
        'What\'s the difference between Subnet and L1?',
        'How do I convert my Subnet to an L1?',
        'What are the benefits of L1s over Subnets?',
        'Can L1s communicate with each other?'
      ]
    },
    'token': {
      'bridge': [
        'Which bridges support Avalanche?',
        'How long do bridge transfers take?',
        'What are bridge fees?',
        'Is bridging safe?'
      ],
      'create': [
        'What token standards does Avalanche support?',
        'How do I add liquidity for my token?',
        'How can I list my token on exchanges?',
        'What are tokenomics best practices?'
      ]
    }
  };
  
  // Generate contextual questions based on keyword combinations
  const keywordList = Array.from(keywords);
  
  for (const mainKeyword of keywordList) {
    if (contextualQuestions[mainKeyword]) {
      for (const subKeyword of keywordList) {
        if (contextualQuestions[mainKeyword][subKeyword]) {
          // Add questions that are contextually relevant
          contextualQuestions[mainKeyword][subKeyword].forEach(question => {
            if (!suggestions.some(s => s.toLowerCase() === question.toLowerCase())) {
              suggestions.push(question);
            }
          });
        }
      }
    }
  }
  
  // If we don't have enough suggestions, add some general follow-ups
  if (suggestions.length < 3) {
    const generalFollowUps = [
      'Can you show me a code example?',
      'What are common mistakes to avoid?',
      'Are there any best practices I should follow?',
      'What tools or resources would help with this?',
      'Can you explain this in simpler terms?'
    ];
    
    generalFollowUps.forEach(question => {
      if (suggestions.length < 6 && !suggestions.includes(question)) {
        suggestions.push(question);
      }
    });
  }
  
  return suggestions.slice(0, 6); // Return top 6 suggestions
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ suggestions: [] });
    }
    
    // Extract keywords from the AI's response
    const keywords = extractKeywords(message);
    
    if (keywords.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }
    
    // Load documentation content
    const sections = await loadLLMsContent();
    
    // Generate suggestions based on content
    const suggestions = generateSuggestionsFromContent(keywords, sections);
    
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json({ suggestions: [] });
  }
} 