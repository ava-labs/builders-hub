// we have this file to define components that are used in the console so that we can use them in both the console-sidebar and backend AI chat

export type ConsoleIconId =
  | 'network'
  | 'box'
  | 'messagesSquare'
  | 'wrench'
  | 'droplets'
  | 'arrowLeft'
  | 'shield'
  | 'gitMerge'
  | 'server'
  | 'telescope'
  | 'arrowLeftRight'
  | 'calculator'
  | 'coins'
  | 'globe'
  | 'arrowUpDown'
  | 'shieldCheck'
  | 'shieldUser'
  | 'squareTerminal'
  | 'hexagon'
  | 'slidersVertical'
  | 'squareMinus'
  | 'squarePlus'
  | 'handCoins'
  | 'layers';

export type ConsoleToolItem = {
  title: string;
  description: string;
  path?: string; // Relative console path, e.g. "primary-network/faucet"
  externalUrl?: string; // Absolute URL for external tools
  comingSoon?: boolean;
  icon: ConsoleIconId;
};

export type ConsoleToolGroup = {
  title: string;
  description: string;
  icon: ConsoleIconId;
  items: ReadonlyArray<ConsoleToolItem>;
};

// Canonical list of Builder Console tools for reuse across sidebar and chat
export const CONSOLE_TOOL_GROUPS: ReadonlyArray<ConsoleToolGroup> = [
  {
    title: 'Primary Network',
    description: 'Tools for working with the Avalanche Primary Network',
    icon: 'network',
    items: [
      { title: 'Node Setup', path: 'primary-network/node-setup', description: 'Set up a Primary Network node', icon: 'server' },
      { title: 'Stake', path: 'primary-network/stake', description: 'Stake AVAX on the Primary Network', icon: 'handCoins' },
      { title: 'Testnet Faucet', path: 'primary-network/faucet', description: 'Get testnet AVAX tokens for development on Fuji network', icon: 'droplets' },
      { title: 'C/P-Chain Bridge', path: 'primary-network/c-p-bridge', description: 'Transfer AVAX between C-Chain and P-Chain', icon: 'arrowLeftRight' },
      { title: 'AVAX Unit Converter', path: 'primary-network/unit-converter', description: 'Convert between AVAX units', icon: 'calculator' },
      { title: 'Ethereum Bridge', externalUrl: 'https://core.app/bridge', description: 'Transfer assets between Avalanche and Ethereum via Core Bridge', icon: 'arrowUpDown' },
    ],
  },
  {
    title: 'Layer 1',
    description: 'Tools for creating and managing Avalanche L1 blockchains',
    icon: 'box',
    items: [
      { title: 'Create New L1', path: 'layer-1/create', description: 'Create a new L1 blockchain', icon: 'layers' },
      { title: 'L1 Node Setup', path: 'layer-1/l1-node-setup', description: 'Set up an Avalanche node for your L1', icon: 'server' },
      { title: 'L1 Validator Balance', path: 'layer-1/l1-validator-balance', description: 'Check validator balances on your L1', icon: 'coins' },
      { title: 'Explorer Setup', path: 'layer-1/explorer-setup', description: 'Deploy your own blockchain explorer', icon: 'telescope' },
    ],
  },
  {
    title: 'Free Testnet Infrastructure',
    description: 'Free testnet infrastructure tools',
    icon: 'box',
    items: [
      { title: 'Nodes', path: 'testnet-infra/nodes', description: 'Access free testnet node infrastructure', icon: 'layers' },
      { title: 'ICM Relayer', path: 'testnet-infra/icm-relayer', description: 'Managed relayer service for ICM (coming soon)', comingSoon: true, icon: 'layers' },
    ],
  },
  {
    title: 'L1 Tokenomics',
    description: 'Tools for managing L1 tokenomics and fees',
    icon: 'coins',
    items: [
      { title: 'Transaction Fee Parameters', path: 'l1-tokenomics/fee-manager', description: 'Configure transaction fees', icon: 'coins' },
      { title: 'Fee Distributions', path: 'l1-tokenomics/reward-manager', description: 'Manage fee distribution rewards', icon: 'coins' },
      { title: 'Mint Native Coins', path: 'l1-tokenomics/native-minter', description: 'Mint native tokens on your L1', icon: 'coins' },
    ],
  },
  {
    title: 'Permissioned L1s',
    description: 'Tools for managing permissioned L1 validators and access',
    icon: 'shield',
    items: [
      { title: 'Validator Manager Setup', path: 'permissioned-l1s/validator-manager-setup', description: 'Deploy the main validator manager contract', icon: 'squareTerminal' },
      { title: 'Multisig Setup', path: 'permissioned-l1s/multisig-setup', description: 'Set up multisig for validator management', icon: 'shieldUser' },
      { title: 'Query Validator Set', path: 'layer-1/validator-set', description: 'Check current validators and their status', icon: 'hexagon' },
      { title: 'Add Validator', path: 'permissioned-l1s/add-validator', description: 'Add new validators to your L1', icon: 'squarePlus' },
      { title: 'Remove Validator', path: 'permissioned-l1s/remove-validator', description: 'Remove validators from your L1', icon: 'squareMinus' },
      { title: 'Change Validator Weight', path: 'permissioned-l1s/change-validator-weight', description: 'Modify validator weights', icon: 'slidersVertical' },
    ],
  },
  {
    title: 'L1 Access Restrictions',
    description: 'Manage contract deployment and transaction permissions',
    icon: 'shield',
    items: [
      { title: 'Contract Deployer Allowlist', path: 'permissioned-l1s/deployer-allowlist', description: 'Manage contract deployment permissions', icon: 'shieldCheck' },
      { title: 'Transactor Allowlist', path: 'permissioned-l1s/transactor-allowlist', description: 'Manage transaction permissions', icon: 'shieldUser' },
    ],
  },
  {
    title: 'Permissionless L1s',
    description: 'Tools for permissionless validator management',
    icon: 'globe',
    items: [
      { title: 'Migrate from Permissioned L1', path: 'permissionless-l1s/deploy-reward-manager', description: 'Deploy reward manager to migrate to permissionless staking', comingSoon: true, icon: 'gitMerge' },
      { title: 'Stake & Unstake', path: 'permissionless-l1s/manage-validators', description: 'Manage validators on permissionless L1s', comingSoon: true, icon: 'hexagon' },
    ],
  },
  {
    title: 'Interchain Messaging',
    description: 'Tools for cross-chain communication between L1s',
    icon: 'messagesSquare',
    items: [
      { title: 'Setup', path: 'icm/setup', description: 'Set up Interchain Messaging infrastructure', icon: 'squareTerminal' },
      { title: 'Test Connection', path: 'icm/test-connection', description: 'Test cross-chain messaging connections', icon: 'messagesSquare' },
    ],
  },
  {
    title: 'Interchain Token Transfer',
    description: 'Tools for bridging tokens between L1s',
    icon: 'arrowLeftRight',
    items: [
      { title: 'Bridge Setup', path: 'ictt/setup', description: 'Set up token bridging infrastructure', icon: 'squareTerminal' },
      { title: 'Token Transfer', path: 'ictt/token-transfer', description: 'Transfer tokens between chains', icon: 'arrowLeftRight' },
    ],
  },
  {
    title: 'Utilities',
    description: 'Utility tools for development',
    icon: 'wrench',
    items: [
      { title: 'Format Converter', path: 'utilities/format-converter', description: 'Convert between different data formats', icon: 'wrench' },
    ],
  },
];

export type { ConsoleToolGroup as ConsoleToolCategory };

// Component map centralization: dynamic imports for each console tool path
// Consumers (e.g., ConsoleToolRenderer) should import from here to render tools.
import type React from 'react';
export const CONSOLE_COMPONENT_MAP: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  // Primary Network
  'primary-network/faucet': () => import('@/toolbox/src/toolbox/Wallet/Faucet'),
  'primary-network/unit-converter': () => import('@/toolbox/src/toolbox/Conversion/UnitConverter'),
  'primary-network/stake': () => import('@/toolbox/src/toolbox/PrimaryNetwork/Stake'),

  // Layer 1
  'layer-1/create': () => import('@/app/console/layer-1/create/page'),
  'layer-1/validator-set': () => import('@/toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet'),

  // Permissioned L1s
  'permissioned-l1s/add-validator': () => import('@/toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator'),
  'permissioned-l1s/remove-validator': () => import('@/toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator'),
  'permissioned-l1s/change-validator-weight': () => import('@/toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight'),
  'permissioned-l1s/validator-manager-setup': () => import('@/toolbox/src/toolbox/ValidatorManager/DeployValidatorManager'),
  'permissioned-l1s/deployer-allowlist': () => import('@/toolbox/src/toolbox/Precompiles/DeployerAllowlist'),
  'permissioned-l1s/transactor-allowlist': () => import('@/toolbox/src/toolbox/Precompiles/TransactionAllowlist'),

  // ICM
  'icm/setup': () => import('@/app/console/icm/setup/page'),

  // ICTT
  'ictt/setup': () => import('@/app/console/ictt/setup/page'),
  'ictt/token-transfer': () => import('@/toolbox/src/toolbox/ICTT/TestSend'),

  // L1 Tokenomics
  'l1-tokenomics/fee-manager': () => import('@/toolbox/src/toolbox/Precompiles/FeeManager'),
  'l1-tokenomics/reward-manager': () => import('@/toolbox/src/toolbox/Precompiles/RewardManager'),
  'l1-tokenomics/native-minter': () => import('@/toolbox/src/toolbox/Precompiles/NativeMinter'),

  // Utilities
  'utilities/format-converter': () => import('@/toolbox/src/toolbox/Conversion/FormatConverter'),

  // Testnet Infrastructure
  'testnet-infra/nodes': () => import('@/toolbox/src/toolbox/Nodes/ManagedTestnetNodes'),

  // Additional commonly used tools
  'primary-network/node-setup': () => import('@/toolbox/src/toolbox/Nodes/AvalancheGoDockerPrimaryNetwork'),
  'layer-1/l1-node-setup': () => import('@/toolbox/src/toolbox/Nodes/AvalancheGoDockerL1'),
  'layer-1/l1-validator-balance': () => import('@/toolbox/src/toolbox/L1/QueryL1Details'),
  'layer-1/explorer-setup': () => import('@/toolbox/src/toolbox/L1/SelfHostedExplorer'),
};

