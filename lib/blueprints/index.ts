import fs from 'node:fs';
import path from 'node:path';
import {
  BlueprintManifestSchema,
  CATEGORIES,
  CompilerSettingsSchema,
  RegistrySchema,
  type BlueprintManifest,
  type Category,
  type CompilerSettings,
  type Registry,
} from './schema';
import { collectRefs, resolveRef, UnresolvedRefError, type Bindings } from './refs';

export { resolveRef, resolveDeep, boundNetwork, UnresolvedRefError, type Bindings } from './refs';
export type {
  BlueprintManifest,
  BlueprintStep,
  BlueprintCheck,
  Registry,
  NetworkEntry,
  CompilerSettings,
  Category,
} from './schema';

/** Blueprints are read from disk, so an API route that uses them needs `blueprints/**` in outputFileTracingIncludes. */
export const BLUEPRINTS_DIR = path.join(process.cwd(), 'blueprints');

const SHARED_DIR = '_shared';

export interface BlueprintSource {
  /** Relative to the blueprint folder. */
  path: string;
  content: string;
}

export interface LoadedBlueprint {
  manifest: BlueprintManifest;
  /** Absolute path of the blueprint folder. */
  dir: string;
  guide: string;
  /** Every file under contracts/, manifest-listed ones first; includes helper libraries. */
  sources: BlueprintSource[];
  /** Foundry tests under test/. */
  tests: BlueprintSource[];
}

export interface CatalogEntry {
  id: string;
  title: string;
  summary: string;
  category: Category;
  level: BlueprintManifest['level'];
  tags: string[];
  prompts: string[];
  /** Role to default network. */
  networks: Record<string, string>;
}

const CATEGORY_LABELS: Record<Category, string> = {
  payments: 'Payments',
  defi: 'DeFi',
  data: 'Data',
  interop: 'Interop',
  privacy: 'Privacy',
  infra: 'Infra',
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadRegistry(root = BLUEPRINTS_DIR): Registry {
  return RegistrySchema.parse(readJson(path.join(root, SHARED_DIR, 'networks.json')));
}

export function loadCompilerDefaults(root = BLUEPRINTS_DIR): CompilerSettings {
  return CompilerSettingsSchema.parse(readJson(path.join(root, SHARED_DIR, 'compiler.json')));
}

/** The shared model guidance: the agent workflow, the pre-deploy review, and the deploy pipeline. */
export function loadSharedGuide(name: 'agent' | 'review' | 'deploy', root = BLUEPRINTS_DIR): string {
  return fs.readFileSync(path.join(root, SHARED_DIR, `${name}.md`), 'utf8');
}

export function listBlueprintIds(root = BLUEPRINTS_DIR): string[] {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
}

function solidityFiles(dir: string, sub: string): string[] {
  const base = path.join(dir, sub);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((file) => file.endsWith('.sol'))
    .sort()
    .map((file) => `${sub}/${file}`);
}

export function loadBlueprint(id: string, root = BLUEPRINTS_DIR): LoadedBlueprint {
  const dir = path.join(root, id);
  const manifest = BlueprintManifestSchema.parse(readJson(path.join(dir, 'blueprint.json')));
  const guidePath = path.join(dir, 'GUIDE.md');
  const guide = fs.existsSync(guidePath) ? fs.readFileSync(guidePath, 'utf8') : '';
  const listed = manifest.contracts.flatMap((contract) => (contract.source ? [contract.source] : []));
  const read = (file: string) => ({ path: file, content: fs.readFileSync(path.join(dir, file), 'utf8') });
  const sources = [...new Set([...listed, ...solidityFiles(dir, 'contracts')])].map(read);
  const tests = solidityFiles(dir, 'test').map(read);
  return { manifest, dir, guide, sources, tests };
}

export function listBlueprints(root = BLUEPRINTS_DIR): LoadedBlueprint[] {
  return listBlueprintIds(root).map((id) => loadBlueprint(id, root));
}

export function blueprintCatalog(root = BLUEPRINTS_DIR): CatalogEntry[] {
  return listBlueprints(root).map(({ manifest }) => ({
    id: manifest.id,
    title: manifest.title,
    summary: manifest.summary,
    category: manifest.category,
    level: manifest.level,
    tags: manifest.tags,
    prompts: manifest.prompts,
    networks: Object.fromEntries(Object.entries(manifest.networks).map(([role, spec]) => [role, spec.default])),
  }));
}

/** A compact catalog for the system prompt, grouped by category. */
export function formatCatalogForModel(root = BLUEPRINTS_DIR): string {
  const catalog = blueprintCatalog(root);
  const lines = ['# Blueprint catalog', '', 'Load a blueprint with its id before planning contracts or deployments.'];
  for (const category of CATEGORIES) {
    const entries = catalog.filter((entry) => entry.category === category);
    if (entries.length === 0) continue;
    lines.push('', `## ${CATEGORY_LABELS[category]}`);
    for (const entry of entries) {
      const networks = Object.entries(entry.networks)
        .map(([role, network]) => `${role}=${network}`)
        .join(', ');
      lines.push(
        `- \`${entry.id}\` ${entry.title}: ${entry.summary}. ${entry.level}; ${networks}. Asks like: "${entry.prompts[0]}"`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * Everything the model needs to execute one blueprint: the manifest, the guide,
 * the reference contracts, and each registry value the manifest references,
 * already resolved for the bound networks (defaults unless overridden).
 */
export function formatBlueprintForModel(
  id: string,
  options: { bindings?: Partial<Bindings>; root?: string } = {},
): string {
  const root = options.root ?? BLUEPRINTS_DIR;
  const { manifest, guide, sources, tests } = loadBlueprint(id, root);
  const registry = loadRegistry(root);
  const defaults = Object.fromEntries(Object.entries(manifest.networks).map(([role, spec]) => [role, spec.default]));
  const bindings: Bindings = { ...options.bindings, networks: { ...defaults, ...options.bindings?.networks } };

  // Whole-network references feed off-chain actions; the model only needs to know which chain they are.
  const registryRefs = [
    ...new Set(collectRefs(manifest).filter((ref) => ref.startsWith('$net.') || ref.startsWith('$reg.'))),
  ]
    .filter((ref) => !/^\$net\.[^.]+$/.test(ref))
    .sort();
  const resolved = registryRefs.map((ref) => {
    try {
      const value = resolveRef(ref, registry, bindings);
      return `- \`${ref}\` = ${typeof value === 'string' ? value : JSON.stringify(value)}`;
    } catch (error) {
      return `- \`${ref}\`: ${error instanceof UnresolvedRefError ? error.reason : String(error)}`;
    }
  });

  const boundNetworks = Object.entries(bindings.networks)
    .map(([role, network]) => `${role} = ${network} (${registry.networks[network]?.name ?? 'unknown network'})`)
    .join('; ');
  const runtimeNotes = [...new Set(Object.values(bindings.networks))].flatMap((network) => {
    const note = registry.networks[network]?.$runtime;
    return note && !bindings.runtime?.[network] ? [`Binding \`${network}\`: ${note}`] : [];
  });

  return [
    `# Blueprint: ${manifest.title} (\`${manifest.id}\`)`,
    manifest.description,
    `Networks: ${boundNetworks}`,
    ...runtimeNotes,
    '',
    '## Registry values',
    `Checked on-chain ${registry.verifiedAt}. Use these, never values from memory.`,
    ...(resolved.length > 0 ? resolved : ['- none']),
    '',
    '## Guide',
    guide.trim(),
    '',
    '## Frontend for end users',
    manifest.frontend.summary,
    `Who opens it: ${manifest.frontend.audience.join('; ')}.`,
    'What they come to do:',
    ...manifest.frontend.journeys.map((j) => `- ${j}`),
    'How those journeys call the contracts:',
    ...manifest.frontend.flows.map((f) => `- ${f}`),
    '',
    '## Manifest',
    '```json',
    JSON.stringify(manifest, null, 2),
    '```',
    ...sources.flatMap((source) => ['', `## ${source.path}`, '```solidity', source.content.trim(), '```']),
    ...(tests.length > 0
      ? [
          '',
          '## Tests',
          `Foundry tests that pass against these contracts: ${tests.map((t) => `\`${t.path}\``).join(', ')}. Load them when adapting the blueprint and keep them passing.`,
        ]
      : []),
  ].join('\n');
}
