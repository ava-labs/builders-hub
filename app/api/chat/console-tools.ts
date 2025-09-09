export const CONSOLE_TOOLS = {
  'Layer 1': {
    description: 'Tools for creating and managing Avalanche L1 blockchains',
    tools: [
      { name: 'Create New L1', path: 'layer-1/create', description: 'Create a new L1 blockchain' },
      { name: 'L1 Node Setup', path: 'layer-1/l1-node-setup', description: 'Set up an Avalanche node for your L1' },
      { name: 'L1 Validator Balance', path: 'layer-1/l1-validator-balance', description: 'Check validator balances on your L1' },
      { name: 'Explorer Setup', path: 'layer-1/explorer-setup', description: 'Deploy your own blockchain explorer' },
      { name: 'Query Validator Set', path: 'layer-1/validator-set', description: 'Check current validators and their status' }
    ]
  },
  'Permissioned L1s': {
    description: 'Tools for managing permissioned L1 validators and access',
    tools: [
      { name: 'Validator Manager Setup', path: 'permissioned-l1s/validator-manager-setup', description: 'Deploy the main validator manager contract' },
      { name: 'Multisig Setup', path: 'permissioned-l1s/multisig-setup', description: 'Set up multisig for validator management' },
      { name: 'Add Validator', path: 'permissioned-l1s/add-validator', description: 'Add new validators to your L1' },
      { name: 'Remove Validator', path: 'permissioned-l1s/remove-validator', description: 'Remove validators from your L1' },
      { name: 'Change Validator Weight', path: 'permissioned-l1s/change-validator-weight', description: 'Modify validator weights' },
      { name: 'Contract Deployer Allowlist', path: 'permissioned-l1s/deployer-allowlist', description: 'Manage contract deployment permissions' },
      { name: 'Transactor Allowlist', path: 'permissioned-l1s/transactor-allowlist', description: 'Manage transaction permissions' }
    ]
  },
  'Interchain Messaging': {
    description: 'Tools for cross-chain communication between L1s',
    tools: [
      { name: 'ICM Setup', path: 'icm/setup', description: 'Set up Interchain Messaging infrastructure' },
      { name: 'Test Connection', path: 'icm/test-connection', description: 'Test cross-chain messaging connections' }
    ]
  },
  'Interchain Token Transfer': {
    description: 'Tools for bridging tokens between L1s',
    tools: [
      { name: 'Bridge Setup', path: 'ictt/setup', description: 'Set up token bridging infrastructure' },
      { name: 'Token Transfer', path: 'ictt/token-transfer', description: 'Transfer tokens between chains' }
    ]
  },
  'L1 Tokenomics': {
    description: 'Tools for managing L1 tokenomics and fees',
    tools: [
      { name: 'Transaction Fee Parameters', path: 'l1-tokenomics/fee-manager', description: 'Configure transaction fees' },
      { name: 'Fee Distributions', path: 'l1-tokenomics/reward-manager', description: 'Manage fee distribution rewards' },
      { name: 'Mint Native Coins', path: 'l1-tokenomics/native-minter', description: 'Mint native tokens on your L1' }
    ]
  },
  'Primary Network': {
    description: 'Tools for working with the Avalanche Primary Network',
    tools: [
      { name: 'Node Setup', path: 'primary-network/node-setup', description: 'Set up a Primary Network node' },
      { name: 'Stake', path: 'primary-network/stake', description: 'Stake AVAX on the Primary Network' },
      { name: 'Testnet Faucet', path: 'primary-network/faucet', description: 'Get testnet AVAX tokens for development on Fuji network' },
      { name: 'C/P-Chain Bridge', path: 'primary-network/c-p-bridge', description: 'Transfer AVAX between C-Chain and P-Chain' },
      { name: 'AVAX Unit Converter', path: 'primary-network/unit-converter', description: 'Convert between AVAX units' }
    ]
  },
  'Testnet Infrastructure': {
    description: 'Free testnet infrastructure tools',
    tools: [
      { name: 'Testnet Nodes', path: 'testnet-infra/nodes', description: 'Access free testnet node infrastructure' }
    ]
  },
  'Utilities': {
    description: 'Utility tools for development',
    tools: [
      { name: 'Format Converter', path: 'utilities/format-converter', description: 'Convert between different data formats' }
    ]
  }
} as const;

export function suggestConsoleTools(query: string) {
  const q = query.toLowerCase();
  const picks: Array<{ name: string; path: string; reason: string }> = [];
  const add = (name: string, path: string, reason: string) => {
    if (!picks.find((p) => p.path === path)) picks.push({ name, path, reason });
  };

  if (q.match(/faucet|fuji|test\s*avax|testnet\s*tokens?/)) {
    add('Testnet Faucet', 'primary-network/faucet', 'Get testnet AVAX quickly');
  }
  if (q.match(/stake|validator|primary\s*network/)) {
    add('Stake', 'primary-network/stake', 'Stake AVAX or manage validators on Primary Network');
  }
  if (q.match(/create|launch|new\s*l1|subnet/)) {
    add('Create New L1', 'layer-1/create', 'Create and configure a new L1');
  }
  if (q.match(/icm|interchain\s*messaging|cross[- ]?chain\s*message/)) {
    add('ICM Setup', 'icm/setup', 'Set up cross-chain messaging');
  }
  if (q.match(/ictt|token\s*transfer|bridge/)) {
    add('Token Transfer', 'ictt/token-transfer', 'Send tokens between chains');
  }
  if (q.match(/explorer|index/)) {
    add('Explorer Setup', 'layer-1/explorer-setup', 'Deploy your own chain explorer');
  }

  return picks;
}
