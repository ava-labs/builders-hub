/**
 * Console Tools Search Utility
 *
 * Provides keyword-based search for console tools to help the AI
 * recommend relevant tools based on user queries.
 */

export interface ConsoleTool {
  title: string;
  url: string;
  category: string;
  description: string;
  keywords: string[];
}

// Flattened list of all console tools with metadata for searching
export const consoleTools: ConsoleTool[] = [
  // Primary Network
  {
    title: 'Data API Keys',
    url: '/console/utilities/data-api-keys',
    category: 'Primary Network',
    description: 'Generate and manage API keys for accessing Avalanche data APIs (Glacier)',
    keywords: ['api', 'key', 'glacier', 'data', 'access', 'token', 'rpc'],
  },
  {
    title: 'Node Setup',
    url: '/console/primary-network/node-setup',
    category: 'Primary Network',
    description: 'Set up and configure an Avalanche node on the Primary Network',
    keywords: ['node', 'setup', 'install', 'avalanchego', 'validator', 'primary', 'network', 'run'],
  },
  {
    title: 'Stake AVAX',
    url: '/console/primary-network/stake',
    category: 'Primary Network',
    description: 'Stake AVAX to become a validator or delegate to existing validators',
    keywords: ['stake', 'staking', 'validator', 'delegate', 'delegation', 'avax', 'rewards', 'earn'],
  },
  {
    title: 'Testnet Faucet',
    url: '/console/primary-network/faucet',
    category: 'Primary Network',
    description: 'Get free testnet AVAX tokens for development and testing',
    keywords: ['faucet', 'testnet', 'fuji', 'test', 'tokens', 'free', 'avax', 'drip'],
  },
  {
    title: 'C/P-Chain Bridge',
    url: '/console/primary-network/c-p-bridge',
    category: 'Primary Network',
    description: 'Transfer AVAX between C-Chain and P-Chain',
    keywords: ['bridge', 'transfer', 'c-chain', 'p-chain', 'cross-chain', 'move', 'avax'],
  },
  {
    title: 'AVAX Unit Converter',
    url: '/console/primary-network/unit-converter',
    category: 'Primary Network',
    description: 'Convert between AVAX denominations (nAVAX, AVAX, gwei)',
    keywords: ['convert', 'unit', 'navax', 'gwei', 'wei', 'denomination', 'calculator'],
  },

  // Layer 1
  {
    title: 'Create New L1',
    url: '/console/layer-1/create',
    category: 'Layer 1',
    description: 'Launch a new custom L1 blockchain on Avalanche',
    keywords: ['create', 'l1', 'layer1', 'blockchain', 'subnet', 'launch', 'new', 'deploy', 'chain'],
  },
  {
    title: 'L1 Node Setup',
    url: '/console/layer-1/l1-node-setup',
    category: 'Layer 1',
    description: 'Configure and run a node for your custom L1',
    keywords: ['l1', 'node', 'setup', 'configure', 'run', 'validator', 'subnet'],
  },
  {
    title: 'L1 Validator Balance',
    url: '/console/layer-1/l1-validator-balance',
    category: 'Layer 1',
    description: 'Check and manage validator balances on your L1',
    keywords: ['validator', 'balance', 'l1', 'check', 'funds', 'stake'],
  },
  {
    title: 'Explorer Setup',
    url: '/console/layer-1/explorer-setup',
    category: 'Layer 1',
    description: 'Deploy a block explorer for your L1',
    keywords: ['explorer', 'block', 'scan', 'deploy', 'l1', 'transactions', 'view'],
  },
  {
    title: 'Performance Monitor',
    url: '/console/layer-1/performance-monitor',
    category: 'Layer 1',
    description: 'Monitor the performance and health of your L1',
    keywords: ['performance', 'monitor', 'metrics', 'health', 'l1', 'tps', 'latency'],
  },

  // Testnet Infrastructure
  {
    title: 'Free Testnet Nodes',
    url: '/console/testnet-infra/nodes',
    category: 'Testnet Infrastructure',
    description: 'Deploy free managed testnet nodes for your L1',
    keywords: ['testnet', 'nodes', 'free', 'managed', 'infrastructure', 'deploy'],
  },
  {
    title: 'ICM Relayer',
    url: '/console/testnet-infra/icm-relayer',
    category: 'Testnet Infrastructure',
    description: 'Set up an ICM relayer for cross-chain messaging on testnet',
    keywords: ['icm', 'relayer', 'testnet', 'cross-chain', 'messaging', 'teleporter'],
  },

  // L1 Tokenomics
  {
    title: 'Transaction Fee Parameters',
    url: '/console/l1-tokenomics/fee-manager',
    category: 'L1 Tokenomics',
    description: 'Configure gas fees and fee parameters for your L1',
    keywords: ['fee', 'gas', 'transaction', 'parameters', 'configure', 'tokenomics', 'cost'],
  },
  {
    title: 'Fee Distributions',
    url: '/console/l1-tokenomics/reward-manager',
    category: 'L1 Tokenomics',
    description: 'Configure how transaction fees are distributed on your L1',
    keywords: ['fee', 'distribution', 'reward', 'burn', 'tokenomics', 'revenue'],
  },
  {
    title: 'Mint Native Coins',
    url: '/console/l1-tokenomics/native-minter',
    category: 'L1 Tokenomics',
    description: 'Mint native tokens on your L1 blockchain',
    keywords: ['mint', 'native', 'token', 'coin', 'create', 'supply', 'tokenomics'],
  },

  // Permissioned L1s
  {
    title: 'Validator Manager Setup',
    url: '/console/permissioned-l1s/validator-manager-setup',
    category: 'Permissioned L1s',
    description: 'Deploy the validator manager contract for your permissioned L1',
    keywords: ['validator', 'manager', 'setup', 'deploy', 'contract', 'permissioned', 'poa'],
  },
  {
    title: 'Multisig Setup',
    url: '/console/permissioned-l1s/multisig-setup',
    category: 'Permissioned L1s',
    description: 'Configure multisig for validator management',
    keywords: ['multisig', 'multi-sig', 'setup', 'governance', 'safe', 'gnosis'],
  },
  {
    title: 'Query Validator Set',
    url: '/console/layer-1/validator-set',
    category: 'Permissioned L1s',
    description: 'View the current validator set for your L1',
    keywords: ['validator', 'set', 'query', 'view', 'list', 'current'],
  },
  {
    title: 'Add Validator',
    url: '/console/permissioned-l1s/add-validator',
    category: 'Permissioned L1s',
    description: 'Add a new validator to your permissioned L1',
    keywords: ['add', 'validator', 'new', 'register', 'permissioned'],
  },
  {
    title: 'Remove Validator',
    url: '/console/permissioned-l1s/remove-validator',
    category: 'Permissioned L1s',
    description: 'Remove a validator from your permissioned L1',
    keywords: ['remove', 'validator', 'delete', 'permissioned', 'kick'],
  },
  {
    title: 'Disable Validator',
    url: '/console/permissioned-l1s/disable-validator',
    category: 'Permissioned L1s',
    description: 'Temporarily disable a validator on your L1',
    keywords: ['disable', 'validator', 'pause', 'temporary', 'permissioned'],
  },
  {
    title: 'Change Validator Weight',
    url: '/console/permissioned-l1s/change-validator-weight',
    category: 'Permissioned L1s',
    description: 'Adjust the voting weight of a validator',
    keywords: ['change', 'validator', 'weight', 'adjust', 'voting', 'power'],
  },

  // L1 Access Restrictions
  {
    title: 'Contract Deployer Allowlist',
    url: '/console/l1-access-restrictions/deployer-allowlist',
    category: 'L1 Access Restrictions',
    description: 'Control who can deploy smart contracts on your L1',
    keywords: ['deployer', 'allowlist', 'whitelist', 'contract', 'deploy', 'permission', 'restrict'],
  },
  {
    title: 'Transactor Allowlist',
    url: '/console/l1-access-restrictions/transactor-allowlist',
    category: 'L1 Access Restrictions',
    description: 'Control who can send transactions on your L1',
    keywords: ['transactor', 'allowlist', 'whitelist', 'transaction', 'permission', 'restrict', 'access'],
  },

  // Permissionless L1s
  {
    title: 'Native Staking Manager Setup',
    url: '/console/permissionless-l1s/native-staking-manager-setup',
    category: 'Permissionless L1s',
    description: 'Set up staking for permissionless L1 validators',
    keywords: ['staking', 'manager', 'permissionless', 'pos', 'proof-of-stake', 'validator'],
  },

  // Interchain Messaging
  {
    title: 'ICM Setup',
    url: '/console/icm/setup',
    category: 'Interchain Messaging',
    description: 'Configure Interchain Messaging (Teleporter) for cross-chain communication',
    keywords: ['icm', 'teleporter', 'cross-chain', 'messaging', 'setup', 'configure', 'interchain'],
  },
  {
    title: 'Test ICM Connection',
    url: '/console/icm/test-connection',
    category: 'Interchain Messaging',
    description: 'Test cross-chain messaging between your L1 and other chains',
    keywords: ['test', 'icm', 'connection', 'messaging', 'cross-chain', 'verify', 'teleporter'],
  },

  // Interchain Token Transfer
  {
    title: 'ICTT Bridge Setup',
    url: '/console/ictt/setup',
    category: 'Interchain Token Transfer',
    description: 'Set up token bridges using Interchain Token Transfer',
    keywords: ['ictt', 'bridge', 'token', 'transfer', 'setup', 'cross-chain', 'erc20'],
  },
  {
    title: 'Token Transfer',
    url: '/console/ictt/token-transfer',
    category: 'Interchain Token Transfer',
    description: 'Transfer tokens between chains using ICTT',
    keywords: ['token', 'transfer', 'bridge', 'ictt', 'cross-chain', 'send', 'move'],
  },

  // Utilities
  {
    title: 'Format Converter',
    url: '/console/utilities/format-converter',
    category: 'Utilities',
    description: 'Convert between different address and data formats',
    keywords: ['format', 'convert', 'address', 'hex', 'bech32', 'cb58', 'utility'],
  },
  {
    title: 'Transfer Proxy Admin',
    url: '/console/utilities/transfer-proxy-admin',
    category: 'Utilities',
    description: 'Transfer ownership of proxy admin contracts',
    keywords: ['proxy', 'admin', 'transfer', 'ownership', 'upgrade', 'contract'],
  },
];

/**
 * Search for relevant console tools based on a query
 * Returns tools sorted by relevance score
 */
export function searchTools(query: string, limit: number = 5): ConsoleTool[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);

  // Score each tool based on keyword and title matches
  const scoredTools = consoleTools.map(tool => {
    let score = 0;
    const titleLower = tool.title.toLowerCase();
    const descLower = tool.description.toLowerCase();
    const categoryLower = tool.category.toLowerCase();

    // Check for exact phrase match in title (highest priority)
    if (titleLower.includes(queryLower)) {
      score += 100;
    }

    // Check each query term
    for (const term of queryTerms) {
      // Title match
      if (titleLower.includes(term)) {
        score += 30;
      }

      // Category match
      if (categoryLower.includes(term)) {
        score += 20;
      }

      // Description match
      if (descLower.includes(term)) {
        score += 15;
      }

      // Keyword match
      if (tool.keywords.some(kw => kw.includes(term) || term.includes(kw))) {
        score += 25;
      }
    }

    return { tool, score };
  });

  // Filter and sort by score
  return scoredTools
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.tool);
}

/**
 * Get tools formatted for inclusion in AI system prompt
 */
export function getToolsContextForPrompt(): string {
  const toolsByCategory = new Map<string, ConsoleTool[]>();

  for (const tool of consoleTools) {
    const existing = toolsByCategory.get(tool.category) || [];
    existing.push(tool);
    toolsByCategory.set(tool.category, existing);
  }

  let context = 'AVAILABLE CONSOLE TOOLS:\n';
  context += 'Recommend these interactive tools when users want to perform hands-on tasks.\n\n';

  for (const [category, tools] of toolsByCategory) {
    context += `**${category}:**\n`;
    for (const tool of tools) {
      context += `- [${tool.title}](https://build.avax.network${tool.url}): ${tool.description}\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Format search results for AI context
 */
export function formatToolsForContext(tools: ConsoleTool[]): string {
  if (tools.length === 0) {
    return '';
  }

  return tools.map(tool =>
    `- [${tool.title}](https://build.avax.network${tool.url}) (${tool.category}): ${tool.description}`
  ).join('\n');
}
