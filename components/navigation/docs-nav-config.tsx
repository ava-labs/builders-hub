import { 
  Network,
  Layers,
  Cable,
  Server,
  Database,
  Activity,
  Webhook,
  Code,
  CircleDollarSign,
  Package,
  Terminal,
  Milestone
} from 'lucide-react';

export const documentationOptions = [
  {
    title: 'Primary Network',
    description: 'Core platform infrastructure',
    icon: <Network className="w-5 h-5" />,
    url: '/docs/primary-network',
  },
  {
    title: 'Avalanche L1s',
    description: 'Build your own blockchain',
    icon: <Layers className="w-5 h-5" />,
    url: '/docs/avalanche-l1s',
  },
  {
    title: 'Interop',
    description: 'Cross-chain messaging',
    icon: <Cable className="w-5 h-5" />,
    url: '/docs/cross-chain',
  },
  {
    title: 'AvalancheGo Node',
    description: 'Run nodes and validators',
    icon: <Server className="w-5 h-5" />,
    url: '/docs/nodes',
  },
];

export const apiReferenceOptions = [
  {
    title: 'Data API',
    description: 'Access blockchain data',
    icon: <Database className="w-5 h-5" />,
    url: '/docs/api-reference/data-api',
  },
  {
    title: 'Metrics API',
    description: 'Network metrics and statistics',
    icon: <Activity className="w-5 h-5" />,
    url: '/docs/api-reference/metrics-api',
  },
  {
    title: 'Webhook API',
    description: 'Real-time blockchain notifications',
    icon: <Webhook className="w-5 h-5" />,
    url: '/docs/api-reference/webhook-api',
  },
];

export const rpcsOptions = [
  {
    title: 'C-Chain RPC',
    description: 'Contract Chain RPC methods',
    icon: <Code className="w-5 h-5" />,
    url: '/docs/rpcs/c-chain',
  },
  {
    title: 'P-Chain RPC',
    description: 'Platform Chain RPC methods',
    icon: <Server className="w-5 h-5" />,
    url: '/docs/rpcs/p-chain',
  },
  {
    title: 'X-Chain RPC',
    description: 'Exchange Chain RPC methods',
    icon: <CircleDollarSign className="w-5 h-5" />,
    url: '/docs/rpcs/x-chain',
  },
  {
    title: 'Subnet-EVM RPC',
    description: 'Subnet-EVM RPC methods',
    icon: <Network className="w-5 h-5" />,
    url: '/docs/rpcs/subnet-evm',
  },
  {
    title: 'Other RPCs',
    description: 'Additional RPC APIs',
    icon: <Webhook className="w-5 h-5" />,
    url: '/docs/rpcs/other',
  },
];

export const toolingOptions = [
  {
    title: 'Avalanche-SDK',
    description: 'Software development kit for Avalanche',
    icon: <Package className="w-5 h-5" />,
    url: '/docs/tooling/avalanche-sdk',
  },
  {
    title: 'Avalanche-CLI',
    description: 'Command-line interface for Avalanche',
    icon: <Terminal className="w-5 h-5" />,
    url: '/docs/tooling/avalanche-cli',
  },
  {
    title: "Postman Collection",
    description: 'Postman collection for Avalanche APIs',
    icon: <Milestone className="w-5 h-5" />,
    url: '/docs/tooling/avalanche-postman',
  },
];

