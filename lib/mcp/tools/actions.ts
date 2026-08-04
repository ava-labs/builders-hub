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
import { CONSOLE_BASE } from './lib/constants';
import { getString, errorResult, rejectBadEnum } from './lib/tool-helpers';

const ICTT_DOCS = 'https://build.avax.network/docs/tooling/avalanche-sdk/interchain/ictt';
const INTERCHAIN_KIT_DOCS = 'https://build.avax.network/docs/tooling/avalanche-sdk/interchain-kit';

const NETWORKS = ['fuji', 'mainnet'] as const;
type ActionNetwork = (typeof NETWORKS)[number];

const VALIDATOR_MANAGERS = ['poa', 'pos-native', 'pos-erc20'] as const;
type ValidatorManager = (typeof VALIDATOR_MANAGERS)[number];

const OPERATIONS = ['create-l1', 'ictt', 'validator-manager', 'staking', 'transfer', 'interchain-kit'] as const;
type Operation = (typeof OPERATIONS)[number];

// Enum allowlists shared by the input schema, the plan builders, and the guard below.
const VMS = ['subnet-evm', 'custom'] as const;
const TOKEN_TYPES = ['erc20', 'native'] as const;
const TRANSFER_KINDS = ['send', 'p-to-c', 'c-to-p'] as const;
const EXAMPLES = ['send-message', 'transfer-token', 'validator-manager-setup', 'add-validator'] as const;

const CONSOLE_FLOWS = {
  'create-l1': '/create-l1',
  'convert-to-l1': '/layer-1/create',
  'validator-manager': '/permissioned-l1s/validator-manager-setup',
  ictt: '/ictt/setup',
  faucet: '/primary-network/faucet',
  multisig: '/permissioned-l1s/multisig-setup',
  staking: '/primary-network/stake',
  transfers: '/primary-network/c-p-bridge',
  'interchain-kit-local': '/ictt/setup',
} as const;
type ConsoleFlowKey = keyof typeof CONSOLE_FLOWS;

function getNetwork(args: Record<string, unknown>): ActionNetwork {
  const n = getString(args, 'network', 'fuji');
  return (NETWORKS as readonly string[]).includes(n) ? (n as ActionNetwork) : 'fuji';
}

function getManager(args: Record<string, unknown>): ValidatorManager {
  const m = getString(args, 'validatorManager') || getString(args, 'type', 'poa');
  return (VALIDATOR_MANAGERS as readonly string[]).includes(m) ? (m as ValidatorManager) : 'poa';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function consoleFlowUrl(flow: ConsoleFlowKey, args: Record<string, unknown> = {}): string {
  if (flow === 'interchain-kit-local') return INTERCHAIN_KIT_DOCS;
  if (flow === 'validator-manager') {
    const manager = getManager(args);
    const path = manager === 'poa'
      ? '/permissioned-l1s/validator-manager-setup'
      : manager === 'pos-native'
        ? '/permissionless-l1s/native-staking-manager-setup'
        : '/permissionless-l1s/erc20-staking-manager-setup';
    return `${CONSOLE_BASE}${path}`;
  }
  return `${CONSOLE_BASE}${CONSOLE_FLOWS[flow]}`;
}

function matches(value: string, pattern: RegExp, label: string): ToolResult | null {
  return pattern.test(value) ? null : errorResult(`Error: ${label} has an invalid format.`);
}

function text(t: string): ToolResult {
  return { content: [{ type: 'text', text: t }] };
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
  const chainId = getString(args, 'chainId');
  const tokenSymbol = getString(args, 'tokenSymbol', 'TOK');
  const vm = getString(args, 'vm', 'subnet-evm') === 'custom' ? 'custom' : 'subnet-evm';
  const manager = getManager(args);
  if (!chainId) return errorResult('Error: chainId is required for create-l1 so genesis.json is valid.');
  const invalidName = matches(name, /^[A-Za-z][A-Za-z0-9_-]{0,31}$/, 'name');
  if (invalidName) return invalidName;
  const invalidChainId = matches(chainId, /^[1-9]\d{0,11}$/, 'chainId');
  if (invalidChainId) return invalidChainId;
  const invalidSymbol = matches(tokenSymbol, /^[A-Z][A-Z0-9]{1,10}$/, 'tokenSymbol');
  if (invalidSymbol) return invalidSymbol;
  const genesis = JSON.stringify({
    config: {
      chainId: Number(chainId),
      feeConfig: { gasLimit: 12000000, minBaseFee: 25000000000, targetGas: 60000000 },
    },
    alloc: {
      'YOUR_ADDRESS_WITHOUT_0x_PREFIX': { balance: '0x295BE96E64066972000000' },
    },
    gasLimit: '0xB71B00',
    timestamp: '0x0',
  }, null, 2);

  return text(
    [
      `# Plan: create L1 "${name}" (${network})`,
      `VM: ${vm} · Validator manager: ${MANAGER_LABEL[manager]} · EVM chain ID: ${chainId} · Token: ${tokenSymbol}`,
      '',
      '## Option 1 — Quick Build (no-code, recommended)',
      `Create and deploy from the Builder Console: ${consoleFlowUrl('create-l1')}`,
      'Pick the VM, set genesis (chain ID, token, precompiles), choose the validator manager, and deploy with your connected wallet.',
      '',
      '## Option 2 — platform-cli (scriptable)',
      '```bash',
      '# 0. Prerequisites: a funded P-Chain key and (fuji) testnet AVAX from the faucet.',
      `${CLI.keysGenerate} --name myKey   # or: platform keys import`,
      "SUBNET_ID='replace-after-step-1'",
      "MANAGER_ADDRESS='0x-replace-with-validator-manager-address'",
      "NODE_POP='replace-with-node-proof-of-possession-hex'",
      "WARP_MESSAGE='replace-with-warp-message-hex'",
      "VALIDATOR_ENDPOINT='replace-with-validator-node-host:port'   # e.g. 127.0.0.1:9650 — convert auto-fetches NodeID + BLS PoP from it",
      ...(vm === 'custom' ? ["VM_ID='replace-with-your-vm-id'"] : []),
      '',
      '# 1. Create the subnet (records you as the owner)',
      `${CLI.subnetCreate} --key-name myKey --network ${network}`,
      '',
      `# 2. Create the blockchain on that subnet from your genesis (sets chain ID ${chainId} and the initial native-token supply)`,
      `${CLI.chainCreate} --subnet-id "$SUBNET_ID" --name ${shellQuote(name)} --genesis genesis.json${vm === 'custom' ? ' --vm-id "$VM_ID"' : ''}`,
      '',
      `# 3. Convert the subnet to an L1 — sets the validator manager (on chain ${chainId}) + the initial validator set`,
      `${CLI.subnetConvertL1} \\`,
      '  --subnet-id "$SUBNET_ID" \\',
      `  --chain-id ${chainId} \\`,
      '  --manager "$MANAGER_ADDRESS" \\',
      '  --validators "$VALIDATOR_ENDPOINT"',
      '',
      '# 4. (later) Register an ADDITIONAL L1 validator — the initial set is created in step 3',
      `#    (--pop from \`${CLI.nodeInfo}\`; the Warp --message comes from the Console`,
      '#     validator-manager flow or the SDK — the CLI alone cannot produce it)',
      `${CLI.l1RegisterValidator} \\`,
      "  --balance 'replace-with-AVAX-fee-deposit' \\",
      '  --pop "$NODE_POP" \\',
      '  --message "$WARP_MESSAGE"',
      '```',
      '',
      `### genesis.json — sets chain ID ${chainId}, fee config, and the initial native-token supply`,
      '```json',
      genesis,
      '```',
      `_The alloc balance credits ~50,000,000 ${tokenSymbol} (×10^18 wei) to your address as the L1's initial native supply — change the address/amount as needed. The alloc key is a hex address WITHOUT the 0x prefix._`,
      `_The ${tokenSymbol} symbol is display metadata (set in the Console / L1 registry / wallet), not a Subnet-EVM genesis field — genesis only defines the chain ID, fees, and balances._`,
      `Command reference: ${PLATFORM_CLI_DOCS}`,
      '',
      'Signing boundaries: steps 1–4 each broadcast a locally-signed P-Chain transaction (CreateSubnetTx, CreateChainTx, ConvertSubnetToL1Tx, RegisterL1ValidatorTx). The CLI signs with your local key; only this MCP is read-only.',
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
    return errorResult('Error: remoteChain is required (the destination L1/C-Chain for the bridged token).');
  }
  return text(
    [
      `# Plan: Interchain Token Transfer (${tokenType}) — ${homeChain} → ${remoteChain} (${network})`,
      `Token: ${token}`,
      '',
      '## Option 1 — Builder Console (guided)',
      `Use the ICTT flow: ${consoleFlowUrl('ictt')}`,
      'It walks token → home → remote → register → collateral and deploys with your wallet.',
      '',
      '## Option 2 — @avalanche-sdk/interchain (scriptable, ERC-20 tokens)',
      ...(tokenType === 'native'
        ? ['> `createICTTClient` supports the **ERC-20** flow only. For a **native-token** ICTT, use the Builder Console flow above or deploy the NativeTokenHome / NativeTokenRemote contracts directly.', '']
        : []),
      '```ts',
      'import { createICTTClient } from "@avalanche-sdk/interchain";',
      'const ictt = createICTTClient({ /* home + remote chain configs + account */ });',
      '',
      `// 1. ictt.deployTokenHomeContract({ erc20TokenAddress }) on the home chain (${homeChain})`,
      `// 2. ictt.deployTokenRemoteContract({ ... }) on the destination chain (${remoteChain})`,
      '// 3. ictt.registerRemoteWithHome({ ... }) — sends the cross-chain registration message',
      '// 4. ictt.approveToken({ ... }), then ictt.sendToken({ ... }) — the ICM relayer delivers to the remote',
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
      `Console: ${consoleFlowUrl('validator-manager', args)}`,
      'Standard: ACP-99 ValidatorManager. Steps:',
      '',
      ...steps[manager].map((s, i) => `${i + 1}. ${s}`),
      '',
      `Manage validators afterwards with \`${CLI.l1RegisterValidator}\`, \`${CLI.l1SetWeight}\`, \`${CLI.l1AddBalance}\`, \`${CLI.l1DisableValidator}\`.`,
      `The \`--balance\` on \`${CLI.l1RegisterValidator}\` / \`${CLI.l1AddBalance}\` is an AVAX P-Chain continuous-fee deposit, not staking tokens; native/ERC-20 stake is configured on the StakingManager contract.`,
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

function buildStakingPlan(args: Record<string, unknown>): ToolResult {
  const network = getNetwork(args);
  const stake = getString(args, 'stake');
  const duration = getString(args, 'duration');
  const nodeId = getString(args, 'nodeId');
  if (!stake || !duration || !nodeId) return errorResult('Error: stake, duration, and nodeId are required for a safe staking command.');
  const invalidStake = matches(stake, /^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)$/, 'stake');
  if (invalidStake) return invalidStake;
  const invalidDuration = matches(duration, /^[1-9]\d*(?:h|d)$/, 'duration');
  if (invalidDuration) return invalidDuration;
  const invalidNodeId = matches(nodeId, /^NodeID-[1-9A-HJ-NP-Za-km-z]{20,60}$/, 'nodeId');
  if (invalidNodeId) return invalidNodeId;
  return text(
    [
      `# Plan: stake / validate on the Primary Network (${network})`,
      '',
      '```bash',
      '# 1. Generate (or import) a funded P-Chain key',
      `${CLI.keysGenerate} --name myKey`,
      '',
      '# 2. Get your node\'s NodeID + BLS public key + proof-of-possession',
      `${CLI.nodeInfo}`,
      "BLS_PUBLIC_KEY='replace-with-hex'",
      "BLS_POP='replace-with-hex'",
      '',
      '# 3. Add yourself as a permissionless Primary Network validator',
      `${CLI.validatorAdd} \\`,
      `  --node-id ${shellQuote(nodeId)} \\`,
      `  --stake ${shellQuote(stake)} \\`,
      `  --duration ${shellQuote(duration)} \\`,
      '  --bls-public-key "$BLS_PUBLIC_KEY" \\',
      '  --bls-pop "$BLS_POP" \\',
      `  --network ${network}`,
      '',
      '# 4. (optional) Delegate additional stake to a validator',
      `${CLI.validatorDelegate} --node-id ${shellQuote(nodeId)} --stake 'replace-with-amount' --duration 'replace-with-duration'`,
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
  const amount = getString(args, 'amount');
  const to = getString(args, 'to');
  if (!amount) return errorResult('Error: amount is required for a safe transfer command.');
  const invalidAmount = matches(amount, /^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)$/, 'amount');
  if (invalidAmount) return invalidAmount;
  if (kind === 'send' && !to) return errorResult('Error: to is required for transferKind=send.');
  if (kind === 'send') {
    const invalidDestination = matches(to, /^(?:0x[0-9a-fA-F]{40}|[PX]-[A-Za-z0-9]{20,100})$/, 'to');
    if (invalidDestination) return invalidDestination;
  }
  const cmd =
    kind === 'p-to-c'
      ? `${CLI.transferPtoC} --amount ${shellQuote(amount)} --network ${network}`
      : kind === 'c-to-p'
        ? `${CLI.transferCtoP} --amount ${shellQuote(amount)} --network ${network}`
        : `${CLI.transferSend} --to ${shellQuote(to)} --amount ${shellQuote(amount)} --network ${network}`;
  return text(
    [
      `# Plan: transfer AVAX (${kind}, ${network})`,
      '',
      '```bash',
      `${CLI.keysGenerate} --name myKey   # if you don't already have a key`,
      cmd,
      '```',
      kind === 'send'
        ? 'Use `p-to-c` / `c-to-p` for cross-chain (P↔C) moves on the Primary Network.'
        : 'Cross-chain transfers settle as an export then an import — the one-step command above does both legs. Manual equivalent: `platform transfer export --from c --to p --amount <n>` then `platform transfer import --from c --to p`.',
      '',
      NO_SIGN_NOTE,
    ].join('\n')
  );
}

function buildInterchainKitPlan(args: Record<string, unknown>): ToolResult {
  const example = getString(args, 'example', 'send-message');
  const ex = (EXAMPLES as readonly string[]).includes(example) ? example : 'send-message';
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
      `Artifacts (network.json / addresses.ts / .env) land in \`.interchain-kit/artifacts/\`. Docs: ${INTERCHAIN_KIT_DOCS}`,
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
        'Generate a step-by-step, copy-pasteable runbook for an Avalanche operation — Builder Console (no-code) path plus the equivalent platform-cli / SDK / interchain-kit commands. Read-only: never signs. operation: create-l1 (launch an L1); use ictt or interchain-kit for any CROSS-CHAIN / interoperability work — bridging tokens, sending cross-chain (ICM / Teleporter / Warp) messages, or connecting your L1 to C-Chain or other L1s (interchain-kit also lets you iterate locally first); validator-manager; staking; transfer.',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: [...OPERATIONS], description: 'Which runbook to generate' },
          network: { type: 'string', enum: [...NETWORKS], description: 'Target network (default: fuji)' },
          // create-l1
          name: { type: 'string', description: 'create-l1: L1 name (default: myL1)' },
          vm: { type: 'string', enum: [...VMS], description: 'create-l1: VM type (default: subnet-evm)' },
          validatorManager: { type: 'string', enum: [...VALIDATOR_MANAGERS], description: 'create-l1 / validator-manager: model (default: poa)' },
          chainId: { type: 'string', description: 'create-l1: EVM chain ID' },
          tokenSymbol: { type: 'string', description: 'create-l1: native token symbol' },
          type: { type: 'string', enum: [...VALIDATOR_MANAGERS], description: 'validator-manager: manager type (alias of validatorManager)' },
          // ictt
          token: { type: 'string', description: 'ictt: token contract address (or "native")' },
          tokenType: { type: 'string', enum: [...TOKEN_TYPES], description: 'ictt: token type (default: erc20)' },
          homeChain: { type: 'string', description: 'ictt: home chain (where the token originates)' },
          remoteChain: { type: 'string', description: 'ictt: destination chain (required for operation=ictt)' },
          // staking
          stake: { type: 'string', description: 'staking: stake amount' },
          duration: { type: 'string', description: 'staking: staking period (e.g. 336h)' },
          nodeId: { type: 'string', description: 'staking: NodeID-…' },
          // transfer
          transferKind: { type: 'string', enum: [...TRANSFER_KINDS], description: 'transfer: kind (default: send)' },
          amount: { type: 'string', description: 'transfer: amount' },
          to: { type: 'string', description: 'transfer: destination address (transferKind=send)' },
          // interchain-kit
          example: {
            type: 'string',
            enum: [...EXAMPLES],
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
          validatorManager: { type: 'string', enum: [...VALIDATOR_MANAGERS], description: 'Validator-manager variant (default: poa)' },
        },
        required: ['flow'],
      },
    },
  ],

  handlers: {
    build_plan: async (args): Promise<ToolResult> => {
      const enumErr =
        rejectBadEnum(args, 'network', NETWORKS) ||
        rejectBadEnum(args, 'vm', VMS) ||
        rejectBadEnum(args, 'validatorManager', VALIDATOR_MANAGERS) ||
        rejectBadEnum(args, 'type', VALIDATOR_MANAGERS) ||
        rejectBadEnum(args, 'tokenType', TOKEN_TYPES) ||
        rejectBadEnum(args, 'transferKind', TRANSFER_KINDS) ||
        rejectBadEnum(args, 'example', EXAMPLES);
      if (enumErr) return enumErr;
      // network/vm/validatorManager/type/tokenType/transferKind/example are already
      // validated against these exact allowlists by the rejectBadEnum chain above.
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
          return errorResult(`Error: Unknown operation "${op}". One of: ${OPERATIONS.join(', ')}.`);
      }
    },

    console_link: async (args): Promise<ToolResult> => {
      const netErr = rejectBadEnum(args, 'network', NETWORKS);
      if (netErr) return netErr;
      const flow = getString(args, 'flow');
      if (!flow || !(flow in CONSOLE_FLOWS)) {
        return errorResult(`Error: Unknown flow "${flow}". Available: ${Object.keys(CONSOLE_FLOWS).join(', ')}.`);
      }
      // network is already validated by the rejectBadEnum call above.
      if (flow === 'faucet' && getNetwork(args) === 'mainnet') {
        return text('There is no faucet for mainnet — mainnet AVAX must be acquired/transferred. The faucet only serves Fuji testnet AVAX.');
      }
      const manager = getString(args, 'validatorManager');
      if (manager && !(VALIDATOR_MANAGERS as readonly string[]).includes(manager)) {
        return errorResult(`Error: validatorManager must be one of: ${VALIDATOR_MANAGERS.join(', ')}.`);
      }
      const label = flow === 'interchain-kit-local' ? 'interchain-kit docs' : 'Builder Console';
      return text(`${label} — ${flow}: ${consoleFlowUrl(flow as ConsoleFlowKey, args)}`);
    },
  },
};
