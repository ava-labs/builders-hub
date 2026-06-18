/**
 * Builder Console awareness tool domain.
 *
 * The MCP can't operate the Console UI, but it should understand the flows it
 * steers users to. Consolidated to a single `console_flow` tool: call it with no
 * `flow` to LIST every flow (summaries + links), or with a `flow` to EXPLAIN one
 * (ordered steps, equivalent CLI, signs-transactions flag, deep-link). The CLI
 * strings come from the canonical command map so they never drift.
 */

import type { ToolDomain, ToolResult } from '../types';
import { CLI } from './lib/platform-cli-commands';

const CONSOLE_BASE = 'https://build.avax.network/console';

interface ConsoleFlow {
  key: string;
  title: string;
  path: string;
  summary: string;
  steps: string[];
  equivalentCli?: string;
  signs: boolean; // whether the flow issues wallet-signed transactions
}

const FLOWS: ConsoleFlow[] = [
  {
    key: 'create-l1',
    title: 'Create an L1 (Quick Build)',
    path: '/primary-network/l1/create',
    summary: 'No-code creation of a new Avalanche L1: configure genesis, choose a validator manager, and deploy.',
    steps: [
      'Choose VM (Subnet-EVM or custom) and set genesis (chain ID, native token, precompiles)',
      'Create the subnet (CreateSubnetTx) and add the blockchain (CreateChainTx)',
      'Choose the validator manager (PoA / PoS-native / PoS-ERC20)',
      'Convert the subnet to an L1 (ConvertSubnetToL1Tx) and initialize the validator set',
      'Connect a node / managed testnet node and connect Core wallet',
    ],
    equivalentCli: `${CLI.subnetCreate} → ${CLI.subnetConvertL1} → ${CLI.l1RegisterValidator}`,
    signs: true,
  },
  {
    key: 'convert-to-l1',
    title: 'Convert a subnet to an L1',
    path: '/primary-network/l1/convert',
    summary: 'Convert an existing subnet into a sovereign L1 by pointing it at a validator manager contract.',
    steps: [
      'Select the subnet to convert and the target chain ID',
      'Deploy or reference the validator manager contract (on the L1 or C-Chain)',
      'Issue ConvertSubnetToL1Tx with the manager address and initial validators',
    ],
    equivalentCli: `${CLI.subnetConvertL1} --subnet-id <id> --chain-id <id> --manager <addr>`,
    signs: true,
  },
  {
    key: 'validator-manager',
    title: 'Validator manager setup',
    path: '/primary-network/l1/validator-manager',
    summary: 'Deploy and initialize the ACP-99 ValidatorManager (PoA or PoS) that governs an L1 validator set.',
    steps: [
      'Deploy the manager contract (or use the genesis-predeployed proxy)',
      'Initialize ownership / staking parameters',
      'Initialize the validator set; thereafter add/remove validators via the contract',
    ],
    equivalentCli: `${CLI.l1RegisterValidator} / ${CLI.l1SetWeight} / ${CLI.l1DisableValidator}`,
    signs: true,
  },
  {
    key: 'ictt',
    title: 'Interchain Token Transfer (ICTT)',
    path: '/icm/ictt',
    summary: 'Bridge ERC-20 or native tokens between Avalanche chains using Teleporter/ICM.',
    steps: [
      'Pick the token and home chain; deploy the TokenHome contract',
      'Deploy the TokenRemote contract on the destination chain',
      'Register the remote with the home (cross-chain message)',
      'Add collateral on the home, then transfer tokens (relayer delivers to the remote)',
    ],
    equivalentCli: '@avalanche-sdk/interchain (createICTTClient) deploy → register → collateral → send',
    signs: true,
  },
  {
    key: 'faucet',
    title: 'Testnet faucet',
    path: '/primary-network/faucet',
    summary: 'Request Fuji testnet AVAX to fund a P-Chain or C-Chain address before deploying.',
    steps: ['Connect/enter an address', 'Request testnet AVAX (Fuji only)'],
    signs: false,
  },
  {
    key: 'multisig',
    title: 'Multisig / Safe',
    path: '/primary-network/multisig',
    summary: 'Set up a Safe multisig as the owner/admin of an L1 (Builder Console pre-deploys the Safe Singleton at genesis).',
    steps: [
      'Use the genesis-predeployed Safe Singleton',
      'Deploy the remaining Safe contracts (ProxyFactory, MultiSend, FallbackHandler)',
      'Create the Safe and assign it as the validator-manager owner',
    ],
    signs: true,
  },
  {
    key: 'staking',
    title: 'Stake / validate the Primary Network',
    path: '/primary-network/stake',
    summary: 'Become a Primary Network validator or delegate stake to one.',
    steps: [
      'Fund a P-Chain address and get your node\'s NodeID + BLS proof-of-possession',
      'Add yourself as a permissionless validator (stake amount + duration)',
      '(optional) Delegate additional stake to an existing validator',
    ],
    equivalentCli: `${CLI.validatorAdd} / ${CLI.validatorDelegate}`,
    signs: true,
  },
  {
    key: 'transfers',
    title: 'Transfer AVAX (P ↔ C)',
    path: '/primary-network/transfer',
    summary: 'Move AVAX between addresses or cross-chain between the P-Chain and C-Chain.',
    steps: ['Pick source/destination chain and address', 'Enter amount and sign (export + import for cross-chain)'],
    equivalentCli: `${CLI.transferSend} / ${CLI.transferPtoC} / ${CLI.transferCtoP}`,
    signs: true,
  },
  {
    key: 'interchain-kit-local',
    title: 'interchain-kit (local cross-chain dev)',
    path: '/icm/ictt',
    summary: 'Iterate on ICM/ICTT against a real local tmpnet (Teleporter + relayer + signature-aggregator) before deploying to Fuji.',
    steps: [
      'pnpm install, then `pnpm run up` (tmpnetjs) to boot the local network + relayer (:8080) + aggregator (:8090)',
      'Run an example from examples/ (send-message, transfer-token, validator-manager-setup, add-validator)',
      '`pnpm run down` to tear the network down',
    ],
    equivalentCli: 'pnpm run up → pnpm tsx examples/<name>.ts → pnpm run down',
    signs: true,
  },
];

function flowLink(f: ConsoleFlow): string {
  return `${CONSOLE_BASE}${f.path}`;
}

export const consoleTools: ToolDomain = {
  tools: [
    {
      name: 'console_flow',
      description:
        'Builder Console flow knowledge. Call with NO `flow` to list every flow (summaries + deep-links); call with a `flow` key to explain it (ordered steps, equivalent CLI, whether it signs transactions, deep-link). Flows: create-l1, convert-to-l1, validator-manager, ictt, faucet, multisig, staking, transfers, interchain-kit-local.',
      inputSchema: {
        type: 'object',
        properties: {
          flow: {
            type: 'string',
            enum: FLOWS.map((f) => f.key),
            description: 'Flow key to explain. Omit to list all flows.',
          },
        },
        required: [],
      },
    },
  ],

  handlers: {
    console_flow: async (args): Promise<ToolResult> => {
      const key = typeof args.flow === 'string' ? args.flow.trim() : '';

      // No key → list every flow.
      if (!key) {
        const t = [
          '# Builder Console flows',
          '',
          ...FLOWS.map((f) => `- **${f.key}** — ${f.title}: ${f.summary}\n  ${flowLink(f)}`),
          '',
          'Call console_flow with a `flow` key for the step-by-step explanation.',
        ].join('\n');
        return { content: [{ type: 'text', text: t }] };
      }

      // Key → explain one flow.
      const flow = FLOWS.find((f) => f.key === key);
      if (!flow) {
        return {
          content: [{ type: 'text', text: `Unknown console flow "${key}". Available: ${FLOWS.map((f) => f.key).join(', ')}.` }],
          isError: true,
        };
      }
      const lines = [
        `# ${flow.title} (${flow.key})`,
        flow.summary,
        '',
        `Deep-link: ${flowLink(flow)}`,
        `Signs transactions: ${flow.signs ? 'yes (wallet-signed)' : 'no'}`,
        '',
        '## Steps',
        ...flow.steps.map((s, i) => `${i + 1}. ${s}`),
        ...(flow.equivalentCli ? ['', `Equivalent CLI: ${flow.equivalentCli}`] : []),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  },
};
