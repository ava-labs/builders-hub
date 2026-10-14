import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { loadCompilerDefaults } from '@/lib/blueprints';
import { PREVIEW_ENTRY, withBuiltFooter } from '@/components/studio/preview';
import { REACT_ENTRY, hasReactApp } from '@/components/studio/preview-react';
import { builtViaIR } from '@/lib/studio/compile';
import { webAppFiles, webReadme } from '@/lib/studio/export-web';
import { tar } from '@/lib/studio/tar';
import { prisma } from '@/prisma/prisma';
import type { StudioConfig } from '@/templates/studio-web/lib/studio-types';
import { latestBuild } from './builds';
import { designSystemCss, frontendContext } from './frontend';
import { getOwnedProject } from './projects';
import { tokenListIn } from './tokens';

/*
 * The project as a standalone Foundry project: the builder's files, the
 * shared test helpers, the Teleporter interfaces, and a setup script that
 * fetches the same pinned, checksum-verified dependencies the Studio compiles
 * with. `forge test` on the export is what the production gate asks for.
 */

const ICM_ARTIFACTS = [
  'TeleporterMessenger',
  'TeleporterRegistry',
  'ERC20TokenHome',
  'ERC20TokenRemote',
  'NativeTokenHome',
  'NativeTokenRemote',
];

const readRepo = (rel: string) => fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), rel), 'utf8');
const listSol = (rel: string) =>
  fs
    .readdirSync(path.join(/* turbopackIgnore: true */ process.cwd(), rel))
    .filter((f) => f.endsWith('.sol'))
    .sort();

function foundryToml(viaIR: boolean): string {
  const compiler = loadCompilerDefaults();
  return `[profile.default]
src = "contracts"
test = "test"
out = "out"
libs = [".deps"]
solc_version = "${compiler.solc}"
evm_version = "${compiler.evmVersion}"
optimizer = ${compiler.optimizer.enabled}
optimizer_runs = ${compiler.optimizer.runs}
via_ir = ${viaIR}
fuzz = { runs = 256 }
invariant = { runs = 64, depth = 32, fail_on_revert = false }
fs_permissions = [{ access = "read", path = "./artifacts" }]
remappings = [
  "forge-std/=.deps/forge-std/src/",
  "@openzeppelin/contracts@5.3.0/=.deps/@openzeppelin/contracts/",
  "@openzeppelin/contracts/=.deps/@openzeppelin/contracts/",
  "@chainlink/contracts-ccip/=.deps/@chainlink/contracts-ccip/",
  "@teleporter/=shared/teleporter/",
  "@blueprints-test/=test/helpers/",
]
`;
}

function readme(name: string, blueprints: string[], web: string): string {
  return `# ${name}

Exported from Builder Hub Studio${blueprints.length ? `, built from the ${blueprints.map((b) => `\`${b}\``).join(', ')} blueprint${blueprints.length > 1 ? 's' : ''}` : ''}.
${web ? `\n${web}\n` : ''}
## Run the tests

\`\`\`bash
bash script/setup-deps.sh   # forge-std, OpenZeppelin and CCIP at the versions Studio compiles with, checksum-verified
forge test
\`\`\`

Needs Foundry (https://getfoundry.sh), curl and git. \`artifacts/icm\` holds the real Teleporter and ICTT bytecode the cross-chain tests deploy.

## Layout

- \`contracts/\`: the contracts Studio compiles and deploys.
- \`test/\`: Foundry tests, plus shared helpers in \`test/helpers\` (mocks, a CCIP router mock, the Teleporter harness).
- \`shared/teleporter/\`: ICM interfaces, imported as \`@teleporter/...\`.${web ? '\n- `web/`: the Next.js app for the frontend, see above.' : ''}
`;
}

function setupScript(): string {
  return readRepo('scripts/blueprints/setup-test-deps.sh')
    .replace('ROOT="$(cd "$(dirname "$0")/../.." && pwd)"', 'ROOT="$(cd "$(dirname "$0")/.." && pwd)"')
    .replace('DEPS="$ROOT/.blueprint-deps"', 'DEPS="$ROOT/.deps"')
    .replace('Blueprint test dependencies are ready', 'Dependencies are ready');
}

/** The Next.js app for the project's frontend, with the contracts and chains it was built against. */
async function webApp(
  userId: string,
  projectId: string,
  slug: string,
  title: string,
  frontendFiles: { path: string; content: string }[],
) {
  if (!frontendFiles.some((f) => f.path === PREVIEW_ENTRY || f.path === REACT_ENTRY)) return { files: [], readme: '' };
  const context = await frontendContext(userId, projectId, { withFiles: false });
  const scope = { contracts: context.contracts, chains: context.chains };
  const tokens: StudioConfig['tokens'] = {};
  for (const chainId of Object.keys(context.chains).map(Number)) {
    tokens[chainId] = (await tokenListIn(scope, chainId).catch(() => [])) as StudioConfig['tokens'][number];
  }
  const files = webAppFiles({
    name: `${slug}-web`,
    title,
    files: frontendFiles,
    designCss: designSystemCss(),
    withFooter: withBuiltFooter,
    config: {
      contracts: Object.fromEntries(
        context.contracts.map((c) => [
          c.name,
          { address: c.address, abi: c.abi, chainId: c.chainId, network: c.network, explorerUrl: c.explorerUrl },
        ]),
      ) as StudioConfig['contracts'],
      chains: context.chains as StudioConfig['chains'],
      tokens,
    },
  });
  return { files, readme: webReadme(`${slug}-web`, context.contracts.length > 0, hasReactApp(frontendFiles)) };
}

export async function exportProject(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  const files = await prisma.studioFile.findMany({ where: { project_id: project.id }, orderBy: { path: 'asc' } });
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'studio-project';
  const at = (rel: string) => `${slug}/${rel}`;
  const build = await latestBuild(project.id);
  const viaIR = loadCompilerDefaults().viaIR || builtViaIR((build?.diagnostics ?? []) as { message?: string }[]);

  // The frontend leaves as a Next.js app under web/, so the loose frontend/ folder is not exported.
  const frontendFiles = files.filter((f) => f.path.startsWith('frontend/'));
  const web = await webApp(userId, project.id, slug, project.name, frontendFiles);

  const entries: { path: string; data: string; mode?: number }[] = [
    { path: at('foundry.toml'), data: foundryToml(viaIR) },
    { path: at('README.md'), data: readme(project.name, project.blueprint_ids, web.readme) },
    { path: at('script/setup-deps.sh'), data: setupScript(), mode: 0o755 },
    { path: at('.gitignore'), data: 'out/\ncache/\n.deps/\n' },
    ...files.filter((f) => !f.path.startsWith('frontend/')).map((f) => ({ path: at(f.path), data: f.content })),
    ...web.files.map((f) => ({ path: at(`web/${f.path}`), data: f.data })),
    ...listSol('blueprints/_shared/contracts/teleporter').map((f) => ({
      path: at(`shared/teleporter/${f}`),
      data: readRepo(`blueprints/_shared/contracts/teleporter/${f}`),
    })),
    ...listSol('blueprints/_shared/test').map((f) => ({
      path: at(`test/helpers/${f}`),
      // The harness reads bytecode relative to the Foundry root, which is the project root here.
      data: readRepo(`blueprints/_shared/test/${f}`).replace(
        '"../contracts/icm-contracts/compiled/"',
        '"artifacts/icm/"',
      ),
    })),
  ];
  if (files.some((f) => f.content.includes('TeleporterHarness'))) {
    for (const name of ICM_ARTIFACTS) {
      entries.push({
        path: at(`artifacts/icm/${name}.json`),
        data: readRepo(`contracts/icm-contracts/compiled/${name}.json`),
      });
    }
  }
  return { filename: `${slug}.tar.gz`, body: gzipSync(tar(entries)) };
}
