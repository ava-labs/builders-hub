import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { BLUEPRINTS_DIR, formatCatalogForModel, loadSharedGuide } from '@/lib/blueprints';
import { detectorCatalog } from '@/lib/studio/audit';
import type { Finding } from '@/lib/studio/audit/types';
import { prisma } from '@/prisma/prisma';
import type { StoredContract } from '../builds';
import { BRIEF_PATH } from '../imports';
import { projectOverview } from '../projects';

export const SKILLS = ['testing', 'auditing', 'frontend', 'design-system', 'eerc'] as const;
export type SkillName = (typeof SKILLS)[number];

export function loadSkill(name: SkillName): string {
  const raw = fs.readFileSync(path.join(BLUEPRINTS_DIR, '_shared', 'skills', name, 'SKILL.md'), 'utf8');
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

const TOOLS_GUIDE = `## Studio tools

- \`list_blueprints\`, \`read_blueprint\`: the catalog, and one blueprint with its guide, manifest, contracts and resolved registry values.
- \`use_blueprint\`: add a blueprint to the project. Copies its contracts and tests into the project files and sets default networks.
- \`list_files\`, \`read_file\`, \`write_file\`, \`delete_file\`: project files under contracts/, test/, script/ and docs/ (.sol, .md), and the React app under frontend/ (App.jsx, components/*.jsx, styles.css).
- \`frontend_context\`: every deployed testnet contract with its address, chain and function signatures, plus the frontend/ files. Call it before building or changing the frontend. A frontend is for the project's end users (fans, buyers, depositors), designed around what they come to do; the contracts bound what's possible, they are not the screens. Ask the builder who the users are when the brief doesn't say.
- \`compile_and_audit\`: compile contracts/ with the shared settings and run the static audit. Call it after every change to contracts.
- \`record_review\`: store your review.md results (pass, fail or na, with evidence) on the latest audit.
- \`set_config\`: the project's network roles and blueprint parameters.
- \`propose_deployment\`: create a testnet deployment plan from a blueprint. The builder runs it from the deploy runner; their wallet signs.
- \`propose_custom_deployment\`: create a testnet plan for the project's own contracts when no blueprint fits, such as an imported project. The server checks every step against the latest build.
- \`deployment_status\`: steps, addresses, explorer links and checks of a deployment.
- \`promotion_status\`: the gates between a testnet deployment and production.
- \`load_skill\`: the testing, auditing, frontend, design-system or eerc skill. Load it before writing tests, reviewing security or building a frontend; for a frontend, load both frontend and design-system, and eerc too when the project has an Encrypted ERC token. The builder runs the frontend in the Preview tab and verifies deployed contracts from the Contracts tab.
- \`registry_lookup\`: one value from networks.json, for anything the blueprint context did not already resolve.

You cannot acknowledge audit findings or start a promotion. Those are the builder's decisions, made in the Studio UI. When a finding is safe to accept, explain why in chat so they can acknowledge it with that reason.`;

/** Cached across turns: the parts of the system prompt that do not depend on the project. */
export function staticPrompt(): string {
  const detectors = detectorCatalog()
    .map((d) => `- \`${d.id}\` (${d.severity}, OWASP ${d.category}): ${d.title}`)
    .join('\n');
  return [
    loadSharedGuide('agent'),
    TOOLS_GUIDE,
    '## Pre-deploy review (review.md)',
    loadSharedGuide('review'),
    '## Blueprint catalog',
    formatCatalogForModel(),
    '## Audit detectors',
    detectors,
  ].join('\n\n');
}

export async function projectPrompt(userId: string, projectId: string): Promise<string> {
  const o = await projectOverview(userId, projectId);
  const findings = (o.audit?.findings ?? []) as unknown as Finding[];
  const acked = new Set(
    ((o.audit?.acknowledged ?? []) as unknown as { fingerprint: string }[]).map((a) => a.fingerprint),
  );
  const openFindings = findings.filter((f) => !acked.has(f.fingerprint));
  const deployments = o.deployments
    .slice(0, 5)
    .map((d) => `- ${d.id}: ${d.blueprint_id ?? 'custom'} on ${JSON.stringify(d.networks)}, ${d.stage}, ${d.status}`);
  const brief = await prisma.studioFile.findUnique({
    where: { project_id_path: { project_id: o.project.id, path: BRIEF_PATH } },
    select: { content: true },
  });
  const built = o.build?.ok ? ((o.build.contracts ?? []) as unknown as StoredContract[]) : [];
  const constructors = built
    .filter((c) => c.deployable && c.file.startsWith('contracts/'))
    .map((c) => {
      const ctor = (c.abi as { type?: string; inputs?: { name?: string; type: string }[] }[]).find(
        (item) => item.type === 'constructor',
      );
      const args = (ctor?.inputs ?? []).map((i) => `${i.type}${i.name ? ` ${i.name}` : ''}`).join(', ');
      return `- ${c.name} (${c.file}): constructor(${args})`;
    });

  return [
    ...(brief ? ['## What the builder is working on (docs/BRIEF.md)', brief.content.slice(0, 4000)] : []),
    `## This project`,
    `Name: ${o.project.name}${o.project.description ? ` — ${o.project.description}` : ''}`,
    `Stage: ${o.project.stage}`,
    `Blueprints: ${o.project.blueprint_ids.join(', ') || 'none yet'}`,
    `Network roles: ${JSON.stringify(o.project.networks)}`,
    `Parameters: ${JSON.stringify(o.project.params)}`,
    `L1 bindings: ${JSON.stringify(Object.fromEntries(Object.entries((o.project.runtime ?? {}) as Record<string, Record<string, { name?: string; evmChainId?: number }>>).map(([stage, nets]) => [stage, Object.fromEntries(Object.entries(nets).map(([k, v]) => [k, `${v.name ?? k} (${v.evmChainId ?? '?'})`]))]))) || '{}'}`,
    `Files (${o.files.length}):`,
    ...o.files.map((f) => `- ${f.path} (${f.size} bytes)`),
    o.build
      ? `Latest build: ${o.build.ok ? 'compiled' : 'failed'} at ${o.build.created_at.toISOString()}`
      : 'Latest build: none',
    ...(constructors.length ? ['Deployable contracts in the latest build:', ...constructors] : []),
    o.audit
      ? `Latest audit: ${o.audit.passed ? 'passing' : 'blocked'}, ${openFindings.length} open finding(s)${
          openFindings.length
            ? `: ${openFindings
                .slice(0, 8)
                .map((f) => `${f.severity} ${f.detector} at ${f.file}:${f.line}`)
                .join('; ')}`
            : ''
        }`
      : 'Latest audit: none',
    `Deployments:`,
    ...(deployments.length ? deployments : ['- none']),
  ].join('\n');
}
