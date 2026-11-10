import type { AuditReport, Finding, Severity } from '@/lib/studio/audit/types';
import type { Gate } from '@/lib/studio/promotion';
import type { DeploymentView, NextAction } from '@/server/services/studio/deployments';

export type { DeploymentView, Finding, Gate, NextAction, Severity };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: Omit<RequestInit, 'body'> & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* not JSON */
  }
  if (!res.ok)
    throw new ApiError(
      res.status,
      String(body.message ?? `Request failed (${res.status})`),
      body.error as string | undefined,
      body,
    );
  return body as T;
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const L1_BLUEPRINT = 'l1-quickstart';
export const ICM_SETUP_BLUEPRINT = 'l1-icm-setup';

/** Plans "Finish ICM on your L1", adding the blueprint to the project first if it isn't there yet. */
export async function planIcmSetup(project: { id: string; blueprint_ids: string[] }): Promise<string> {
  if (!project.blueprint_ids.includes(ICM_SETUP_BLUEPRINT)) {
    await api(`/api/studio/projects/${project.id}/blueprints`, {
      method: 'POST',
      json: { blueprintId: ICM_SETUP_BLUEPRINT },
    });
  }
  return planDeployment(project.id, ICM_SETUP_BLUEPRINT, {});
}

/** Saves the parameters on the project, where the chat and the form both read them, then proposes the deployment. */
export async function planDeployment(
  projectId: string,
  blueprintId: string,
  params: Record<string, unknown>,
): Promise<string> {
  if (Object.keys(params).length > 0) {
    await api(`/api/studio/projects/${projectId}`, { method: 'PATCH', json: { params } });
  }
  const { deploymentId } = await api<{ deploymentId: string }>(`/api/studio/projects/${projectId}/deployments`, {
    method: 'POST',
    json: { blueprintId, params },
  });
  return deploymentId;
}

export interface BlueprintCard {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: 'payments' | 'defi' | 'data' | 'interop' | 'privacy' | 'infra';
  level: 'starter' | 'intermediate' | 'advanced';
  tags: string[];
  prompts: string[];
  networks: Record<
    string,
    {
      description: string;
      default: string;
      defaultName: string;
      allowed: { key: string; name: string; testnet: boolean }[];
    }
  >;
  params: { name: string; type: string; description: string; default: unknown; example: unknown }[];
  contracts: { name: string; description: string; audited: boolean }[];
  prerequisites: string[];
  outline: { title: string; kind: string; role: string; optional: boolean }[];
  steps: number;
  files: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  blueprint_ids: string[];
  stage: 'testnet' | 'production';
  updated_at: string;
  _count: { files: number; deployments: number; chats: number };
  deployments: { status: string; stage: string; created_at: string }[];
}

export interface StoredBuild {
  id: string;
  ok: boolean;
  compiler: string;
  created_at: string;
  files_hash: string;
  diagnostics: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
    line?: number;
    column?: number;
  }[];
  contracts: { file: string; name: string; deployable: boolean }[];
}

export interface StoredAudit {
  id: string;
  build_id: string;
  passed: boolean;
  counts: AuditReport['counts'];
  findings: Finding[];
  acknowledged: { fingerprint: string; reason: string; at: string }[];
  tool_version: string;
  review: { id: string; status: 'pass' | 'fail' | 'na'; evidence: string }[];
  created_at: string;
}

export interface ProjectOverview {
  project: {
    id: string;
    name: string;
    description: string;
    blueprint_ids: string[];
    networks: Record<string, string>;
    params: Record<string, unknown>;
    runtime: Partial<
      Record<
        'testnet' | 'production',
        Record<
          string,
          {
            name?: string;
            evmChainId?: number;
            blockchainId?: string;
            testnet?: boolean;
            teleporter?: { messenger: string | null; registry: string | null };
            relayer?: 'not-running';
          }
        >
      >
    >;
    stage: 'testnet' | 'production';
  };
  files: { path: string; sha256: string; size: number; updatedAt: string }[];
  chats: { id: string; title: string; updated_at: string }[];
  build: StoredBuild | null;
  audit: StoredAudit | null;
  deployments: {
    id: string;
    blueprint_id: string | null;
    stage: string;
    status: string;
    created_at: string;
    promotion_id: string | null;
  }[];
  promotions: { id: string; status: string; source_deployment_id: string; created_at: string }[];
}
