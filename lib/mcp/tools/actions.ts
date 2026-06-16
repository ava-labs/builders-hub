/**
 * Action / command-generation tool domain.
 *
 * The MCP server is hosted and keyless — it cannot sign or broadcast
 * transactions. These tools instead emit deterministic, copy-pasteable command
 * sequences (platform-cli, @avalanche-sdk/interchain) and Builder Console
 * deep-links that the user runs locally with their own key. They never execute
 * anything.
 */

import type { ToolDomain, ToolResult } from '../types';

const CONSOLE_BASE = 'https://build.avax.network/console';
const PLATFORM_CLI_DOCS = 'https://build.avax.network/docs/tooling/platform-cli';
const ICTT_DOCS = 'https://build.avax.network/docs/tooling/avalanche-sdk/interchain/ictt';

const NETWORKS = ['fuji', 'mainnet'] as const;
type ActionNetwork = (typeof NETWORKS)[number];

const VALIDATOR_MANAGERS = ['poa', 'pos-native', 'pos-erc20'] as const;
type ValidatorManager = (typeof VALIDATOR_MANAGERS)[number];

const CONSOLE_FLOWS = {
  'create-l1': '/primary-network/l1/create',
  'convert-to-l1': '/primary-network/l1/convert',
  'validator-manager': '/primary-network/l1/validator-manager',
  ictt: '/icm/ictt',
  faucet: '/primary-network/faucet',
  multisig: '/primary-network/multisig',
} as const;
type ConsoleFlow = keyof typeof CONSOLE_FLOWS;

function getString(args: Record<string, unknown>, key: string, fallback = ''): string {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function getNetwork(args: Record<string, unknown>): ActionNetwork {
  const n = getString(args, 'network', 'fuji');
  return (NETWORKS as readonly string[]).includes(n) ? (n as ActionNetwork) : 'fuji';
}

function text(t: string): ToolResult {
  return { content: [{ type: 'text', text: t }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

const NO_SIGN_NOTE =
  '_This is a plan you run yourself — the MCP does not sign or broadcast anything. ' +
  'Run the commands locally with your own key._';

const MIN_VALIDATOR_STAKE: Record<ActionNetwork, string> = {
  fuji: '1 AVAX',
  mainnet: '2,000 AVAX (Primary Network); L1 validator balance is a fee deposit, not stake',
};

// ---------------------------------------------------------------------------
// l1_build_plan
// ---------------------------------------------------------------------------

function buildL1Plan(args: Record<string, unknown>): ToolResult {
  const name = getString(args, 'name', 'myL1');
  const network = getNetwork(args);
  const chainId = getString(args, 'chainId', '<evm-chain-id>');
  const tokenSymbol = getString(args, 'tokenSymbol', 'TOK');
  const vmRaw = getString(args, 'vm', 'subnet-evm');
  const vm = vmRaw === 'custom' ? 'custom' : 'subnet-evm';
  const managerRaw = getString(args, 'validatorManager', 'poa');
  const manager = (VALIDATOR_MANAGERS as readonly string[]).includes(managerRaw)
    ? (managerRaw as ValidatorManager)
    : 'poa';

  const managerLabel = { poa: 'Proof of Authority', 'pos-native': 'Proof of Stake (native)', 'pos-erc20': 'Proof of Stake (ERC-20)' }[manager];

  const lines = [
    `# Plan: create L1 "${name}" (${network})`,
    `VM: ${vm} · Validator manager: ${managerLabel} · EVM chain ID: ${chainId} · Token: ${tokenSymbol}`,
    '',
    '## Option 1 — Quick Build (no-code, recommended)',
    `Create and deploy from the Builder Console: ${CONSOLE_BASE}${CONSOLE_FLOWS['create-l1']}`,
    'Pick the VM, set genesis (chain ID, token, precompiles), choose the validator manager, and deploy with your connected wallet.',
    '',
    '## Option 2 — platform-cli (scriptable)',
    '```bash',
    '# 0. Prerequisites: a funded P-Chain key and (fuji) testnet AVAX from the faucet.',
    'platform keys generate --key-name myKey   # or: platform keys import',
    '',
    '# 1. Create the subnet (records you as the owner)',
    `platform subnet create --key-name myKey --network ${network}`,
    '',
    '# 2. Convert the subnet to an L1 (deploys/points at a validator manager)',
    'platform subnet convert-l1 \\',
    '  --subnet-id <subnet-id-from-step-1> \\',
    `  --chain-id ${chainId} \\`,
    '  --manager <validator-manager-address>',
    '',
    '# 3. Register your first L1 validator',
    'platform l1 register-validator \\',
    '  --balance <AVAX-fee-deposit> \\',
    '  --pop <node-proof-of-possession-hex> \\',
    '  --message <warp-message-hex>',
    '```',
    `Command reference: ${PLATFORM_CLI_DOCS}`,
    '',
    `Notes: min stake/balance — ${MIN_VALIDATOR_STAKE[network]}.`,
    'avalanche-cli is deprecated and intentionally omitted.',
    '',
    NO_SIGN_NOTE,
  ];
  return text(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// ictt_build_plan
// ---------------------------------------------------------------------------

function buildICTTPlan(args: Record<string, unknown>): ToolResult {
  const network = getNetwork(args);
  const homeChain = getString(args, 'homeChain', '<home-chain>');
  const remoteChain = getString(args, 'remoteChain');
  const token = getString(args, 'token', '<token-address-or-native>');
  const tokenType = getString(args, 'tokenType', 'erc20') === 'native' ? 'native' : 'erc20';

  if (!remoteChain) {
    return errorResult('remoteChain is required (the destination L1/C-Chain for the bridged token).');
  }

  const homeContract = tokenType === 'native' ? 'NativeTokenHome' : 'ERC20TokenHome';
  const lines = [
    `# Plan: Interchain Token Transfer (${tokenType}) — ${homeChain} → ${remoteChain} (${network})`,
    `Token: ${token}`,
    '',
    '## Option 1 — Builder Console (guided)',
    `Use the ICTT flow: ${CONSOLE_BASE}${CONSOLE_FLOWS.ictt}`,
    'It walks token → home → remote → register → collateral and deploys with your wallet.',
    '',
    '## Option 2 — @avalanche-sdk/interchain (scriptable)',
    '```ts',
    `import { createICTTClient } from "@avalanche-sdk/interchain";`,
    '',
    `// 1. Deploy the token home on the home chain (${homeChain})`,
    `//    Home contract: ${homeContract}`,
    `// 2. Deploy the token remote on the destination chain (${remoteChain})`,
    `// 3. Register the remote with the home (cross-chain registration message)`,
    `// 4. Add collateral on the home so transfers can be redeemed on the remote`,
    `// 5. Transfer: send() on the home, relayer delivers to the remote`,
    '```',
    `ICTT docs: ${ICTT_DOCS}`,
    '',
    'Requires the ICM relayer to be running between the two chains.',
    '',
    NO_SIGN_NOTE,
  ];
  return text(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// validator_manager_plan
// ---------------------------------------------------------------------------

function buildValidatorManagerPlan(args: Record<string, unknown>): ToolResult {
  const managerRaw = getString(args, 'type', 'poa');
  const manager = (VALIDATOR_MANAGERS as readonly string[]).includes(managerRaw)
    ? (managerRaw as ValidatorManager)
    : 'poa';

  const steps: Record<ValidatorManager, string[]> = {
    poa: [
      'Deploy the PoA ValidatorManager (or use the genesis-predeployed proxy)',
      'Initialize it with the owner/admin address',
      'Initialize the validator set (initial validators + weights)',
      'Owner add/removes validators via the manager contract',
    ],
    'pos-native': [
      'Deploy the NativeTokenStakingManager + reward calculator',
      'Initialize with min/max stake, duration, churn, and delegation-fee settings',
      'Initialize the validator set; validators stake the L1 native token',
    ],
    'pos-erc20': [
      'Deploy the staking ERC-20 (or reference an existing one)',
      'Deploy the ERC20TokenStakingManager + reward calculator',
      'Initialize with token address + staking parameters; initialize the validator set',
    ],
  };

  const lines = [
    `# Plan: ${manager} validator manager`,
    `Console: ${CONSOLE_BASE}${CONSOLE_FLOWS['validator-manager']}`,
    'Standard: ACP-99 ValidatorManager. Steps:',
    '',
    ...steps[manager].map((s, i) => `${i + 1}. ${s}`),
    '',
    NO_SIGN_NOTE,
  ];
  return text(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// faucet_link / console_deep_link
// ---------------------------------------------------------------------------

function faucetLink(args: Record<string, unknown>): ToolResult {
  const network = getNetwork(args);
  if (network === 'mainnet') {
    return text('There is no faucet for mainnet — mainnet AVAX must be acquired/transferred. The faucet only serves Fuji testnet AVAX.');
  }
  return text(`Fuji testnet AVAX faucet: ${CONSOLE_BASE}${CONSOLE_FLOWS.faucet}\nUse it to fund a P-Chain or C-Chain address before deploying on Fuji.`);
}

function consoleDeepLink(args: Record<string, unknown>): ToolResult {
  const flow = getString(args, 'flow');
  if (!flow || !(flow in CONSOLE_FLOWS)) {
    return errorResult(`Unknown flow "${flow}". Available: ${Object.keys(CONSOLE_FLOWS).join(', ')}.`);
  }
  return text(`Builder Console — ${flow}: ${CONSOLE_BASE}${CONSOLE_FLOWS[flow as ConsoleFlow]}`);
}

// ---------------------------------------------------------------------------
// Tool domain
// ---------------------------------------------------------------------------

export const actionTools: ToolDomain = {
  tools: [
    {
      name: 'l1_build_plan',
      description:
        'Generate a step-by-step plan to create an Avalanche L1 — Builder Console (Quick Build) deep-link plus the equivalent ordered platform-cli command sequence. Does not execute anything.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'L1 name (default: myL1)' },
          network: { type: 'string', enum: [...NETWORKS], description: 'Target network (default: fuji)' },
          vm: { type: 'string', enum: ['subnet-evm', 'custom'], description: 'VM type (default: subnet-evm)' },
          validatorManager: {
            type: 'string',
            enum: [...VALIDATOR_MANAGERS],
            description: 'Validator management model (default: poa)',
          },
          chainId: { type: 'string', description: 'EVM chain ID for the L1' },
          tokenSymbol: { type: 'string', description: 'Native token symbol (default: TOK)' },
        },
        required: [],
      },
    },
    {
      name: 'ictt_build_plan',
      description:
        'Generate a plan to bridge a token between Avalanche chains via Interchain Token Transfer (ICTT) — Builder Console deep-link plus the equivalent @avalanche-sdk/interchain deploy→register→collateral steps. Does not execute anything.',
      inputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Token contract address (or "native")' },
          homeChain: { type: 'string', description: 'Home chain (where the token originates)' },
          remoteChain: { type: 'string', description: 'Destination chain for the bridged token' },
          tokenType: { type: 'string', enum: ['erc20', 'native'], description: 'Token type (default: erc20)' },
          network: { type: 'string', enum: [...NETWORKS], description: 'Target network (default: fuji)' },
        },
        required: ['remoteChain'],
      },
    },
    {
      name: 'validator_manager_plan',
      description: 'Generate the deployment/initialization steps for an L1 validator manager (PoA or PoS). Does not execute anything.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...VALIDATOR_MANAGERS], description: 'Validator manager type (default: poa)' },
        },
        required: [],
      },
    },
    {
      name: 'faucet_link',
      description: 'Return the Builder Console faucet link for funding a Fuji testnet address.',
      inputSchema: {
        type: 'object',
        properties: {
          network: { type: 'string', enum: [...NETWORKS], description: 'Network (default: fuji)' },
        },
        required: [],
      },
    },
    {
      name: 'console_deep_link',
      description:
        'Return a deep-link into a specific Builder Console flow (create-l1, convert-to-l1, validator-manager, ictt, faucet, multisig).',
      inputSchema: {
        type: 'object',
        properties: {
          flow: {
            type: 'string',
            enum: Object.keys(CONSOLE_FLOWS),
            description: 'The console flow to link to',
          },
        },
        required: ['flow'],
      },
    },
  ],

  handlers: {
    l1_build_plan: async (args): Promise<ToolResult> => buildL1Plan(args),
    ictt_build_plan: async (args): Promise<ToolResult> => buildICTTPlan(args),
    validator_manager_plan: async (args): Promise<ToolResult> => buildValidatorManagerPlan(args),
    faucet_link: async (args): Promise<ToolResult> => faucetLink(args),
    console_deep_link: async (args): Promise<ToolResult> => consoleDeepLink(args),
  },
};
