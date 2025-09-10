import { CONSOLE_TOOL_GROUPS } from '@/constants/console-tools';

// Transform shared groups into the structure expected by the chat prompt
export const CONSOLE_TOOLS = CONSOLE_TOOL_GROUPS.reduce(
  (acc, group) => {
    acc[group.title] = {
      description: group.description,
      tools: group.items
        .filter((item) => !!item.path)
        .map((item) => ({ name: item.title, path: item.path!, description: item.description })),
    };
    return acc;
  },
  {} as Record<string, { description: string; tools: Array<{ name: string; path: string; description: string }> }>
);

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
