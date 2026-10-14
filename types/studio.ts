import { z } from 'zod';

export const MAX_STUDIO_FILES = 200;
export const MAX_STUDIO_FILE_BYTES = 200 * 1024;

/**
 * Project-relative paths under a fixed set of folders; no parent hops, no hidden files. Solidity and docs live
 * under contracts/, test/, script/ and docs/; the dApp the Preview tab runs lives under frontend/.
 */
export const STUDIO_FILE_PATH =
  /^(?:(?:contracts|test|script|docs)\/([A-Za-z0-9_][A-Za-z0-9_-]*\/)*[A-Za-z0-9_][A-Za-z0-9_.-]*\.(?:sol|md)|frontend\/([A-Za-z0-9_][A-Za-z0-9_-]*\/)*[A-Za-z0-9_][A-Za-z0-9_.-]*\.(?:jsx|js|html|css|json|svg|md))$/;

export const STUDIO_FILE_RULE =
  'Files live under contracts/, test/, script/ or docs/ as .sol or .md, or under frontend/ as .jsx, .js, .css, .html, .json, .svg or .md';

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const blueprintId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const role = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(10_000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue).max(64),
    z.record(z.string(), jsonValue),
  ]),
);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  blueprintIds: z.array(blueprintId).max(4).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  networks: z.record(role, z.string().min(1).max(64)).optional(),
  params: z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), jsonValue).optional(),
});

export const bindL1Schema = z.object({
  stage: z.enum(['testnet', 'production']),
  /** The L1's TeleporterRegistry, when ICM was set up after genesis; checked on-chain. */
  teleporterRegistry: address.optional(),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('node'), nodeId: z.string().uuid() }),
    z.object({ kind: z.literal('catalog'), chainId: z.number().int().positive() }),
    /** An L1 from the console's list; the server looks up an RPC it trusts for it. */
    z.object({
      kind: z.literal('console'),
      blockchainId: z.string().min(20).max(64),
      evmChainId: z.number().int().positive(),
    }),
  ]),
});

export const l1RelayerSchema = z.object({
  stage: z.enum(['testnet', 'production']),
  /** The builder confirms a relayer now serves the bound L1. */
  relayerRunning: z.literal(true),
});

const stepId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const contractName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

/**
 * Deploy steps for the project's own contracts, written by the agent or the
 * builder. The server checks every contract, function and reference against
 * the latest build before it becomes a plan.
 */
export const customPlanSchema = z.object({
  title: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(600),
  /** Role to testnet network key, e.g. { main: "fuji-c-chain" } or { app: "l1" }. */
  networks: z.record(role, z.string().min(1).max(64)),
  steps: z
    .array(
      z.object({
        id: stepId,
        title: z.string().trim().min(1).max(80),
        kind: z.enum(['deploy', 'call', 'read']),
        network: role,
        contract: contractName,
        function: z.string().max(80).optional(),
        target: z.string().max(200).optional(),
        args: z.array(jsonValue).max(20).optional(),
        value: jsonValue.optional(),
        signer: z.enum(['deployer', 'builder']).optional(),
        optional: z.boolean().optional(),
        notes: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(20),
  checks: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        after: stepId,
        network: role,
        contract: contractName,
        target: z.string().max(200),
        function: z.string().max(80),
        args: z.array(jsonValue).max(10).optional(),
        expect: z.union([
          z.object({ equals: jsonValue }),
          z.object({ gt: jsonValue }),
          z.object({ gte: jsonValue }),
          z.object({ nonZero: z.literal(true) }),
        ]),
      }),
    )
    .max(10)
    .default([]),
});

/** A whole project as the browser read it; the server decides what to keep and where it goes. */
export const importProjectSchema = z.object({
  files: z
    .array(z.object({ path: z.string().min(1).max(400), content: z.string().max(1024 * 1024) }))
    .min(1)
    .max(2000),
  about: z.string().trim().max(2000).default(''),
  needs: z
    .array(z.enum(['improve', 'audit', 'deploy']))
    .max(3)
    .default([]),
});

export const writeFileSchema = z.object({
  path: z.string().regex(STUDIO_FILE_PATH, STUDIO_FILE_RULE),
  content: z.string().max(MAX_STUDIO_FILE_BYTES),
});

export const acknowledgeSchema = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  reason: z.string().trim().min(10, 'Say why this cannot be exploited here').max(500),
});

export const reviewSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        status: z.enum(['pass', 'fail', 'na']),
        evidence: z.string().max(500),
      }),
    )
    .max(80),
});

export const proposeDeploymentSchema = z.object({
  blueprintId,
  networks: z.record(role, z.string().min(1).max(64)).optional(),
  params: z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), jsonValue).optional(),
});

export const nextStepSchema = z.object({
  signer: address,
  /** Production steps are prepared only after the builder confirms each one in the Studio. */
  confirmProduction: z.boolean().optional(),
});

export const reportStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tx'), stepId: blueprintId, txHash }),
  z.object({ kind: z.literal('confirm'), stepId: blueprintId }),
  z.object({ kind: z.literal('skip'), stepId: blueprintId, reason: z.string().trim().min(3).max(300) }),
  z.object({
    kind: z.literal('offchain'),
    stepId: blueprintId,
    txHash: txHash.optional(),
    outputs: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}$/), z.string().max(80)).optional(),
  }),
]);

export const panelReadSchema = z.object({
  stepId: blueprintId,
  function: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  args: z.array(jsonValue).max(16).default([]),
});

export const createPromotionSchema = z.object({
  deploymentId: z.string().uuid(),
  testsConfirmed: z.literal(true, { message: 'Confirm the Foundry tests pass first' }),
});

export const createChatSchema = z.object({ title: z.string().trim().min(1).max(80).optional() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type BindL1Input = z.infer<typeof bindL1Schema>;
export type ProposeDeploymentInput = z.infer<typeof proposeDeploymentSchema>;
export type CustomPlanInput = z.infer<typeof customPlanSchema>;
export type ReportStepInput = z.infer<typeof reportStepSchema>;
