/**
 * Builder Console awareness tool domain.
 *
 * The MCP can't operate the Console UI, but it should understand the flows it
 * steers users to. These tools describe each flow — what it does, the ordered
 * steps, the equivalent CLI, and a deep-link — from a static manifest.
 */

import type { ToolDomain, ToolResult } from '../types';

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
    equivalentCli: 'platform subnet create → platform subnet convert-l1 → platform l1 register-validator',
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
    equivalentCli: 'platform subnet convert-l1 --subnet-id <id> --chain-id <id> --manager <addr>',
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
    equivalentCli: 'platform l1 register-validator / set-weight / disable-validator',
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
];

function flowLink(f: ConsoleFlow): string {
  return `${CONSOLE_BASE}${f.path}`;
}

export const consoleTools: ToolDomain = {
  tools: [
    {
      name: 'console_list_flows',
      description:
        'List the Builder Console flows the MCP knows about (create-l1, convert-to-l1, validator-manager, ictt, faucet, multisig) with summaries and deep-links.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'console_explain_flow',
      description:
        'Explain a specific Builder Console flow — what it does, its ordered steps, the equivalent CLI, whether it signs transactions, and a deep-link.',
      inputSchema: {
        type: 'object',
        properties: {
          flow: {
            type: 'string',
            enum: FLOWS.map((f) => f.key),
            description: 'The console flow key to explain',
          },
        },
        required: ['flow'],
      },
    },
  ],

  handlers: {
    console_list_flows: async (): Promise<ToolResult> => {
      const text = [
        '# Builder Console flows',
        '',
        ...FLOWS.map((f) => `- **${f.key}** — ${f.title}: ${f.summary}\n  ${flowLink(f)}`),
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    },

    console_explain_flow: async (args): Promise<ToolResult> => {
      const key = typeof args.flow === 'string' ? args.flow.trim() : '';
      const flow = FLOWS.find((f) => f.key === key);
      if (!flow) {
        return {
          content: [
            {
              type: 'text',
              text: `Unknown console flow "${key}". Available: ${FLOWS.map((f) => f.key).join(', ')}.`,
            },
          ],
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
