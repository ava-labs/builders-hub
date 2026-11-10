import 'server-only';
import { tool } from 'ai';
import { z } from 'zod';
import { formatBlueprintForModel, formatCatalogForModel, listBlueprintIds, loadRegistry } from '@/lib/blueprints';
import { lookupPath } from '@/lib/blueprints/refs';
import { formatReportForModel } from '@/lib/studio/audit/format';
import { MAX_STUDIO_FILE_BYTES, STUDIO_FILE_PATH, customPlanSchema } from '@/types/studio';
import { buildProject, recordReview } from '../builds';
import type { RuntimeBindings } from '../chain';
import { deploymentView, proposeCustomDeployment, proposeDeployment } from '../deployments';
import { StudioError } from '../errors';
import { deleteFile, listFiles, readFile, writeFile } from '../files';
import { formatFrontendContextForModel, frontendContext } from '../frontend';
import { addBlueprint, getOwnedProject, updateProject } from '../projects';
import { promotionPreview } from '../promotions';
import { prisma } from '@/prisma/prisma';
import { SKILLS, loadSkill } from './context';

const MAX_TOOL_OUTPUT = 60_000;
const clip = (text: string) =>
  text.length > MAX_TOOL_OUTPUT ? `${text.slice(0, MAX_TOOL_OUTPUT)}\n… [truncated]` : text;

/** Tool errors go back to the model as text it can act on, not as a failed stream. */
async function run<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StudioError) return { error: error.message };
    if (error instanceof Error && error.name === 'PlanError') return { error: error.message };
    throw error;
  }
}

const blueprintId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .describe('Blueprint id from the catalog');
const jsonRecord = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export function studioTools(userId: string, projectId: string) {
  return {
    list_blueprints: tool({
      description: 'The blueprint catalog: id, title, summary and example prompts for every template.',
      inputSchema: z.object({}),
      execute: async () => formatCatalogForModel(),
    }),

    read_blueprint: tool({
      description:
        "One blueprint in full: guide, manifest, reference contracts, tests, and every registry value it uses, resolved for this project's networks.",
      inputSchema: z.object({ id: blueprintId }),
      execute: async ({ id }) =>
        run(async () => {
          if (!listBlueprintIds().includes(id)) throw new StudioError(404, `No blueprint "${id}"`);
          const project = await getOwnedProject(userId, projectId);
          const runtime = ((project.runtime ?? {}) as RuntimeBindings).testnet;
          return clip(
            formatBlueprintForModel(id, {
              bindings: { networks: project.networks as Record<string, string>, runtime },
            }),
          );
        }),
    }),

    use_blueprint: tool({
      description:
        'Add a blueprint to the project: copies its contracts and tests into the project files (never overwriting) and sets default networks.',
      inputSchema: z.object({ id: blueprintId }),
      execute: async ({ id }) => run(() => addBlueprint(userId, projectId, id)),
    }),

    list_files: tool({
      description: "List the project's files with their sizes.",
      inputSchema: z.object({}),
      execute: async () =>
        run(async () =>
          (await listFiles(userId, projectId, { withContent: true })).map((f) => ({
            path: f.path,
            bytes: Buffer.byteLength(f.content ?? ''),
          })),
        ),
    }),

    read_file: tool({
      description: 'Read one project file.',
      inputSchema: z.object({ path: z.string().regex(STUDIO_FILE_PATH) }),
      execute: async ({ path }) => run(async () => clip((await readFile(userId, projectId, path)).content)),
    }),

    write_file: tool({
      description:
        'Create or replace a project file: .sol or .md under contracts/, test/, script/ or docs/, or the React app under frontend/ (App.jsx is the required root component; components/*.jsx, styles.css). Write the whole file. Every contract you change needs its test in test/.',
      inputSchema: z.object({
        path: z.string().regex(STUDIO_FILE_PATH),
        content: z.string().max(MAX_STUDIO_FILE_BYTES),
      }),
      execute: async ({ path, content }) => run(() => writeFile(userId, projectId, path, content)),
    }),

    delete_file: tool({
      description: 'Delete a project file.',
      inputSchema: z.object({ path: z.string().regex(STUDIO_FILE_PATH) }),
      execute: async ({ path }) =>
        run(async () => {
          await deleteFile(userId, projectId, path);
          return { deleted: path };
        }),
    }),

    compile_and_audit: tool({
      description:
        'Compile contracts/ with the shared settings (solc 0.8.28, cancun, optimizer 200) and run the static audit on the result.',
      inputSchema: z.object({}),
      execute: async () =>
        run(async () => {
          const { build, report } = await buildProject(userId, projectId);
          const diagnostics = (
            build.diagnostics as { severity: string; message: string; file?: string; line?: number }[]
          ).map((d) => `${d.severity}: ${d.file ? `${d.file}:${d.line ?? '?'} ` : ''}${d.message}`);
          const contracts = (build.contracts as { file: string; name: string; deployable: boolean }[]).map(
            (c) => `${c.file}:${c.name}${c.deployable ? '' : ' (not deployable)'}`,
          );
          return clip(
            [
              `Build ${build.ok ? 'succeeded' : 'FAILED'} with ${build.compiler || 'solc'}.`,
              diagnostics.length ? `Diagnostics:\n${diagnostics.join('\n')}` : 'No diagnostics.',
              contracts.length ? `Contracts: ${contracts.join(', ')}` : '',
              report ? formatReportForModel(report) : 'Audit skipped: fix the build first.',
            ]
              .filter(Boolean)
              .join('\n\n'),
          );
        }),
    }),

    record_review: tool({
      description: "Store the results of review.md and the blueprint's review items on the latest audit.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({ id: z.string().max(64), status: z.enum(['pass', 'fail', 'na']), evidence: z.string().max(500) }),
          )
          .max(80),
      }),
      execute: async ({ items }) =>
        run(async () => {
          await recordReview(userId, projectId, items);
          return { recorded: items.length, failing: items.filter((i) => i.status === 'fail').map((i) => i.id) };
        }),
    }),

    set_config: tool({
      description: 'Set network roles (role to network key, testnets only) and blueprint parameters for the project.',
      inputSchema: z.object({ networks: z.record(z.string(), z.string()).optional(), params: jsonRecord.optional() }),
      execute: async ({ networks, params }) =>
        run(async () => {
          const registry = loadRegistry();
          const mainnet = Object.values(networks ?? {}).filter((n) => registry.networks[n]?.testnet === false);
          if (mainnet.length)
            throw new StudioError(
              400,
              `${mainnet.join(', ')} is production. Use testnets; production comes through Migrate to production.`,
            );
          const project = await updateProject(userId, projectId, { networks, params });
          return { networks: project.networks, params: project.params };
        }),
    }),

    propose_deployment: tool({
      description:
        'Create a testnet deployment plan for a blueprint in this project. Requires a passing build and audit. The builder starts it from the deploy runner and signs each step with their wallet.',
      inputSchema: z.object({
        blueprintId,
        networks: z.record(z.string(), z.string()).optional(),
        params: jsonRecord.optional(),
      }),
      execute: async (input) =>
        run(async () => {
          const deployment = await proposeDeployment(userId, projectId, input);
          const view = await deploymentView(userId, projectId, deployment.id);
          return {
            deploymentId: deployment.id,
            networks: view.networks,
            steps: view.steps.map(
              (s) => `${s.id}: ${s.title} (${s.kind} on ${s.network}${s.optional ? ', optional' : ''})`,
            ),
            next: 'Tell the builder the plan is ready to review in the Plan tab. They deploy it from the Deploy tab, where their wallet signs each step.',
          };
        }),
    }),

    propose_custom_deployment: tool({
      description:
        "Create a testnet deployment plan for the project's own contracts when no blueprint fits, for example an imported project. Steps deploy, call or read contracts from the latest passing build, in order. " +
        'Arguments are literals or references: $out.<step>.address (an earlier deploy), $out.<step>.txHash, $ctx.deployer or $ctx.builder (the signing wallet), $net.<role>.<path> (e.g. $net.main.tokens.USDC.address), $reg.<path>. ' +
        'Networks map roles to testnet keys such as fuji-c-chain or l1. The server rejects the plan with every problem listed if a contract, function, argument count or reference does not match the build.',
      inputSchema: customPlanSchema,
      execute: async (input) =>
        run(async () => {
          const deployment = await proposeCustomDeployment(userId, projectId, input);
          const view = await deploymentView(userId, projectId, deployment.id);
          return {
            deploymentId: deployment.id,
            networks: view.networks,
            steps: view.steps.map(
              (s) => `${s.id}: ${s.title} (${s.kind} on ${s.network}${s.optional ? ', optional' : ''})`,
            ),
            next: 'Tell the builder the plan is ready to review in the Plan tab. They deploy it from the Deploy tab, where their wallet signs each step.',
          };
        }),
    }),

    deployment_status: tool({
      description:
        'Steps, deployed addresses, explorer links and check results of a deployment (the latest if no id is given).',
      inputSchema: z.object({ deploymentId: z.string().uuid().optional() }),
      execute: async ({ deploymentId }) =>
        run(async () => {
          const id =
            deploymentId ??
            (
              await prisma.studioDeployment.findFirst({
                where: { project_id: (await getOwnedProject(userId, projectId)).id },
                orderBy: { created_at: 'desc' },
                select: { id: true },
              })
            )?.id;
          if (!id) throw new StudioError(404, 'No deployments yet');
          const view = await deploymentView(userId, projectId, id);
          return {
            id: view.id,
            stage: view.stage,
            status: view.status,
            steps: view.steps.map((s) => ({
              id: s.id,
              status: s.state?.status ?? 'pending',
              address: s.state?.address,
              tx: s.txUrl,
              error: s.state?.error,
            })),
            checks: view.checks,
            contracts: view.contracts.map((c) => ({
              contract: c.contract,
              network: c.network,
              address: c.address,
              url: c.addressUrl,
            })),
          };
        }),
    }),

    promotion_status: tool({
      description: 'Whether a testnet deployment can be promoted to production, gate by gate.',
      inputSchema: z.object({ deploymentId: z.string().uuid() }),
      execute: async ({ deploymentId }) => run(() => promotionPreview(userId, projectId, deploymentId)),
    }),

    load_skill: tool({
      description:
        'Load a skill: testing (Foundry unit, fuzz, invariant and cross-chain tests), auditing (detectors, OWASP 2026 review, severity, production gate), frontend (the React app under frontend/: the @studio/react hooks, what an app may import, the end-user rules), design-system (the Builder Hub explorer look as builder-hub.css classes and page patterns) or eerc (Encrypted ERC screens with useEERC: private account, balance, deposit, send, withdraw, mint, as templates).',
      inputSchema: z.object({ name: z.enum(SKILLS) }),
      execute: async ({ name }) => loadSkill(name),
    }),

    frontend_context: tool({
      description:
        'The deployed testnet contracts the frontend runs against (address, chain, function signatures, events), the chains, and the frontend/ files. The React app reads the same contracts by name through the @studio/react hooks. Use it to check what the end user flows can do, not as the list of screens.',
      inputSchema: z.object({}),
      execute: async () =>
        run(async () => clip(formatFrontendContextForModel(await frontendContext(userId, projectId)))),
    }),

    registry_lookup: tool({
      description: 'One value from the verified network registry, e.g. network fuji-c-chain, path ccip.router.',
      inputSchema: z.object({ network: z.string(), path: z.string().regex(/^[A-Za-z0-9_\-/]+(\.[A-Za-z0-9_\-/]+)*$/) }),
      execute: async ({ network, path }) => {
        const entry = loadRegistry().networks[network];
        if (!entry) return { error: `Unknown network ${network}` };
        const { found, value } = lookupPath(entry, path.split('.'));
        return found && value !== null
          ? { value }
          : { error: `${network} has no value at ${path}${found ? ' yet (known only at run time)' : ''}` };
      },
    }),
  };
}
