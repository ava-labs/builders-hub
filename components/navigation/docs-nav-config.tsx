import React from 'react';
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
  Milestone,
  Book,
  Eye,
  Bot,
  AppWindow
} from 'lucide-react';

export type NavOption = {
  title: string;
  description: string;
  badge?: string;
  icon: React.ReactNode;
  url: string;
};

export const documentationOptions: NavOption[] = [
  {
    title: 'Primary Network',
    description: 'C-Chain, P-Chain, and X-Chain',
    icon: <Network className="w-5 h-5" />,
    url: '/docs/primary-network',
  },
  {
    title: 'Layer 1s',
    description: 'Build your own Avalanche blockchain',
    icon: <Layers className="w-5 h-5" />,
    url: '/docs/avalanche-l1s',
  },
  {
    title: 'Interchain Messaging',
    description: 'Interchain messaging protocol',
    icon: <Cable className="w-5 h-5" />,
    url: '/docs/cross-chain',
  },
];

export const nodesOptions: NavOption[] = [
  {
    title: 'AvalancheGo Node',
    description: 'Run nodes and validators',
    icon: <Server className="w-5 h-5" />,
    url: '/docs/nodes',
  },
  {
    title: 'C-Chain RPC',
    description: 'Contract Chain RPC reference',
    icon: <Code className="w-5 h-5" />,
    url: '/docs/rpcs/c-chain',
  },
  {
    title: 'P-Chain RPC',
    description: 'Platform Chain RPC reference',
    icon: <Server className="w-5 h-5" />,
    url: '/docs/rpcs/p-chain',
  },
  {
    title: 'X-Chain RPC',
    description: 'Exchange Chain RPC reference',
    icon: <CircleDollarSign className="w-5 h-5" />,
    url: '/docs/rpcs/x-chain',
  },
  {
    title: 'Subnet-EVM RPC',
    description: 'Subnet-EVM RPC reference',
    icon: <Network className="w-5 h-5" />,
    url: '/docs/rpcs/subnet-evm',
  },
  {
    title: 'Other RPCs',
    description: 'Additional RPC references',
    icon: <Webhook className="w-5 h-5" />,
    url: '/docs/rpcs/other',
  },
];

export const apiReferenceOptions: NavOption[] = [
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

export const toolingOptions: NavOption[] = [
  {
    title: 'AI & LLM',
    description: 'Integrate docs with AI apps and LLMs',
    badge: 'New',
    icon: <Bot className="w-5 h-5" />,
    url: '/docs/tooling/ai-llm',
  },
  {
    title: 'Builder Console',
    description: 'Interactive tools with Core wallet in browser',
    badge: 'New',
    icon: <AppWindow className="w-5 h-5" />,
    url: '/console',
  },
  {
    title: 'Platform CLI',
    description: 'P-Chain operations: staking, subnets, transfers',
    badge: 'New',
    icon: <Terminal className="w-5 h-5" />,
    url: '/docs/tooling/platform-cli',
  },
  {
    title: 'Avalanche-SDK',
    description: 'TypeScript SDK for Avalanche',
    icon: <Package className="w-5 h-5" />,
    url: '/docs/tooling/avalanche-sdk',
  },
  {
    title: 'tmpnet',
    description: 'Temporary networks for local testing',
    icon: <Network className="w-5 h-5" />,
    url: '/docs/tooling/tmpnet',
  },
  {
    title: "Postman Collection",
    description: 'Postman collection for Avalanche APIs',
    icon: <Milestone className="w-5 h-5" />,
    url: '/docs/tooling/avalanche-postman',
  },
  {
    title: 'Avalanche-CLI',
    description: 'Command-line interface for Avalanche',
    badge: 'Deprecated',
    icon: <Terminal className="w-5 h-5" />,
    url: '/docs/tooling/avalanche-cli',
  },
];


export const acpsOptions: NavOption[] = [
  {
    title: 'Streaming Asynchronous Execution',
    description: 'ACP-194',
    icon: <Book className="w-5 h-5" />,
    url: '/docs/acps/194-streaming-asynchronous-execution',
  },
  {
    title: 'Continuous Staking',
    description: 'ACP-236',
    icon: <Book className="w-5 h-5" />,
    url: '/docs/acps/236-continuous-staking',
  },
  {
    title: 'ValidatorManager Contract',
    description: 'ACP-99',
    icon: <Book className="w-5 h-5" />,
    url: '/docs/acps/99-validatorsetmanager-contract',
  },
  {
    title: "View All ACPs",
    description: 'View all Avalanche Community Proposals',
    icon: <Eye className="w-5 h-5" />,
    url: '/docs/acps',
  }
];