// Shared registry for the console toolbox grid + the sidebar search index.
// The sidebar exposes a curated subset of these as quick-access groups; this
// file is the source of truth for "every tool that exists in the console" so
// search results stay complete even when an item isn't pinned to the sidebar.

import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpFromLine,
  Bell,
  BookKey,
  BookOpen,
  Calculator,
  Coins,
  Droplets,
  Eye,
  GitMerge,
  HandCoins,
  Hexagon,
  Key,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Rocket,
  Search,
  Send,
  Server,
  ShieldCheck,
  ShieldOff,
  ShieldUser,
  SlidersVertical,
  SquareMinus,
  SquarePlus,
  SquareTerminal,
  Telescope,
  Workflow,
  Wrench,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

export interface ToolCard {
  name: string;
  description: string;
  path: string;
  category: string;
  icon: LucideIcon;
  external?: boolean;
  featured?: boolean;
  subSteps?: Array<{
    name: string;
    path: string;
    description?: string;
  }>;
}

const TOOLS_RAW: ToolCard[] = [
  // ── Primary Network ──────────────────────────────────────
  {
    name: 'Testnet Faucet',
    description: 'Get free testnet AVAX for development and testing.',
    path: '/console/primary-network/faucet',
    category: 'Primary Network',
    icon: Droplets,
    featured: true,
  },
  {
    name: 'Data API Keys',
    description: 'Manage API keys for Avalanche data services.',
    path: '/console/utilities/data-api-keys',
    category: 'Primary Network',
    icon: BookKey,
  },
  {
    name: 'Stake AVAX',
    description: 'Stake AVAX on the Primary Network as a validator or delegator.',
    path: '/console/primary-network/stake',
    category: 'Primary Network',
    icon: HandCoins,
  },
  {
    name: 'Node Setup',
    description: 'Set up and configure an AvalancheGo node.',
    path: '/console/primary-network/node-setup',
    category: 'Primary Network',
    icon: Server,
  },
  {
    name: 'C/P-Chain Bridge',
    description: 'Transfer AVAX between the C-Chain and P-Chain.',
    path: '/console/primary-network/c-p-bridge',
    category: 'Primary Network',
    icon: ArrowLeftRight,
  },
  {
    name: 'Ethereum Bridge',
    description: 'Bridge assets between Ethereum and Avalanche via Core.',
    path: 'https://core.app/bridge',
    category: 'Primary Network',
    icon: ArrowUpDown,
    external: true,
  },
  {
    name: 'Validator Lookup',
    description: 'Search and inspect validators on the Primary Network.',
    path: '/console/primary-network/validator-lookup',
    category: 'Primary Network',
    icon: Search,
  },
  {
    name: 'Validator Alerts',
    description: 'Subscribe to alerts for validator uptime and status.',
    path: '/console/primary-network/validator-alerts',
    category: 'Primary Network',
    icon: Bell,
  },
  {
    name: 'Devnet Faucet',
    description: 'Get devnet AVAX for ad-hoc test networks.',
    path: '/console/primary-network/devnet-faucet',
    category: 'Primary Network',
    icon: Droplets,
  },

  // ── Create & Deploy ──────────────────────────────────────
  {
    name: 'Create L1',
    description: 'Launch a new Avalanche L1 with a guided wizard.',
    path: '/console/create-l1',
    category: 'Create & Deploy',
    icon: Layers,
    featured: true,
    // Convert to L1 is exposed as a standalone tile below — keep it out of
    // subSteps to avoid double-listing the same path when sub-step search
    // is on.
    subSteps: [
      { name: 'Create Subnet', path: '/console/layer-1/create/create-subnet' },
      { name: 'Create Chain', path: '/console/layer-1/create/create-chain' },
      { name: 'Managed Testnet L1 Nodes', path: '/console/layer-1/create/managed-testnet-l1-nodes' },
      { name: 'L1 Node Setup with Docker', path: '/console/layer-1/create/l1-node-setup' },
    ],
  },
  {
    name: 'Convert to L1',
    description: 'Jump directly to the subnet-to-L1 conversion step in the advanced wizard.',
    path: '/console/layer-1/create/convert-to-l1',
    category: 'Create & Deploy',
    icon: GitMerge,
  },
  {
    name: 'My L1 Dashboard',
    description: 'View and manage your deployed L1 networks.',
    path: '/console/my-l1',
    category: 'Create & Deploy',
    icon: LayoutDashboard,
  },

  // ── Permissioned L1s ─────────────────────────────────────
  {
    name: 'Validator Manager Setup',
    description: 'Deploy and configure on-chain validator management.',
    path: '/console/permissioned-l1s/validator-manager-setup',
    category: 'Permissioned L1s',
    icon: SquareTerminal,
    subSteps: [
      {
        name: 'Deploy Validator Manager',
        path: '/console/permissioned-l1s/validator-manager-setup/deploy-validator-manager',
      },
      { name: 'Proxy Setup', path: '/console/permissioned-l1s/validator-manager-setup/proxy-setup' },
      { name: 'Initialize Manager', path: '/console/permissioned-l1s/validator-manager-setup/initialize-manager' },
      {
        name: 'Initialize Validator Set',
        path: '/console/permissioned-l1s/validator-manager-setup/init-validator-set',
      },
      { name: 'Read L1 Details', path: '/console/permissioned-l1s/validator-manager-setup/read-l1-details' },
    ],
  },
  {
    name: 'Multisig Setup',
    description: 'Add multi-signature security to validator management.',
    path: '/console/permissioned-l1s/multisig-setup',
    category: 'Permissioned L1s',
    icon: ShieldUser,
  },
  {
    name: 'Add Validator',
    description: 'Register a new validator on your permissioned L1.',
    path: '/console/permissioned-l1s/add-validator',
    category: 'Permissioned L1s',
    icon: SquarePlus,
  },
  {
    name: 'Remove Validator',
    description: 'Remove a validator from your permissioned L1.',
    path: '/console/permissioned-l1s/remove-validator',
    category: 'Permissioned L1s',
    icon: SquareMinus,
  },
  {
    name: 'Change Validator Weight',
    description: 'Adjust the consensus weight of a validator.',
    path: '/console/permissioned-l1s/change-validator-weight',
    category: 'Permissioned L1s',
    icon: SlidersVertical,
  },
  {
    name: 'Disable Validator',
    description: 'Temporarily disable a validator on your L1.',
    path: '/console/permissioned-l1s/disable-validator',
    category: 'Permissioned L1s',
    icon: ShieldOff,
  },
  {
    name: 'Remove Expired Registration',
    description: 'Clean up validators with expired registrations.',
    path: '/console/permissioned-l1s/remove-expired-validator-registration',
    category: 'Permissioned L1s',
    icon: SquareMinus,
  },

  // ── Permissionless L1s ───────────────────────────────────
  {
    name: 'Native Staking Manager Setup',
    description: 'Deploy a staking manager for native token staking.',
    path: '/console/permissionless-l1s/native-staking-manager-setup',
    category: 'Permissionless L1s',
    icon: GitMerge,
  },
  {
    name: 'ERC20 Staking Manager Setup',
    description: 'Deploy a staking manager for ERC20 token staking.',
    path: '/console/permissionless-l1s/erc20-staking-manager-setup',
    category: 'Permissionless L1s',
    icon: GitMerge,
  },
  {
    name: 'Stake (Native Token)',
    description: 'Register and stake a validator with native tokens.',
    path: '/console/permissionless-l1s/stake/native',
    category: 'Permissionless L1s',
    icon: HandCoins,
  },
  {
    name: 'Stake (ERC20 Token)',
    description: 'Register and stake a validator with ERC20 tokens.',
    path: '/console/permissionless-l1s/stake/erc20',
    category: 'Permissionless L1s',
    icon: HandCoins,
  },
  {
    name: 'Delegate (Native Token)',
    description: 'Delegate native tokens to an active validator.',
    path: '/console/permissionless-l1s/delegate/native',
    category: 'Permissionless L1s',
    icon: ArrowUpDown,
  },
  {
    name: 'Delegate (ERC20 Token)',
    description: 'Delegate ERC20 tokens to an active validator.',
    path: '/console/permissionless-l1s/delegate/erc20',
    category: 'Permissionless L1s',
    icon: ArrowUpDown,
  },
  {
    name: 'Remove Validator',
    description: 'End validation and withdraw staked tokens.',
    path: '/console/permissionless-l1s/remove-validator-uptime',
    category: 'Permissionless L1s',
    icon: SquareMinus,
  },
  {
    name: 'Force Remove Validator',
    description: 'Remove a validator without uptime proof (forfeits rewards).',
    path: '/console/permissionless-l1s/remove-validator',
    category: 'Permissionless L1s',
    icon: SquareMinus,
  },
  {
    name: 'Remove Delegation',
    description: 'End delegation and withdraw delegated tokens.',
    path: '/console/permissionless-l1s/remove-delegation',
    category: 'Permissionless L1s',
    icon: SquareMinus,
  },
  {
    name: 'Query Staking Validators',
    description: 'Inspect the staking validator set for a permissionless L1.',
    path: '/console/permissionless-l1s/query-staking',
    category: 'Permissionless L1s',
    icon: Search,
  },
  {
    name: 'Submit Uptime Proof',
    description: 'Submit a P-Chain uptime proof for a validator.',
    path: '/console/permissionless-l1s/submit-uptime-proof',
    category: 'Permissionless L1s',
    icon: ShieldCheck,
  },

  // ── Interchain Messaging ─────────────────────────────────
  {
    name: 'ICM Setup',
    description: 'Deploy Interchain Messaging contracts on your L1.',
    path: '/console/icm/setup',
    category: 'Interchain Messaging',
    icon: MessagesSquare,
    featured: true,
  },
  {
    name: 'ICM Test Connection',
    description: 'Deploy ICM demo contracts and exchange test messages.',
    path: '/console/icm/test-connection',
    category: 'Interchain Messaging',
    icon: MessagesSquare,
  },
  {
    name: 'ICTT Setup',
    description: 'Deploy an Interchain Token Transfer bridge.',
    path: '/console/ictt/setup',
    category: 'Interchain Messaging',
    icon: Workflow,
  },
  {
    name: 'Token Transfer Test',
    description: 'Test token transfers across chains using your bridge.',
    path: '/console/ictt/token-transfer',
    category: 'Interchain Messaging',
    icon: ArrowLeftRight,
  },

  // ── L1 Management ────────────────────────────────────────
  {
    name: 'L1 Node Setup',
    description: 'Configure and run a node for your L1 network.',
    path: '/console/layer-1/l1-node-setup',
    category: 'L1 Management',
    icon: Server,
  },
  {
    name: 'Explorer Setup',
    description: 'Deploy a block explorer for your L1.',
    path: '/console/layer-1/explorer-setup',
    category: 'L1 Management',
    icon: Telescope,
  },
  {
    name: 'Performance Monitor',
    description: 'Monitor your L1 node performance and health.',
    path: '/console/layer-1/performance-monitor',
    category: 'L1 Management',
    icon: Activity,
  },
  {
    name: 'Fee Parameters',
    description: 'Configure gas fee parameters for your L1.',
    path: '/console/l1-tokenomics/fee-manager',
    category: 'L1 Management',
    icon: Coins,
  },
  {
    name: 'Fee Distributions',
    description: 'Set up fee reward distributions for your L1.',
    path: '/console/l1-tokenomics/reward-manager',
    category: 'L1 Management',
    icon: Coins,
  },
  {
    name: 'Mint Native Coins',
    description: 'Mint new native tokens on your L1.',
    path: '/console/l1-tokenomics/native-minter',
    category: 'L1 Management',
    icon: Coins,
  },
  {
    name: 'Deployer Allowlist',
    description: 'Control which addresses can deploy contracts.',
    path: '/console/l1-access-restrictions/deployer-allowlist',
    category: 'L1 Management',
    icon: ShieldCheck,
  },
  {
    name: 'Transactor Allowlist',
    description: 'Control which addresses can send transactions.',
    path: '/console/l1-access-restrictions/transactor-allowlist',
    category: 'L1 Management',
    icon: ShieldUser,
  },
  {
    name: 'Query Validator Set',
    description: 'View the current validator set for your L1.',
    path: '/console/layer-1/validator-set',
    category: 'L1 Management',
    icon: Hexagon,
  },
  {
    name: 'L1 Validator Balance',
    description: 'Check and top-up validator P-Chain balances.',
    path: '/console/layer-1/l1-validator-balance',
    category: 'L1 Management',
    icon: Coins,
  },

  // ── Utilities ────────────────────────────────────────────
  {
    name: 'Testnet Nodes',
    description: 'Spin up managed testnet nodes for development.',
    path: '/console/testnet-infra/nodes',
    category: 'Utilities',
    icon: Server,
  },
  {
    name: 'ICM Relayer',
    description: 'Run an ICM relayer for cross-chain message delivery.',
    path: '/console/testnet-infra/icm-relayer',
    category: 'Utilities',
    icon: Layers,
  },
  {
    name: 'Format Converter',
    description: 'Convert between Avalanche address and ID formats.',
    path: '/console/utilities/format-converter',
    category: 'Utilities',
    icon: Wrench,
  },
  {
    name: 'Unit Converter',
    description: 'Convert between AVAX, nAVAX, and wei denominations.',
    path: '/console/primary-network/unit-converter',
    category: 'Utilities',
    icon: Calculator,
  },
  {
    name: 'Transfer Proxy Admin',
    description: 'Transfer proxy admin ownership of a contract.',
    path: '/console/utilities/transfer-proxy-admin',
    category: 'Utilities',
    icon: Wrench,
  },
  {
    name: 'VMC Migration (V1 to V2)',
    description: 'Migrate Validator Manager Contract from V1 to V2.',
    path: '/console/utilities/vmcMigrateFromV1',
    category: 'Utilities',
    icon: Wrench,
  },
  {
    name: 'Revert PoA Manager',
    description: 'Revert a Proof of Authority manager to its previous state.',
    path: '/console/utilities/revert-poa-manager',
    category: 'Utilities',
    icon: Wrench,
  },

  // ── Encrypted ERC ────────────────────────────────────────
  // Surfaced in the toolbox so every sub-tool stays searchable even though
  // the sidebar group has been slimmed to Overview + Deploy. Overview is
  // the in-page hub linking the rest.
  {
    name: 'Encrypted ERC Overview',
    description: 'Hub for the Encrypted ERC suite — register, deposit, transfer, withdraw, audit.',
    path: '/console/encrypted-erc/overview',
    category: 'Encrypted ERC',
    icon: BookOpen,
    featured: true,
  },
  {
    name: 'Register Keys',
    description: 'Derive and publish a BabyJubJub identity to the Encrypted ERC Registrar.',
    path: '/console/encrypted-erc/register',
    category: 'Encrypted ERC',
    icon: Key,
  },
  {
    name: 'Deposit / Mint',
    description: 'Wrap an ERC20 or native token into encrypted balance.',
    path: '/console/encrypted-erc/deposit',
    category: 'Encrypted ERC',
    icon: ArrowDownToLine,
    subSteps: [
      { name: 'Wrap AVAX', path: '/console/encrypted-erc/deposit/wrap-avax' },
      { name: 'Deposit', path: '/console/encrypted-erc/deposit/deposit' },
    ],
  },
  {
    name: 'Private Transfer',
    description: 'Send encrypted amounts via Groth16 zk-SNARK proofs.',
    path: '/console/encrypted-erc/transfer',
    category: 'Encrypted ERC',
    icon: Send,
  },
  {
    name: 'Withdraw / Burn',
    description: 'Burn encrypted balance back to a public ERC20.',
    path: '/console/encrypted-erc/withdraw',
    category: 'Encrypted ERC',
    icon: ArrowUpFromLine,
  },
  {
    name: 'Balance & History',
    description: 'Decrypt your encrypted balance and inspect raw ciphertexts.',
    path: '/console/encrypted-erc/balance',
    category: 'Encrypted ERC',
    icon: Eye,
  },
  {
    name: 'Auditor View',
    description: 'Auditor-side decryption of every transfer for compliance review.',
    path: '/console/encrypted-erc/auditor',
    category: 'Encrypted ERC',
    icon: ShieldCheck,
  },
  {
    name: 'Deploy Your Own',
    description: 'Six-step wizard to deploy the Encrypted ERC suite on your own L1.',
    path: '/console/encrypted-erc/deploy',
    category: 'Encrypted ERC',
    icon: Rocket,
    subSteps: [
      { name: 'Configure', path: '/console/encrypted-erc/deploy/configure' },
      { name: 'Deploy BabyJubJub', path: '/console/encrypted-erc/deploy/deploy-library' },
      { name: 'Deploy Verifiers', path: '/console/encrypted-erc/deploy/deploy-verifiers' },
      { name: 'Deploy Registrar', path: '/console/encrypted-erc/deploy/deploy-registrar' },
      { name: 'Deploy EncryptedERC', path: '/console/encrypted-erc/deploy/deploy-eerc' },
      { name: 'Register + Set Auditor', path: '/console/encrypted-erc/deploy/finalize' },
    ],
  },
  {
    name: 'Set Auditor',
    description: 'Designate the auditor public key for a deployed Encrypted ERC.',
    path: '/console/encrypted-erc/deploy/auditor',
    category: 'Encrypted ERC',
    icon: UserCheck,
  },
];

// Sub-step catalogue auto-derived from each flow's `steps.ts`. Keyed by the
// tool's canonical path so the merge below picks the right entries. Tools
// that already declare inline `subSteps` (Create L1, VMC Setup, Encrypted
// ERC Deposit/Deploy) keep those — the inline list is hand-curated and may
// add affordances the auto-extract doesn't see.
//
// To regenerate (when new steps are added): run `node /tmp/extract-substeps.js`
// from the repo root — it walks every `steps.ts` and prints the JSON we paste
// here.
const FLOW_SUBSTEPS: Record<string, Array<{ name: string; path: string }>> = {
  '/console/permissioned-l1s/add-validator': [
    { name: 'Select L1 Subnet', path: '/console/permissioned-l1s/add-validator/select-subnet' },
    { name: 'Initiate Validator Registration', path: '/console/permissioned-l1s/add-validator/validator-details' },
    { name: 'P-Chain Registration', path: '/console/permissioned-l1s/add-validator/pchain-registration' },
    { name: 'Complete Registration', path: '/console/permissioned-l1s/add-validator/complete-registration' },
    { name: 'Verify Validator Set', path: '/console/permissioned-l1s/add-validator/verify-validator-set' },
  ],
  '/console/permissioned-l1s/change-validator-weight': [
    { name: 'Select L1 Subnet', path: '/console/permissioned-l1s/change-validator-weight/select-subnet' },
    {
      name: 'Initiate Weight Change',
      path: '/console/permissioned-l1s/change-validator-weight/initiate-weight-change',
    },
    { name: 'P-Chain Weight Update', path: '/console/permissioned-l1s/change-validator-weight/pchain-weight-update' },
    {
      name: 'Complete Weight Change',
      path: '/console/permissioned-l1s/change-validator-weight/complete-weight-change',
    },
    { name: 'Verify Validator Set', path: '/console/permissioned-l1s/change-validator-weight/verify-validator-set' },
  ],
  '/console/permissioned-l1s/multisig-setup': [
    { name: 'Deploy POA Manager', path: '/console/permissioned-l1s/multisig-setup/deploy-poa-manager' },
    { name: 'Read PoA Manager', path: '/console/permissioned-l1s/multisig-setup/read-poa-manager' },
    { name: 'Transfer Ownership', path: '/console/permissioned-l1s/multisig-setup/transfer-ownership' },
    { name: 'Read Validator Manager', path: '/console/permissioned-l1s/multisig-setup/read-validator-manager' },
  ],
  '/console/permissioned-l1s/remove-validator': [
    { name: 'Select L1 Subnet', path: '/console/permissioned-l1s/remove-validator/select-subnet' },
    { name: 'Initiate Removal', path: '/console/permissioned-l1s/remove-validator/initiate-removal' },
    { name: 'P-Chain Weight Update', path: '/console/permissioned-l1s/remove-validator/pchain-removal' },
    { name: 'Complete Removal', path: '/console/permissioned-l1s/remove-validator/complete-removal' },
    { name: 'Verify Validator Set', path: '/console/permissioned-l1s/remove-validator/verify-validator-set' },
  ],
  '/console/permissionless-l1s/native-staking-manager-setup': [
    { name: 'Deploy Native Staking Manager', path: '/console/permissionless-l1s/native-staking-manager-setup/deploy' },
    {
      name: 'Deploy Reward Calculator',
      path: '/console/permissionless-l1s/native-staking-manager-setup/deploy-reward-calculator',
    },
    { name: 'Initialize Staking Manager', path: '/console/permissionless-l1s/native-staking-manager-setup/initialize' },
    {
      name: 'Enable Staking Manager Minting',
      path: '/console/permissionless-l1s/native-staking-manager-setup/enable-minting',
    },
    { name: 'Transfer Ownership', path: '/console/permissionless-l1s/native-staking-manager-setup/transfer-ownership' },
    { name: 'Read Contract', path: '/console/permissionless-l1s/native-staking-manager-setup/read-contract' },
  ],
  '/console/permissionless-l1s/erc20-staking-manager-setup': [
    {
      name: 'Deploy ERC20 Token (Optional)',
      path: '/console/permissionless-l1s/erc20-staking-manager-setup/deploy-erc20-token',
    },
    { name: 'Deploy ERC20 Staking Manager', path: '/console/permissionless-l1s/erc20-staking-manager-setup/deploy' },
    {
      name: 'Deploy Reward Calculator',
      path: '/console/permissionless-l1s/erc20-staking-manager-setup/deploy-reward-calculator',
    },
    { name: 'Initialize Staking Manager', path: '/console/permissionless-l1s/erc20-staking-manager-setup/initialize' },
    {
      name: 'Enable Staking Manager Minting',
      path: '/console/permissionless-l1s/erc20-staking-manager-setup/enable-minting',
    },
    { name: 'Transfer Ownership', path: '/console/permissionless-l1s/erc20-staking-manager-setup/transfer-ownership' },
    { name: 'Read Contract', path: '/console/permissionless-l1s/erc20-staking-manager-setup/read-contract' },
  ],
  '/console/permissionless-l1s/stake/native': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/stake/native/select-subnet' },
    { name: 'Initiate Registration', path: '/console/permissionless-l1s/stake/native/initiate-registration' },
    { name: 'P-Chain Registration', path: '/console/permissionless-l1s/stake/native/pchain-registration' },
    { name: 'Complete Registration', path: '/console/permissionless-l1s/stake/native/complete-registration' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/stake/native/verify-validator-set' },
  ],
  '/console/permissionless-l1s/stake/erc20': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/stake/erc20/select-subnet' },
    { name: 'Initiate Registration', path: '/console/permissionless-l1s/stake/erc20/initiate-registration' },
    { name: 'P-Chain Registration', path: '/console/permissionless-l1s/stake/erc20/pchain-registration' },
    { name: 'Complete Registration', path: '/console/permissionless-l1s/stake/erc20/complete-registration' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/stake/erc20/verify-validator-set' },
  ],
  '/console/permissionless-l1s/delegate/native': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/delegate/native/select-l1' },
    { name: 'Initiate Delegation', path: '/console/permissionless-l1s/delegate/native/initiate-delegation' },
    { name: 'P-Chain Weight Update', path: '/console/permissionless-l1s/delegate/native/pchain-weight-update' },
    { name: 'Complete Delegation', path: '/console/permissionless-l1s/delegate/native/complete-delegation' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/delegate/native/verify-validator-set' },
  ],
  '/console/permissionless-l1s/delegate/erc20': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/delegate/erc20/select-l1' },
    { name: 'Initiate Delegation', path: '/console/permissionless-l1s/delegate/erc20/initiate-delegation' },
    { name: 'P-Chain Weight Update', path: '/console/permissionless-l1s/delegate/erc20/pchain-weight-update' },
    { name: 'Complete Delegation', path: '/console/permissionless-l1s/delegate/erc20/complete-delegation' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/delegate/erc20/verify-validator-set' },
  ],
  // The "Remove Validator" tile in the Permissionless category routes to the
  // -uptime variant (with uptime proof); the "Force Remove" tile routes to
  // the no-uptime variant. Sub-steps follow the path, not the display name.
  '/console/permissionless-l1s/remove-validator-uptime': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/remove-validator-uptime/select-l1' },
    { name: 'Initiate Removal (Uptime)', path: '/console/permissionless-l1s/remove-validator-uptime/initiate-removal' },
    { name: 'P-Chain Weight Update', path: '/console/permissionless-l1s/remove-validator-uptime/pchain-weight-update' },
    { name: 'Complete Removal', path: '/console/permissionless-l1s/remove-validator-uptime/complete-removal' },
    { name: 'Claim Delegation Fees', path: '/console/permissionless-l1s/remove-validator-uptime/claim-fees' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/remove-validator-uptime/verify-validator-set' },
  ],
  '/console/permissionless-l1s/remove-validator': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/remove-validator/select-l1' },
    { name: 'Initiate Removal', path: '/console/permissionless-l1s/remove-validator/initiate-removal' },
    { name: 'P-Chain Weight Update', path: '/console/permissionless-l1s/remove-validator/pchain-weight-update' },
    { name: 'Complete Removal', path: '/console/permissionless-l1s/remove-validator/complete-removal' },
    { name: 'Claim Delegation Fees', path: '/console/permissionless-l1s/remove-validator/claim-fees' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/remove-validator/verify-validator-set' },
  ],
  '/console/permissionless-l1s/remove-delegation': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/remove-delegation/select-l1' },
    { name: 'Initiate Delegator Removal', path: '/console/permissionless-l1s/remove-delegation/initiate-removal' },
    { name: 'P-Chain Weight Update', path: '/console/permissionless-l1s/remove-delegation/pchain-weight-update' },
    { name: 'Complete Delegator Removal', path: '/console/permissionless-l1s/remove-delegation/complete-removal' },
    { name: 'Verify Validator Set', path: '/console/permissionless-l1s/remove-delegation/verify-validator-set' },
  ],
  '/console/permissionless-l1s/submit-uptime-proof': [
    { name: 'Select L1 Subnet', path: '/console/permissionless-l1s/submit-uptime-proof/select-l1' },
    { name: 'Validator Uptimes', path: '/console/permissionless-l1s/submit-uptime-proof/dashboard' },
  ],
  '/console/icm/setup': [
    { name: 'Deploy Teleporter Messenger', path: '/console/icm/setup/icm-messenger' },
    { name: 'Deploy Teleporter Registry', path: '/console/icm/setup/icm-registry' },
    { name: 'Setup ICM Relayer', path: '/console/icm/setup/icm-relayer-type' },
    { name: 'Deploy ICM Demo', path: '/console/icm/setup/deploy-icm-demo' },
    { name: 'Send ICM Message', path: '/console/icm/setup/send-icm-demo-message' },
  ],
  '/console/icm/test-connection': [
    { name: 'Deploy ICM Demo', path: '/console/icm/test-connection/deploy-icm-demo' },
    { name: 'Send ICM Message', path: '/console/icm/test-connection/send-icm-demo-message' },
  ],
  '/console/ictt/setup': [
    { name: 'Deploy Token Home', path: '/console/ictt/setup/deploy-token-home' },
    { name: 'Register With Home', path: '/console/ictt/setup/register-with-home' },
    { name: 'Add Collateral', path: '/console/ictt/setup/add-collateral' },
  ],
  '/console/ictt/token-transfer': [
    { name: 'Add Collateral', path: '/console/ictt/token-transfer/add-collateral' },
    { name: 'Test Send', path: '/console/ictt/token-transfer/test-send' },
  ],
  '/console/utilities/vmcMigrateFromV1': [
    { name: 'Deploy Validator Manager v2', path: '/console/utilities/vmcMigrateFromV1/deploy-validator-manager' },
    { name: 'Upgrade Proxy', path: '/console/utilities/vmcMigrateFromV1/upgrade-proxy' },
    { name: 'Query L1 Validators', path: '/console/utilities/vmcMigrateFromV1/query-validators' },
    { name: 'Migrate Validators', path: '/console/utilities/vmcMigrateFromV1/migrate-validators' },
  ],
};

// Hydrate sub-steps from FLOW_SUBSTEPS for any tool that doesn't already
// declare them inline. Inline always wins so the hand-curated entries
// (e.g. "Managed Testnet L1 Nodes" under Create L1) survive.
export const TOOLS: ToolCard[] = TOOLS_RAW.map((t) =>
  t.subSteps || !FLOW_SUBSTEPS[t.path] ? t : { ...t, subSteps: FLOW_SUBSTEPS[t.path] },
);

// Order in which categories render in the toolbox grid.
export const CATEGORY_ORDER = [
  'Primary Network',
  'Create & Deploy',
  'Permissioned L1s',
  'Permissionless L1s',
  'Interchain Messaging',
  'L1 Management',
  'Encrypted ERC',
  'Utilities',
];
