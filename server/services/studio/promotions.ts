import 'server-only';
import { Prisma } from '@prisma/client';
import { loadRegistry } from '@/lib/blueprints';
import type { Finding } from '@/lib/studio/audit/types';
import type { StepStates } from '@/lib/studio/executor';
import { allPassed, productionNetworks, promotionGates } from '@/lib/studio/promotion';
import { prisma } from '@/prisma/prisma';
import type { RuntimeBindings } from './chain';
import { planOf, proposeDeployment, type CheckResult } from './deployments';
import { StudioError } from './errors';
import { getOwnedProject } from './projects';

async function evaluate(userId: string, projectId: string, deploymentId: string, testsConfirmed: boolean) {
  const project = await getOwnedProject(userId, projectId);
  const source = await prisma.studioDeployment.findFirst({ where: { id: deploymentId, project_id: project.id } });
  if (!source) throw new StudioError(404, 'Deployment not found');
  if (!source.blueprint_id) {
    throw new StudioError(
      400,
      'Plans written for your own contracts deploy to testnet only for now; production migration covers blueprint deployments.',
    );
  }

  const { manifest } = planOf(source);
  const networks = source.networks as Record<string, string>;
  const mapping = productionNetworks(manifest, networks, loadRegistry());
  const audit = await prisma.studioAuditReport.findFirst({
    where: { build_id: source.build_id },
    orderBy: { created_at: 'desc' },
  });
  const productionRuntime = ((project.runtime ?? {}) as RuntimeBindings).production ?? {};
  const usesL1 = Object.values(networks).includes('l1');

  const gates = promotionGates({
    deployment: {
      stage: source.stage,
      status: source.status,
      steps: source.steps as unknown as StepStates,
      checks: source.checks as unknown as CheckResult[],
    },
    manifest,
    audit: audit
      ? {
          findings: audit.findings as unknown as Finding[],
          acknowledged: audit.acknowledged as unknown as { fingerprint: string }[],
        }
      : null,
    testsConfirmed,
    mapping,
    productionL1Bound: usesL1 ? !!productionRuntime.l1?.rpcUrl && productionRuntime.l1?.testnet === false : undefined,
  });
  return { project, source, mapping, gates, productionRuntime };
}

/** Gates as they stand, with the tests gate shown as unconfirmed until the builder confirms it. */
export async function promotionPreview(userId: string, projectId: string, deploymentId: string) {
  const { gates, mapping } = await evaluate(userId, projectId, deploymentId, false);
  return { gates, networks: mapping.networks, unsupported: mapping.unsupported };
}

export async function createPromotion(userId: string, projectId: string, deploymentId: string) {
  const { source, mapping, gates, productionRuntime } = await evaluate(userId, projectId, deploymentId, true);
  if (!allPassed(gates)) return { ok: false as const, gates };

  const networks = source.networks as Record<string, string>;
  const promotion = await prisma.studioPromotion.create({
    data: {
      project_id: source.project_id,
      source_deployment_id: source.id,
      build_id: source.build_id,
      network_map: Object.fromEntries(Object.entries(networks).map(([role, key]) => [key, mapping.networks[role]])),
      gates: gates as unknown as Prisma.InputJsonValue,
      tests_confirmed_at: new Date(),
      status: 'deploying',
    },
  });
  const deployment = await proposeDeployment(
    userId,
    projectId,
    { blueprintId: source.blueprint_id!, networks: mapping.networks, params: source.params as Record<string, unknown> },
    { stage: 'production', buildId: source.build_id, promotionId: promotion.id, runtime: productionRuntime },
  );
  return { ok: true as const, promotion, deployment, gates };
}
