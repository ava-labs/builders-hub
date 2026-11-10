import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { BLUEPRINTS_DIR, listBlueprintIds, loadBlueprint, loadRegistry, type LoadedBlueprint } from './index';
import { collectRefs, lookupPath, parseRef } from './refs';
import { CTX_NAMES, type Registry } from './schema';

export interface BlueprintIssue {
  blueprint: string;
  message: string;
}

interface AbiItem {
  type: string;
  name?: string;
  inputs?: { name: string; type: string }[];
  stateMutability?: string;
}

/** Hex literals exactly 40 digits long; 32-byte ids such as blockchain IDs don't match. */
const RAW_ADDRESS = /\b0x[0-9a-fA-F]{40}\b/g;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function readAbi(file: string): AbiItem[] | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed.abi) ? parsed.abi : null;
  } catch {
    return null;
  }
}

function isView(item: AbiItem): boolean {
  return item.stateMutability === 'view' || item.stateMutability === 'pure';
}

function hasFunction(abi: AbiItem[], name: string, arity: number): boolean {
  return abi.some((item) => item.type === 'function' && item.name === name && (item.inputs?.length ?? 0) === arity);
}

/** Files a site-relative docs link can render from, or null for external links. */
function docFiles(url: string, repoRoot: string): string[] | null {
  if (!url.startsWith('/')) return null;
  const [section, ...rest] = url.split('#')[0].replace(/\/$/, '').split('/').slice(1);
  const sub = rest.join('/');
  if (section === 'console') return [path.join(repoRoot, 'app', 'console', sub, 'page.tsx')];
  const base = path.join(repoRoot, 'content', section, sub);
  return [`${base}.mdx`, `${base}.md`, path.join(base, 'index.mdx')];
}

function describe(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
  return error instanceof Error ? error.message : String(error);
}

export function validateRegistry(registry: Registry, repoRoot: string): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  const report = (message: string) => issues.push({ blueprint: '_shared', message });

  for (const [key, network] of Object.entries(registry.networks)) {
    for (const token of [...(network.ccip?.feeTokens ?? []), ...(network.ccip?.transferableTokens ?? [])]) {
      if (token !== 'native' && !network.tokens[token]) report(`${key}: CCIP token ${token} has no entry under tokens`);
    }
  }

  // The console reads eERC deployments from constants/; the registry must not drift from it.
  const deploymentsFile = path.join(repoRoot, 'constants', 'eerc-deployments.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8')).deployments ?? {};
  for (const [key, network] of Object.entries(registry.networks)) {
    if (!network.eerc || !network.evmChainId) continue;
    const canonical = deployments[String(network.evmChainId)];
    if (!canonical?.standalone || !canonical?.converter) {
      report(`${key}: eerc has no matching entry in constants/eerc-deployments.json`);
      continue;
    }
    const expected: Record<string, string | undefined> = {
      standalone: canonical.standalone.encryptedERC,
      converter: canonical.converter.encryptedERC,
      registrar: canonical.standalone.registrar,
      babyJubJubLibrary: canonical.standalone.babyJubJubLibrary,
      ...Object.fromEntries(
        Object.keys(network.eerc.verifiers).map((name) => [`verifiers.${name}`, canonical.standalone.verifiers?.[name]]),
      ),
    };
    for (const [field, value] of Object.entries(expected)) {
      const actual = lookupPath(network.eerc, field.split('.')).value;
      if (typeof actual !== 'string' || actual.toLowerCase() !== value?.toLowerCase()) {
        report(`${key}: eerc.${field} differs from constants/eerc-deployments.json`);
      }
    }
  }
  return issues;
}

export function validateBlueprint(
  blueprint: LoadedBlueprint,
  registry: Registry,
  repoRoot: string,
  knownIds: ReadonlySet<string>,
): BlueprintIssue[] {
  const { manifest } = blueprint;
  const issues: BlueprintIssue[] = [];
  const report = (message: string) => issues.push({ blueprint: manifest.id, message });

  const folder = path.basename(blueprint.dir);
  if (folder !== manifest.id) report(`id "${manifest.id}" does not match folder "${folder}"`);
  if (blueprint.guide.trim().length === 0) report('GUIDE.md is missing or empty');

  for (const [role, spec] of Object.entries(manifest.networks)) {
    if (!spec.allowed.includes(spec.default)) report(`network role ${role}: default ${spec.default} is not allowed`);
    for (const network of spec.allowed) {
      if (!registry.networks[network]) report(`network role ${role}: unknown network ${network}`);
    }
  }

  const contracts = new Map<string, AbiItem[] | null>();
  for (const contract of manifest.contracts) {
    if (contracts.has(contract.name)) report(`contract ${contract.name} is declared twice`);
    if (contract.source) {
      if (!fs.existsSync(path.join(blueprint.dir, contract.source))) report(`contract ${contract.name}: missing ${contract.source}`);
      contracts.set(contract.name, null);
    } else if (contract.artifact) {
      const abi = readAbi(path.join(repoRoot, contract.artifact));
      if (!abi) report(`contract ${contract.name}: missing or unreadable ${contract.artifact}`);
      contracts.set(contract.name, abi);
    }
  }
  const abiOf = (name: string | undefined) => (name ? (contracts.get(name) ?? null) : null);

  const stepIndex = new Map<string, number>();
  manifest.steps.forEach((step, index) => {
    if (stepIndex.has(step.id)) report(`step id ${step.id} is used twice`);
    stepIndex.set(step.id, index);
  });
  const params = new Set(manifest.params.map((param) => param.name));

  /** `before` is the index of the first step whose outputs are not available yet. */
  const checkRef = (ref: string, where: string, before: number) => {
    const parsed = parseRef(ref);
    if (!parsed) return report(`${where}: malformed reference ${ref}`);
    const [head, ...rest] = parsed.path;
    switch (parsed.scope) {
      case 'param':
        if (!params.has(head) || rest.length > 0) report(`${where}: ${ref} names an undeclared parameter`);
        break;
      case 'ctx':
        if (!(CTX_NAMES as readonly string[]).includes(head) || rest.length > 0) report(`${where}: ${ref} is not a context value`);
        break;
      case 'reg': {
        const found = lookupPath(registry, parsed.path);
        if (!found.found || found.value === null) report(`${where}: ${ref} is not in the registry`);
        break;
      }
      case 'net': {
        const spec = manifest.networks[head];
        if (!spec) {
          report(`${where}: ${ref} uses undeclared network role ${head}`);
          break;
        }
        for (const network of spec.allowed) {
          const entry = registry.networks[network];
          if (entry && !lookupPath(entry, rest).found) report(`${where}: ${ref} is not available on ${network}`);
        }
        break;
      }
      case 'out': {
        const index = stepIndex.get(head);
        if (index === undefined) {
          report(`${where}: ${ref} names unknown step ${head}`);
          break;
        }
        if (index >= before) report(`${where}: ${ref} is used before step ${head} runs`);
        const step = manifest.steps[index];
        const field = rest[0];
        const known =
          field === 'address'
            ? step.kind === 'deploy'
            : field === 'txHash'
              ? step.kind === 'deploy' || step.kind === 'call'
              : Boolean(step.outputs && field in step.outputs);
        if (!known) report(`${where}: step ${head} has no output ${field}`);
        break;
      }
    }
  };

  for (const param of manifest.params) {
    for (const ref of collectRefs(param.default)) checkRef(ref, `param ${param.name}`, 0);
  }

  manifest.steps.forEach((step, index) => {
    const where = `step ${step.id}`;
    if (!manifest.networks[step.network]) report(`${where}: undeclared network role ${step.network}`);
    if (step.contract && !contracts.has(step.contract)) report(`${where}: undeclared contract ${step.contract}`);

    const refs = collectRefs([step.target, step.args, step.value, step.libraries, step.inputs, step.wait, step.skipIf]);
    for (const ref of refs) checkRef(ref, where, index);

    const abi = abiOf(step.contract);
    if (abi && step.kind === 'deploy') {
      const expected = abi.find((item) => item.type === 'constructor')?.inputs?.length ?? 0;
      const given = step.args?.length ?? 0;
      if (given !== expected) report(`${where}: ${step.contract} constructor takes ${expected} arguments, got ${given}`);
    }
    if (abi && (step.kind === 'call' || step.kind === 'read') && step.function) {
      const arity = step.args?.length ?? 0;
      if (!hasFunction(abi, step.function, arity)) report(`${where}: ${step.contract} has no ${step.function} with ${arity} arguments`);
    }

    for (const [name, source] of Object.entries(step.outputs ?? {})) {
      if (source.startsWith('event:')) {
        const [contractName, eventName, argName] = source.slice('event:'.length).split('.');
        if (!contracts.has(contractName)) {
          report(`${where}: output ${name} reads an event of undeclared contract ${contractName}`);
          continue;
        }
        const eventAbi = abiOf(contractName);
        const hasEvent = eventAbi?.some(
          (item) => item.type === 'event' && item.name === eventName && item.inputs?.some((input) => input.name === argName),
        );
        if (eventAbi && !hasEvent) report(`${where}: ${contractName} has no event ${eventName} with argument ${argName}`);
      } else if (source.startsWith('return') && step.kind !== 'read') {
        report(`${where}: output ${name} reads a return value, which only read steps have`);
      } else if (source.startsWith('result.') && step.kind !== 'offchain' && step.kind !== 'wait') {
        report(`${where}: output ${name} reads a result, which only offchain and wait steps have`);
      }
    }
  });

  manifest.checks.forEach((check, index) => {
    const where = `check ${index + 1}`;
    const after = stepIndex.get(check.after);
    if (after === undefined) report(`${where}: runs after unknown step ${check.after}`);
    if (!manifest.networks[check.network]) report(`${where}: undeclared network role ${check.network}`);
    if (!contracts.has(check.contract)) report(`${where}: undeclared contract ${check.contract}`);
    for (const ref of collectRefs([check.target, check.args, check.expect])) checkRef(ref, where, (after ?? -1) + 1);
    const abi = abiOf(check.contract);
    const arity = check.args?.length ?? 0;
    if (abi && !hasFunction(abi, check.function, arity)) report(`${where}: ${check.contract} has no ${check.function} with ${arity} arguments`);
  });

  for (const entry of manifest.panel) {
    const index = stepIndex.get(entry.step);
    const step = index === undefined ? undefined : manifest.steps[index];
    if (!step || step.kind !== 'deploy') {
      report(`panel: ${entry.step} is not a deploy step`);
      continue;
    }
    const abi = abiOf(step.contract);
    if (!abi) continue;
    for (const name of entry.read) {
      if (!abi.some((item) => item.type === 'function' && item.name === name && isView(item))) report(`panel: ${step.contract}.${name} is not a view function`);
    }
    for (const name of entry.write) {
      if (!abi.some((item) => item.type === 'function' && item.name === name && !isView(item))) report(`panel: ${step.contract}.${name} does not change state`);
    }
  }

  for (const id of manifest.related ?? []) {
    if (id === manifest.id || !knownIds.has(id)) report(`related blueprint ${id} does not exist`);
  }

  for (const doc of manifest.docs) {
    const files = docFiles(doc.url, repoRoot);
    if (files && !files.some((file) => fs.existsSync(file))) report(`doc link ${doc.url} does not resolve to a page`);
  }

  const texts: [string, string][] = [
    ['blueprint.json', fs.readFileSync(path.join(blueprint.dir, 'blueprint.json'), 'utf8')],
    ['GUIDE.md', blueprint.guide],
    ...blueprint.sources.map((source): [string, string] => [source.path, source.content]),
  ];
  for (const [file, text] of texts) {
    for (const match of text.match(RAW_ADDRESS) ?? []) {
      if (match.toLowerCase() !== ZERO_ADDRESS) report(`${file} hardcodes ${match}; reference the registry instead`);
    }
  }

  return issues;
}

/** Every problem across the registry and all blueprints. An empty array means the directory is consistent. */
export function validateAll(root = BLUEPRINTS_DIR, repoRoot = path.dirname(root)): BlueprintIssue[] {
  let registry: Registry;
  try {
    registry = loadRegistry(root);
  } catch (error) {
    return [{ blueprint: '_shared', message: `networks.json: ${describe(error)}` }];
  }

  const issues = validateRegistry(registry, repoRoot);
  const ids = listBlueprintIds(root);
  const known = new Set(ids);
  for (const id of ids) {
    try {
      issues.push(...validateBlueprint(loadBlueprint(id, root), registry, repoRoot, known));
    } catch (error) {
      issues.push({ blueprint: id, message: describe(error) });
    }
  }
  return issues;
}
