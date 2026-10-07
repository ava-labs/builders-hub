import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Abi, AbiFunction } from 'viem';
import { BLUEPRINTS_DIR } from '@/lib/blueprints';
import { prisma } from '@/prisma/prisma';
import { viewOf } from './deployments';
import { getOwnedProject } from './projects';

/*
 * What the project's dApp runs against: every contract its testnet
 * deployments created (latest one per contract name), the chains they live
 * on, and the files under frontend/. The Preview tab injects the contracts
 * and chains as `window.studio`; the agent reads the same list to build a UI
 * for exactly what the contracts expose.
 */

export interface FrontendContract {
  name: string;
  address: string;
  chainId: number | null;
  network: string;
  abi: Abi;
  deploymentId: string;
  explorerUrl: string | null;
}

export async function frontendContext(userId: string, projectId: string, { withFiles = true } = {}) {
  const project = await getOwnedProject(userId, projectId);
  const deployments = await prisma.studioDeployment.findMany({
    where: { project_id: project.id, stage: 'testnet', status: { in: ['succeeded', 'running'] } },
    orderBy: { created_at: 'desc' },
    include: { build: true },
    take: 20,
  });

  const contracts: FrontendContract[] = [];
  const chains: ReturnType<typeof viewOf>['chains'] = {};
  for (const deployment of deployments) {
    const view = viewOf(deployment);
    for (const d of view.deployed) {
      if (contracts.some((c) => c.name === d.contract)) continue;
      contracts.push({
        name: d.contract,
        address: d.address,
        chainId: d.chainId,
        network: d.network,
        abi: d.abi,
        deploymentId: deployment.id,
        explorerUrl: d.addressUrl,
      });
      if (d.chainId !== null && view.chains[d.chainId]) chains[d.chainId] = view.chains[d.chainId];
    }
  }

  const files = withFiles
    ? await prisma.studioFile.findMany({
        where: { project_id: project.id, path: { startsWith: 'frontend/' } },
        orderBy: { path: 'asc' },
        select: { path: true, content: true },
      })
    : [];
  return {
    contracts,
    chains,
    files,
    designCss: withFiles ? designSystemCss() : '',
    studioReact: withFiles ? studioReactSource() : '',
  };
}

/** The `@studio/react` hooks, from the same file the exported app ships, so preview and export can't drift apart. */
export function studioReactSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'templates', 'studio-web', 'lib', 'studio-react.ts'), 'utf8');
}

/** The shared stylesheet frontends link as builder-hub.css; served by the Preview and written on export. */
export function designSystemCss(): string {
  return fs.readFileSync(path.join(BLUEPRINTS_DIR, '_shared', 'design', 'builder-hub.css'), 'utf8');
}

/** The same context as text for the agent: names, addresses and function signatures, without whole ABIs. */
export function formatFrontendContextForModel(context: Awaited<ReturnType<typeof frontendContext>>): string {
  if (context.contracts.length === 0) {
    return "No contract is deployed on testnet yet. The app can still be written against the ABIs in the build; useContract('Name') returns null until a deployment runs, so show a not-deployed state. builder-hub.css is added by Studio; don't write it.";
  }
  const lines = context.contracts.map((c) => {
    const fns = c.abi
      .filter((i): i is AbiFunction => i.type === 'function')
      .map((f) => {
        const args = f.inputs.map((a) => `${a.type}${a.name ? ` ${a.name}` : ''}`).join(', ');
        const out = f.outputs?.length ? ` returns (${f.outputs.map((o) => o.type).join(', ')})` : '';
        return `  - ${f.name}(${args}) ${f.stateMutability}${out}`;
      });
    const events = c.abi.filter((i) => i.type === 'event').map((i) => (i as { name: string }).name);
    return [
      `### ${c.name} on ${c.network} (chain ${c.chainId ?? 'unknown'}) at ${c.address}`,
      ...fns,
      ...(events.length ? [`  events: ${events.join(', ')}`] : []),
    ].join('\n');
  });
  const chains = Object.entries(context.chains).map(
    ([id, ch]) => `- ${id}: ${ch.name}, native ${ch.nativeCurrency.symbol}${ch.rpcUrl ? `, rpc ${ch.rpcUrl}` : ''}`,
  );
  return [
    "Design for the project's end users and their jobs; the functions below are what those flows can call, not the screens. Owner-only functions stay out of the end-user app unless the builder asks.",
    '## Deployed contracts (use them by name: useContract, useRead, useWrite from @studio/react)',
    ...lines,
    '## Chains',
    ...chains,
    `## frontend/ files: ${context.files.map((f) => f.path).join(', ') || 'none yet'}`,
    'The app is React in frontend/App.jsx. Hooks: @studio/react (useWallet, useRead, useWrite, useTokens, useTokenBalances). Styles: the design-system classes; Studio adds builder-hub.css, so never write it.',
  ].join('\n');
}
