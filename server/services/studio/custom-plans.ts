import type { Abi, AbiFunction } from 'viem';
import type { BlueprintManifest, Registry } from '@/lib/blueprints';
import { collectRefs, lookupPath, parseRef } from '@/lib/blueprints/refs';
import { BlueprintManifestSchema } from '@/lib/blueprints/schema';
import type { CustomPlanInput } from '@/types/studio';
import type { StoredContract } from './builds';
import { StudioError } from './errors';

export const CUSTOM_PLAN_ID = 'custom-plan';

const functions = (abi: Abi | undefined, name: string) =>
  (abi ?? []).filter((item): item is AbiFunction => item.type === 'function' && item.name === name);

/**
 * The manifest for a plan over the project's own contracts, in the same shape
 * blueprints use, so the runner, checks and audit gate treat it the same way.
 * Throws with every problem at once, so the agent can fix the plan in one go.
 */
export function customManifest(
  input: CustomPlanInput,
  contracts: StoredContract[],
  registry: Registry,
): BlueprintManifest {
  const issues: string[] = [];
  const roles = Object.keys(input.networks);
  if (roles.length === 0 || roles.length > 4) issues.push('Name one to four network roles');
  for (const [role, key] of Object.entries(input.networks)) {
    const entry = registry.networks[key];
    if (!entry) issues.push(`network ${role}: unknown network ${key}`);
    else if (!entry.testnet) issues.push(`network ${role}: ${key} is not a testnet; plans run on testnet first`);
  }

  const built = (name: string) => contracts.filter((c) => c.name === name && c.file.startsWith('contracts/'));
  const stepIndex = new Map(input.steps.map((s, i) => [s.id, i]));
  if (stepIndex.size !== input.steps.length) issues.push('Step ids must be unique');

  const checkRefs = (value: unknown, where: string, before: number) => {
    for (const ref of collectRefs(value)) {
      const parsed = parseRef(ref);
      if (!parsed) {
        issues.push(`${where}: malformed reference ${ref}`);
        continue;
      }
      const [head, ...rest] = parsed.path;
      switch (parsed.scope) {
        case 'param':
          issues.push(`${where}: ${ref}: plans for your own contracts take no parameters; write the value itself`);
          break;
        case 'ctx':
          if (head !== 'deployer' && head !== 'builder') issues.push(`${where}: ${ref} is not deployer or builder`);
          break;
        case 'reg':
          if (!lookupPath(registry, parsed.path).found) issues.push(`${where}: ${ref} is not in the registry`);
          break;
        case 'net': {
          const key = input.networks[head];
          if (!key) issues.push(`${where}: ${ref} uses undeclared role ${head}`);
          else if (registry.networks[key] && !lookupPath(registry.networks[key], rest).found)
            issues.push(`${where}: ${ref} is not available on ${key}`);
          break;
        }
        case 'out': {
          const index = stepIndex.get(head);
          if (index === undefined) {
            issues.push(`${where}: ${ref} names unknown step ${head}`);
            break;
          }
          if (index >= before) issues.push(`${where}: ${ref} is used before step ${head} runs`);
          const step = input.steps[index];
          const field = rest[0];
          const known =
            field === 'address' ? step.kind === 'deploy' : field === 'txHash' ? step.kind !== 'read' : false;
          if (!known) issues.push(`${where}: step ${head} has no output ${field}; use address (deploy) or txHash`);
          break;
        }
      }
    }
  };

  const expectArity = (abi: Abi | undefined, contract: string, fn: string, arity: number, where: string) => {
    const candidates = functions(abi, fn);
    if (candidates.length === 0) issues.push(`${where}: ${contract} has no function ${fn}`);
    else if (!candidates.some((f) => f.inputs.length === arity)) {
      issues.push(
        `${where}: ${contract}.${fn} takes ${candidates.map((f) => f.inputs.length).join(' or ')} arguments, got ${arity}`,
      );
    }
  };

  input.steps.forEach((step, i) => {
    const where = `step ${step.id}`;
    if (!input.networks[step.network]) issues.push(`${where}: undeclared network role ${step.network}`);
    const matches = built(step.contract);
    if (matches.length === 0) {
      issues.push(`${where}: the latest build has no contract ${step.contract}; compile first or check the name`);
    } else if (matches.length > 1) {
      issues.push(`${where}: ${step.contract} is defined in ${matches.map((m) => m.file).join(' and ')}; rename one`);
    }
    const contract = matches[0];
    const abi = contract?.abi as Abi | undefined;
    const arity = step.args?.length ?? 0;
    if (step.kind === 'deploy') {
      if (step.target || step.function) issues.push(`${where}: a deploy step takes no target or function`);
      if (contract && !contract.deployable)
        issues.push(`${where}: ${step.contract} is not deployable (an interface, abstract, or needs library linking)`);
      const ctor = (abi ?? []).find((item) => item.type === 'constructor') as { inputs?: unknown[] } | undefined;
      const expected = ctor?.inputs?.length ?? 0;
      if (contract && expected !== arity)
        issues.push(`${where}: ${step.contract}'s constructor takes ${expected} arguments, got ${arity}`);
    } else {
      if (!step.target || !step.function) issues.push(`${where}: a ${step.kind} step needs a target and a function`);
      else if (contract) expectArity(abi, step.contract, step.function, arity, where);
    }
    checkRefs([step.target, step.args, step.value], where, i);
  });

  input.checks.forEach((check, i) => {
    const where = `check ${i + 1}`;
    const after = stepIndex.get(check.after);
    if (after === undefined) issues.push(`${where}: runs after unknown step ${check.after}`);
    if (!input.networks[check.network]) issues.push(`${where}: undeclared network role ${check.network}`);
    const contract = built(check.contract)[0];
    if (!contract) issues.push(`${where}: the latest build has no contract ${check.contract}`);
    else expectArity(contract.abi as Abi, check.contract, check.function, check.args?.length ?? 0, where);
    checkRefs([check.target, check.args, check.expect], where, (after ?? -1) + 1);
  });

  if (issues.length) throw new StudioError(400, `This plan has problems:\n- ${issues.join('\n- ')}`, 'invalid_plan');

  const used = [...new Set([...input.steps.map((s) => s.contract), ...input.checks.map((c) => c.contract)])];
  const views = (name: string) =>
    ((built(name)[0]?.abi ?? []) as Abi)
      .filter(
        (item): item is AbiFunction =>
          item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure') &&
          item.inputs.length === 0,
      )
      .map((f) => f.name)
      .slice(0, 12);

  const manifest = {
    id: CUSTOM_PLAN_ID,
    version: 1,
    title: input.title,
    summary: input.title.slice(0, 60),
    description: input.description,
    category: 'infra',
    level: 'intermediate',
    tags: ['custom'],
    prompts: [input.title, input.description.slice(0, 200)],
    networks: Object.fromEntries(
      Object.entries(input.networks).map(([role, key]) => [
        role,
        { description: `${role} network`, default: key, allowed: [key] },
      ]),
    ),
    params: [],
    prerequisites: ['The signing wallet holds gas on every network in the plan'],
    contracts: used.map((name) => ({ name, description: `${name} from this project`, source: built(name)[0].file })),
    steps: input.steps.map((s) => ({ ...s, signer: s.kind === 'read' ? undefined : (s.signer ?? 'deployer') })),
    checks: input.checks,
    panel: input.steps
      .filter((s) => s.kind === 'deploy')
      .map((s) => ({ step: s.id, read: views(s.contract), write: [] })),
    review: [
      "Studio wrote this plan for the project's own contracts. Read each step and its arguments before signing.",
    ],
    frontend: {
      summary: 'Deployed from a plan written for this project.',
      audience: ["The project's end users, as the builder or docs/BRIEF.md describes them"],
      journeys: ['Ask the builder who opens the app and what they come to do, then design those journeys.'],
      flows: ['Read the deployed contracts from the Contracts tab.'],
    },
    docs: [],
  };
  const parsed = BlueprintManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new StudioError(
      400,
      `This plan has problems:\n- ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n- ')}`,
      'invalid_plan',
    );
  }
  return parsed.data;
}
