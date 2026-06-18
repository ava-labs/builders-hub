/**
 * Action / command-generation tool domain.
 *
 * The hosted MCP is keyless — it cannot sign or broadcast. These tools emit
 * deterministic, copy-pasteable runbooks (platform-cli, @avalanche-sdk/interchain,
 * interchain-kit) and Builder Console deep-links the user runs locally with their
 * own key. They never execute anything.
 *
 * Consolidated: `build_plan` (operation enum) replaces l1_build_plan /
 * ictt_build_plan / validator_manager_plan and adds staking / transfer /
 * interchain-kit; `console_link` replaces console_deep_link / faucet_link.
 * All platform-cli strings come from ./lib/platform-cli-commands (no drift).
 */

import type { ToolDomain, ToolResult } from '../types';
import { CLI, PLATFORM_CLI_DOCS } from './lib/platform-cli-commands';

const CONSOLE_BASE = 'https://build.avax.network/console';
const ICTT_DOCS = 'https://build.avax.network/docs/tooling/avalanche-sdk/interchain/ictt';
const INTERCHAIN_KIT_DOCS = 'https://build.avax.network/docs/tooling/avalanche-sdk/interchain-kit';

const NETWORKS = ['fuji', 'mainnet'] as const;
type ActionNetwork = (typeof NETWORKS)[number];

const VALIDATOR_MANAGERS = ['poa', 'pos-native', 'pos-erc20'] as const;
type ValidatorManager = (typeof VALIDATOR_MANAGERS)[number];

const OPERATIONS = ['create-l1', 'ictt', 'validator-manager', 'staking', 'transfer', 'interchain-kit'] as const;
type Operation = (typeof OPERATIONS)[number];

const CONSOLE_FLOWS = {
  'create-l1': '/primary-network/l1/create',
  'convert-to-l1': '/primary-network/l1/convert',
  'validator-manager': '/primary-network/l1/validator-manager',
  ictt: '/icm/ictt',
  faucet: '/primary-network/faucet',
  multisig: '/primary-network/multisig',
  staking: '/primary-network/stake',
  transfers: '/primary-network/transfer',
  'interchain-kit-local': '/icm/ictt',
} as const;
type ConsoleFlowKey = keyof typeof CONSOLE_FLOWS;

function getString(args: Record<string, unknown>, key: string, fallback = ''): string {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function getNetwork(args: Record<string, unknown>): ActionNetwork {
  const n = getString(args, 'network', 'fuji');
  return (NETWORKS as readonly string[]).includes(n) ? (n as ActionNetwork) : 'fuji';
}

function getManager(args: Record<string, unknown>): ValidatorManager {
  const m = getString(args, 'validatorManager') || getString(args, 'type', 'poa');
  return (VALIDATOR_MANAGERS as readonly string[]).includes(m) ? (m as ValidatorManager) : 'poa';
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
  mainnet: '2,000 AVAX (Primary Network); an L1 validator balance is a fee deposit, not stake',
};

const MANAGER_LABEL: Record<ValidatorManager, string> = {
  poa: 'Proof of Authority',
  'pos-native': 'Proof of Stake (native)',
  'pos-erc20': 'Proof of Stake (ERC-20)',
};

// ---------------------------------------------------------------------------
// Per-operation plan builders
// ---------------------------------------------------------------------------

function buildL1Plan(args: Record<string, unknown>): ToolResult {
  const name = getString(args, 'name', 'myL1');
  const network = getNetwork(args);
  const chainId = getString(args, 'chainId', '<evm-chain-id>');
  const tokenSymbol = getString(args, 'tokenSymbol', 'TOK');
  const vm = getString(args, 'vm', 'subnet-evm') === 'custom' ? 'custom' : 'subnet-evm';
  const manager = getManager(args);

  return text(
    [
      `# Plan: create L1 "${name}" (${network})`,
      `VM: ${vm} · Validator manager: ${MANAGER_LABEL[manager]} · EVM chain ID: ${chainId} · Token: ${tokenSymbol}`,
      '',
      '## Option 1 — Quick Build (no-code, recommended)',
      `Create and deploy from the Builder Console: ${CONSOLE_BASE}${CONSOLE_FLOWS['create-l1']}`,
      'Pick the VM, set genesis (chain ID, token, precompiles), choose the validator manager, and deploy with your connected wallet.',
      '',
      '## Option 2 — platform-cli (scriptable)',
      '```bash',
      '# 0. Prerequisites: a funded P-Chain key and (fuji) testnet AVAX from the faucet.',
      `${CLI.keysGenerate} --key-name myKey   # or: platform keys import`,
      '',
      '# 1. Create the subnet (records you as the owner)',
      `${CLI.subnetCreate} --key-name myKey --network ${network}`,
      '',
      '# 2. Convert the subnet to an L1 (deploys/points at a validator manager)',
      `${CLI.subnetConvertL1} \\`,
      '  --subnet-id <subnet-id-from-step-1> \\',
      `  --chain-id ${chainId} \\`,
      '  --manager <validator-manager-address>',
      '',
      '# 3. Register your first L1 validator',
      `#    (--pop comes from \`${CLI.nodeInfo}\`; the Warp --message comes from the`,
      '#     Console validator-manager flow or the SDK — the CLI alone cannot produce it)',
      `${CLI.l1RegisterValidator} \\`,
      '  --balance <AVAX-fee-deposit> \\',
      '  --pop <node-proof-of-possession-hex> \\',
      '  --message <warp-message-hex>',
      '```',
      `Command reference: ${PLATFORM_CLI_DOCS}`,
      '',
      `Notes: min stake/balance — ${MIN_VALIDATOR_STAKE[network]}. avalanche-cli is deprecated and omitted.`,
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

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
  return text(
    [
      `# Plan: Interchain Token Transfer (${tokenType}) — ${homeChain} → ${remoteChain} (${network})`,
      `Token: ${token}`,
      '',
      '## Option 1 — Builder Console (guided)',
      `Use the ICTT flow: ${CONSOLE_BASE}${CONSOLE_FLOWS.ictt}`,
      'It walks token → home → remote → register → collateral and deploys with your wallet.',
      '',
      '## Option 2 — @avalanche-sdk/interchain (scriptable)',
      '```ts',
      'import { createICTTClient } from "@avalanche-sdk/interchain";',
      '',
      `// 1. Deploy the token home on the home chain (${homeChain}) — ${homeContract}`,
      `// 2. Deploy the token remote on the destination chain (${remoteChain})`,
      '// 3. Register the remote with the home (cross-chain registration message)',
      '// 4. Add collateral on the home so transfers can be redeemed on the remote',
      '// 5. Transfer: send() on the home; the ICM relayer delivers to the remote',
      '```',
      `ICTT docs: ${ICTT_DOCS}`,
      'Requires the ICM relayer running between the two chains. To iterate locally first, use `interchain-kit` (operation: interchain-kit).',
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

function buildValidatorManagerPlan(args: Record<string, unknown>): ToolResult {
  const manager = getManager(args);
  const steps: Record<ValidatorManager, string[]> = {
    poa: [
      'Deploy the PoA ValidatorManager (or use the genesis-predeployed proxy)',
      'Initialize it with the owner/admin address',
      'Initialize the validator set (initial validators + weights)',
      'Owner adds/removes validators via the manager contract',
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
  return text(
    [
      `# Plan: ${MANAGER_LABEL[manager]} validator manager`,
      `Console: ${CONSOLE_BASE}${CONSOLE_FLOWS['validator-manager']}`,
      'Standard: ACP-99 ValidatorManager. Steps:',
      '',
      ...steps[manager].map((s, i) => `${i + 1}. ${s}`),
      '',
      `Manage validators afterwards with \`${CLI.l1RegisterValidator}\`, \`${CLI.l1SetWeight}\`, \`${CLI.l1AddBalance}\`, \`${CLI.l1DisableValidator}\`.`,
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

function buildStakingPlan(args: Record<string, unknown>): ToolResult {
  const network = getNetwork(args);
  const stake = getString(args, 'stake', '<amount>');
  const duration = getString(args, 'duration', '<duration e.g. 336h>');
  const nodeId = getString(args, 'nodeId', '<NodeID-...>');
  return text(
    [
      `# Plan: stake / validate on the Primary Network (${network})`,
      '',
      '```bash',
      '# 1. Generate (or import) a funded P-Chain key',
      `${CLI.keysGenerate} --key-name myKey`,
      '',
      '# 2. Get your node\'s NodeID + BLS public key + proof-of-possession',
      `${CLI.nodeInfo}`,
      '',
      '# 3. Add yourself as a permissionless Primary Network validator',
      `${CLI.validatorAdd} \\`,
      `  --node-id ${nodeId} \\`,
      `  --stake-amount ${stake} \\`,
      `  --staking-period ${duration} \\`,
      '  --bls-public-key <hex> \\',
      '  --bls-pop <hex> \\',
      `  --network ${network}`,
      '',
      '# 4. (optional) Delegate additional stake to a validator',
      `${CLI.validatorDelegate} --node-id ${nodeId} --stake-amount <amount> --staking-period <duration>`,
      '```',
      '',
      `Notes: min stake — ${MIN_VALIDATOR_STAKE[network]}. Command reference: ${PLATFORM_CLI_DOCS}`,
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

function buildTransferPlan(args: Record<string, unknown>): ToolResult {
  const network = getNetwork(args);
  const kind = getString(args, 'transferKind', 'send');
  const amount = getString(args, 'amount', '<amount>');
  const to = getString(args, 'to', '<destination-address>');
  const cmd =
    kind === 'p-to-c'
      ? `${CLI.transferPtoC} --amount ${amount} --network ${network}`
      : kind === 'c-to-p'
        ? `${CLI.transferCtoP} --amount ${amount} --network ${network}`
        : `${CLI.transferSend} --to ${to} --amount ${amount} --network ${network}`;
  return text(
    [
      `# Plan: transfer AVAX (${kind}, ${network})`,
      '',
      '```bash',
      `${CLI.keysGenerate} --key-name myKey   # if you don't already have a key`,
      cmd,
      '```',
      kind === 'send'
        ? 'Use `p-to-c` / `c-to-p` for cross-chain (P↔C) moves on the Primary Network.'
        : 'Cross-chain transfers settle as an export then an import; the CLI handles both legs.',
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

function buildInterchainKitPlan(args: Record<string, unknown>): ToolResult {
  const example = getString(args, 'example', 'send-message');
  const known = ['send-message', 'transfer-token', 'validator-manager-setup', 'add-validator'];
  const ex = known.includes(example) ? example : 'send-message';
  return text(
    [
      '# Plan: interchain-kit (local cross-chain dev)',
      'interchain-kit boots a real local tmpnet with TeleporterMessenger + Registry on every chain, an ICM relayer (:8080) and a signature-aggregator (:8090) — the fastest way to iterate on ICM/ICTT before Fuji.',
      '',
      '```bash',
      'git clone https://github.com/ava-labs/interchain-kit && cd interchain-kit',
      'pnpm install',
      'pnpm run up                 # tmpnetjs up — boots the local network + relayer + aggregator',
      `pnpm tsx examples/${ex}.ts   # run from examples/ (send-message | transfer-token | validator-manager-setup | add-validator)`,
      'pnpm run down               # tear down (or: tmpnetjs down)',
      '```',
      `Artifacts (network.json / addresses / .env) land in \`.interchain-kit/artifacts/\`. Docs: ${INTERCHAIN_KIT_DOCS}`,
      ex === 'transfer-token'
        ? 'The transfer-token example mirrors the Console ICTT flow: deploy ERC-20 → TokenHome → TokenRemote → registerWithHome → addCollateral → send → poll balanceOf.'
        : '',
      '',
      NO_SIGN_NOTE,
    ]
      .filter(Boolean)
      .join('\n')
  );
}

// ---------------------------------------------------------------------------
// Tool domain
// ---------------------------------------------------------------------------

export const actionTools: ToolDomain = {
  tools: [
    {
      name: 'build_plan',
      description:
        'Generate a step-by-step, copy-pasteable runbook for an Avalanche operation — Builder Console (no-code) path plus the equivalent platform-cli / SDK / interchain-kit command sequence. Read-only: it never signs or broadcasts. Pick `operation`: create-l1, ictt, validator-manager, staking, transfer, interchain-kit.',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: [...OPERATIONS], description: 'Which runbook to generate' },
          network: { type: 'string', enum: [...NETWORKS], description: 'Target network (default: fuji)' },
          // create-l1
          name: { type: 'string', description: 'create-l1: L1 name (default: myL1)' },
          vm: { type: 'string', enum: ['subnet-evm', 'custom'], description: 'create-l1: VM type (default: subnet-evm)' },
          validatorManager: { type: 'string', enum: [...VALIDATOR_MANAGERS], description: 'create-l1 / validator-manager: model (default: poa)' },
          chainId: { type: 'string', description: 'create-l1: EVM chain ID' },
          tokenSymbol: { type: 'string', description: 'create-l1: native token symbol' },
          type: { type: 'string', enum: [...VALIDATOR_MANAGERS], description: 'validator-manager: manager type (alias of validatorManager)' },
          // ictt
          token: { type: 'string', description: 'ictt: token contract address (or "native")' },
          tokenType: { type: 'string', enum: ['erc20', 'native'], description: 'ictt: token type (default: erc20)' },
          homeChain: { type: 'string', description: 'ictt: home chain (where the token originates)' },
          remoteChain: { type: 'string', description: 'ictt: destination chain (required for operation=ictt)' },
          // staking
          stake: { type: 'string', description: 'staking: stake amount' },
          duration: { type: 'string', description: 'staking: staking period (e.g. 336h)' },
          nodeId: { type: 'string', description: 'staking: NodeID-…' },
          // transfer
          transferKind: { type: 'string', enum: ['send', 'p-to-c', 'c-to-p'], description: 'transfer: kind (default: send)' },
          amount: { type: 'string', description: 'transfer: amount' },
          to: { type: 'string', description: 'transfer: destination address (transferKind=send)' },
          // interchain-kit
          example: {
            type: 'string',
            enum: ['send-message', 'transfer-token', 'validator-manager-setup', 'add-validator'],
            description: 'interchain-kit: which example to run',
          },
        },
        required: ['operation'],
      },
    },
    {
      name: 'console_link',
      description:
        'Return a deep-link into a specific Builder Console flow (create-l1, convert-to-l1, validator-manager, ictt, faucet, multisig, staking, transfers, interchain-kit-local). For faucet on mainnet, returns a note that there is no mainnet faucet.',
      inputSchema: {
        type: 'object',
        properties: {
          flow: { type: 'string', enum: Object.keys(CONSOLE_FLOWS), description: 'The console flow to link to' },
          network: { type: 'string', enum: [...NETWORKS], description: 'Network (only affects faucet; default: fuji)' },
        },
        required: ['flow'],
      },
    },
  ],

  handlers: {
    build_plan: async (args): Promise<ToolResult> => {
      const op = getString(args, 'operation');
      switch (op as Operation) {
        case 'create-l1':
          return buildL1Plan(args);
        case 'ictt':
          return buildICTTPlan(args);
        case 'validator-manager':
          return buildValidatorManagerPlan(args);
        case 'staking':
          return buildStakingPlan(args);
        case 'transfer':
          return buildTransferPlan(args);
        case 'interchain-kit':
          return buildInterchainKitPlan(args);
        default:
          return errorResult(`Unknown operation "${op}". One of: ${OPERATIONS.join(', ')}.`);
      }
    },

    console_link: async (args): Promise<ToolResult> => {
      const flow = getString(args, 'flow');
      if (!flow || !(flow in CONSOLE_FLOWS)) {
        return errorResult(`Unknown flow "${flow}". Available: ${Object.keys(CONSOLE_FLOWS).join(', ')}.`);
      }
      if (flow === 'faucet' && getNetwork(args) === 'mainnet') {
        return text('There is no faucet for mainnet — mainnet AVAX must be acquired/transferred. The faucet only serves Fuji testnet AVAX.');
      }
      return text(`Builder Console — ${flow}: ${CONSOLE_BASE}${CONSOLE_FLOWS[flow as ConsoleFlowKey]}`);
    },
  },
};
