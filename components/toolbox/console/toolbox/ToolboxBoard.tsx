'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  Droplets,
  BookKey,
  HandCoins,
  Server,
  ArrowLeftRight,
  ArrowUpDown,
  Bell,
  Layers,
  LayoutDashboard,
  SquareTerminal,
  ShieldUser,
  SquarePlus,
  SquareMinus,
  SlidersVertical,
  ShieldOff,
  GitMerge,
  MessagesSquare,
  Workflow,
  Telescope,
  Activity,
  Coins,
  ShieldCheck,
  Hexagon,
  Wrench,
  Calculator,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCard {
  name: string;
  description: string;
  path: string;
  category: string;
  icon: LucideIcon;
  external?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Primary Network': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Create & Deploy': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Permissioned L1s': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Permissionless L1s': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Interchain Messaging': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'L1 Management': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  Utilities: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-300',
};

const TOOLS: ToolCard[] = [
  // ── Primary Network ──────────────────────────────────────
  {
    name: 'Testnet Faucet',
    description: 'Get free testnet AVAX for development and testing.',
    path: '/console/primary-network/faucet',
    category: 'Primary Network',
    icon: Droplets,
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

  // ── Create & Deploy ──────────────────────────────────────
  {
    name: 'Create L1',
    description: 'Launch a new Avalanche L1 with a guided wizard.',
    path: '/console/layer-1/create',
    category: 'Create & Deploy',
    icon: Layers,
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

  // ── Interchain Messaging ─────────────────────────────────
  {
    name: 'ICM Setup',
    description: 'Deploy Interchain Messaging contracts on your L1.',
    path: '/console/icm/setup',
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
];

// Preserve sidebar ordering
const CATEGORY_ORDER = [
  'Primary Network',
  'Create & Deploy',
  'Permissioned L1s',
  'Permissionless L1s',
  'Interchain Messaging',
  'L1 Management',
  'Utilities',
];

export default function ToolboxBoard() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return TOOLS;
    const q = search.toLowerCase();
    return TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ToolCard[]>();
    for (const tool of filtered) {
      const existing = map.get(tool.category) ?? [];
      existing.push(tool);
      map.set(tool.category, existing);
    }
    // Return in sidebar order
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      tools: map.get(c)!,
    }));
  }, [filtered]);

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Console Toolbox</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            All tools in one place. Click any card to jump straight in.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-9 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {grouped.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No tools match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ category, tools }) => (
            <section key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                {category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const card = (
                    <div
                      className={cn(
                        'group rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900',
                        'p-4 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm',
                        'transition-all duration-150 cursor-pointer flex flex-col gap-3',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-2">
                            <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                          </div>
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {tool.name}
                          </span>
                        </div>
                        {tool.external && (
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors" />
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {tool.description}
                      </p>
                      <span
                        className={cn(
                          'self-start rounded-full px-2 py-0.5 text-[10px] font-medium',
                          CATEGORY_COLORS[tool.category] ??
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                        )}
                      >
                        {tool.category}
                      </span>
                    </div>
                  );

                  if (tool.external) {
                    return (
                      <a key={tool.path} href={tool.path} target="_blank" rel="noopener noreferrer">
                        {card}
                      </a>
                    );
                  }

                  return (
                    <Link key={tool.path} href={tool.path}>
                      {card}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
        {filtered.length} tool{filtered.length !== 1 ? 's' : ''} across {grouped.length} categor
        {grouped.length !== 1 ? 'ies' : 'y'}
      </div>
    </div>
  );
}
