import { z } from 'zod';

/*
 * Shapes for the files under blueprints/. A manifest (blueprint.json) is
 * data, not code: the build agent reads it to plan, and the deploy pipeline
 * walks its steps. Values that depend on the network, the builder, or an
 * earlier step are written as references (see REF_PATTERN) and resolved at
 * run time against blueprints/_shared/networks.json.
 */

export const CATEGORIES = ['payments', 'defi', 'data', 'interop', 'privacy', 'infra'] as const;
export const LEVELS = ['starter', 'intermediate', 'advanced'] as const;
export const STEP_KINDS = ['deploy', 'call', 'read', 'offchain', 'wait'] as const;
export const SIGNERS = ['deployer', 'builder', 'admin'] as const;
export const PARAM_TYPES = ['address', 'string', 'uint', 'int', 'bool', 'bytes32', 'bytes'] as const;
export const DEPLOY_MODES = ['one-click', 'user-signed'] as const;
export const WAIT_KINDS = ['icm-delivery', 'ccip-delivery', 'quick-l1-job'] as const;
export const CTX_NAMES = ['deployer', 'builder'] as const;

/** Work that happens outside a contract call: platform APIs and browser-side cryptography. */
export const OFFCHAIN_ACTIONS = [
  'quick-l1.deploy',
  'icm.ensure-relayer',
  'ccip.encode-extra-args',
  'eerc.register',
  'eerc.private-mint',
  'eerc.deposit',
  'eerc.transfer',
  'eerc.withdraw',
  'eerc.decrypt-balance',
] as const;

/**
 * A reference is a whole string value:
 *   $param.<name>            builder-supplied parameter
 *   $net.<role>.<path>       registry value on the network bound to <role>
 *   $reg.<path>              registry value from the root (precompiles, fixed networks)
 *   $out.<step>.<field>      output of an earlier step (address, txHash, or a declared output)
 *   $ctx.<deployer|builder>  signer addresses known at run time
 * Path segments may contain letters, digits, '_', '-' and '/', but never '.'.
 */
export const REF_PATTERN = /^\$(param|net|reg|out|ctx)\.([A-Za-z0-9_\-/]+(?:\.[A-Za-z0-9_\-/]+)*)$/;

/** Where a step output comes from: a receipt event, a read's return value, or an off-chain result. */
export const OUTPUT_SOURCE_PATTERN =
  /^(event:[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+|return(\.[A-Za-z0-9_]+)?|result\.[A-Za-z0-9_.]+)$/;

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ROLE = /^[a-z][a-zA-Z0-9]*$/;
const PARAM_NAME = /^[a-z][A-Za-z0-9]*$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type ArgValue = string | number | boolean | null | ArgValue[] | { [key: string]: ArgValue };

/** A literal JSON value or reference string. Large integers are written as decimal strings. */
export const ArgValueSchema: z.ZodType<ArgValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(ArgValueSchema),
    z.record(z.string(), ArgValueSchema),
  ]),
);

const NetworkRoleSchema = z.strictObject({
  description: z.string().min(1),
  default: z.string().min(1),
  allowed: z.array(z.string().min(1)).min(1),
});

const ParamSchema = z.strictObject({
  name: z.string().regex(PARAM_NAME),
  type: z.enum(PARAM_TYPES),
  description: z.string().min(1),
  /** Omit to make the parameter required. */
  default: ArgValueSchema.optional(),
  example: ArgValueSchema.optional(),
});

const ContractSchema = z
  .strictObject({
    name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    description: z.string().min(1),
    /** Solidity source, relative to the blueprint folder. */
    source: z.string().optional(),
    /** Precompiled artifact JSON, relative to the repository root. */
    artifact: z.string().optional(),
  })
  .refine((c) => (c.source ? 1 : 0) + (c.artifact ? 1 : 0) === 1, {
    message: 'a contract needs exactly one of source or artifact',
  });

const WaitSchema = z.strictObject({
  for: z.enum(WAIT_KINDS),
  /** Reference to the message or job id to wait on. */
  id: z.string(),
  timeoutMinutes: z.number().positive().optional(),
});

const StepSchema = z
  .strictObject({
    id: z.string().regex(ID),
    title: z.string().min(1),
    kind: z.enum(STEP_KINDS),
    /** A role declared in the manifest's networks. */
    network: z.string().regex(ROLE),
    signer: z.enum(SIGNERS).optional(),
    /** Contract whose bytecode (deploy) or ABI (call, read) the step uses. */
    contract: z.string().optional(),
    /** Address reference for call and read steps. */
    target: z.string().optional(),
    function: z.string().optional(),
    args: z.array(ArgValueSchema).optional(),
    /** Native value in wei, for payable calls. */
    value: ArgValueSchema.optional(),
    /** Library name to address reference, for artifacts with linkReferences. */
    libraries: z.record(z.string(), z.string()).optional(),
    action: z.enum(OFFCHAIN_ACTIONS).optional(),
    inputs: z.record(z.string(), ArgValueSchema).optional(),
    wait: WaitSchema.optional(),
    /** Output name to source, e.g. { messageId: "event:ICMMessenger.MessageSent.messageId" }. */
    outputs: z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), z.string().regex(OUTPUT_SOURCE_PATTERN)).optional(),
    /** Skip the step when the resolved reference equals the value, e.g. when no collateral is needed. */
    skipIf: z.strictObject({ value: z.string(), equals: ArgValueSchema }).optional(),
    optional: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .superRefine((step, ctx) => {
    const need = (field: keyof typeof step) => {
      if (step[field] === undefined)
        ctx.addIssue({ code: 'custom', message: `${step.kind} step "${step.id}" needs ${field}` });
    };
    const forbid = (field: keyof typeof step) => {
      if (step[field] !== undefined)
        ctx.addIssue({ code: 'custom', message: `${step.kind} step "${step.id}" cannot have ${field}` });
    };
    switch (step.kind) {
      case 'deploy':
        need('contract');
        forbid('target');
        forbid('function');
        break;
      case 'call':
      case 'read':
        need('contract');
        need('target');
        need('function');
        break;
      case 'offchain':
        need('action');
        break;
      case 'wait':
        need('wait');
        break;
    }
  });

const ExpectSchema = z.union([
  z.strictObject({ equals: ArgValueSchema }),
  z.strictObject({ gt: ArgValueSchema }),
  z.strictObject({ gte: ArgValueSchema }),
  z.strictObject({ nonZero: z.literal(true) }),
]);

const CheckSchema = z.strictObject({
  description: z.string().min(1),
  /** Step after which the check runs. */
  after: z.string().regex(ID),
  network: z.string().regex(ROLE),
  contract: z.string(),
  target: z.string(),
  function: z.string(),
  args: z.array(ArgValueSchema).optional(),
  expect: ExpectSchema,
});

const PanelSchema = z.strictObject({
  /** A deploy step. */
  step: z.string().regex(ID),
  read: z.array(z.string()),
  write: z.array(z.string()),
});

const DocSchema = z.strictObject({
  title: z.string().min(1),
  url: z.string().regex(/^(\/(docs|academy|console|integrations)\/\S+|https:\/\/\S+)$/),
});

export const CompilerSettingsSchema = z.strictObject({
  $comment: z.string().optional(),
  solc: z.string().regex(/^\d+\.\d+\.\d+$/),
  solcLongVersion: z.string(),
  evmVersion: z.string(),
  optimizer: z.strictObject({ enabled: z.boolean(), runs: z.number().int().positive() }),
  viaIR: z.boolean(),
  dependencies: z.record(z.string(), z.string()),
  /** sha256 of each dependency's npm tarball, checked before any source is used. */
  integrity: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  remappings: z.array(z.string()),
  exportRemappings: z.record(z.string(), z.string()).optional(),
});

const CompileOverrideSchema = z.strictObject({
  solc: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  solcLongVersion: z.string().optional(),
  evmVersion: z.string().optional(),
  optimizer: z.strictObject({ enabled: z.boolean(), runs: z.number().int().positive() }).optional(),
  viaIR: z.boolean().optional(),
});

export const BlueprintManifestSchema = z.strictObject({
  $schema: z.string().optional(),
  id: z.string().regex(ID),
  version: z.literal(1),
  title: z.string().min(1).max(40),
  /** Card subtitle, e.g. "Storefront payment flow". */
  summary: z.string().min(1).max(60),
  description: z.string().min(1),
  category: z.enum(CATEGORIES),
  level: z.enum(LEVELS),
  tags: z.array(z.string()),
  /** Requests that should select this blueprint; used for retrieval. */
  prompts: z.array(z.string().min(1)).min(2),
  networks: z.record(z.string().regex(ROLE), NetworkRoleSchema),
  params: z.array(ParamSchema),
  prerequisites: z.array(z.string()),
  contracts: z.array(ContractSchema),
  compile: CompileOverrideSchema.optional(),
  steps: z.array(StepSchema).min(1),
  checks: z.array(CheckSchema),
  panel: z.array(PanelSchema),
  review: z.array(z.string().min(1)),
  /**
   * The app end users get. `audience` and `journeys` are the product (who opens it and what they come to do, in
   * their words); `flows` are the implementation notes for how those journeys call the contracts.
   */
  frontend: z.strictObject({
    summary: z.string().min(1),
    audience: z.array(z.string().min(1)).min(1),
    journeys: z.array(z.string().min(1)).min(1),
    flows: z.array(z.string().min(1)).min(1),
  }),
  docs: z.array(DocSchema),
  related: z.array(z.string().regex(ID)).optional(),
});

const AddressSchema = z.string().regex(ADDRESS);
const AmountTokenSchema = z.strictObject({ address: AddressSchema, decimals: z.number().int().min(0).max(36) });

const NetworkEntrySchema = z.strictObject({
  name: z.string(),
  family: z.string(),
  testnet: z.boolean(),
  deploy: z.enum(DEPLOY_MODES),
  evmChainId: z.number().int().positive().nullable(),
  blockchainId: z.string().nullable().optional(),
  blockchainIdHex: z
    .string()
    .regex(/^0x[0-9a-f]{64}$/)
    .nullable()
    .optional(),
  subnetId: z.string().nullable().optional(),
  rpcUrl: z.string().nullable(),
  /** Relayers subscribe to new blocks over WebSocket. */
  wsUrl: z.string().nullable().optional(),
  explorerUrl: z.string().nullable(),
  verifyApiUrl: z.string().nullable(),
  nativeCurrency: z.strictObject({ symbol: z.string(), decimals: z.number().int() }).nullable(),
  faucets: z.record(z.string(), z.string()),
  tokens: z.record(z.string(), AmountTokenSchema),
  teleporter: z.strictObject({ messenger: AddressSchema.nullable(), registry: AddressSchema.nullable() }).optional(),
  chainlink: z.strictObject({ feeds: z.record(z.string(), AmountTokenSchema) }).optional(),
  ccip: z
    .strictObject({
      router: AddressSchema,
      chainSelector: z.string().regex(/^\d+$/),
      feeTokens: z.array(z.string()),
      transferableTokens: z.array(z.string()),
    })
    .optional(),
  eerc: z
    .strictObject({
      registrar: AddressSchema,
      babyJubJubLibrary: AddressSchema,
      verifiers: z.strictObject({
        registration: AddressSchema,
        mint: AddressSchema,
        transfer: AddressSchema,
        withdraw: AddressSchema,
        burn: AddressSchema,
      }),
      standalone: AddressSchema,
      converter: AddressSchema,
    })
    .optional(),
  /** Present on entries that must be bound to a real chain at run time. */
  $runtime: z.string().optional(),
});

export const RegistrySchema = z.strictObject({
  $comment: z.string().optional(),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  precompiles: z.record(z.string(), AddressSchema),
  networks: z.record(z.string().regex(ID), NetworkEntrySchema),
});

export type BlueprintManifest = z.infer<typeof BlueprintManifestSchema>;
export type BlueprintStep = z.infer<typeof StepSchema>;
export type BlueprintCheck = z.infer<typeof CheckSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type NetworkEntry = z.infer<typeof NetworkEntrySchema>;
export type CompilerSettings = z.infer<typeof CompilerSettingsSchema>;
export type Category = (typeof CATEGORIES)[number];
