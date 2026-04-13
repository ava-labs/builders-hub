import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { InternalError, ValidationError } from '@/lib/api/errors';
import { EVM_ADDRESS_REGEX } from '@/lib/api/constants';
import l1ChainsData from '@/constants/l1-chains.json';
import {
  getCachedLabels,
  setCachedLabels,
  getPendingExecution,
  setPendingExecution,
  clearPendingExecution,
  type DuneLabel,
} from '@/app/api/dune/cache';

const DUNE_QUERY_ID = '6275927';

interface DuneResponse {
  status: 'cached' | 'completed' | 'waiting' | 'failed';
  labels?: DuneLabel[];
  totalRows?: number;
  matchedLabels?: number;
}

async function startExecution(address: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`https://api.dune.com/api/v1/query/${DUNE_QUERY_ID}/execute`, {
      method: 'POST',
      headers: {
        'X-Dune-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_parameters: { address },
        performance: 'medium',
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.execution_id || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkStatus(
  executionId: string,
  apiKey: string,
): Promise<{ isFinished: boolean; state: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/status`, {
      headers: { 'X-Dune-API-Key': apiKey },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return { isFinished: data.is_execution_finished, state: data.state };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchResults(executionId: string, apiKey: string): Promise<any[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/results`, {
      headers: { 'X-Dune-API-Key': apiKey },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.result?.rows || [];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapRowsToLabels(rows: any[]): DuneLabel[] {
  const labels: DuneLabel[] = [];
  for (const row of rows) {
    const matchedChain = (l1ChainsData as any[]).find((c) => c.duneId === row.blockchain);
    if (!matchedChain) continue;

    labels.push({
      blockchain: row.blockchain,
      name: row.name,
      category: row.category,
      source: row.source,
      chainId: matchedChain.chainId,
      chainName: matchedChain.chainName,
      chainLogoURI: matchedChain.chainLogoURI,
      chainSlug: matchedChain.slug,
      chainColor: matchedChain.color,
    });
  }
  return labels;
}

export const GET = withApi(async (_req: NextRequest, { params }) => {
  const duneApiKey = process.env.DUNE_API_KEY;
  if (!duneApiKey) {
    throw new InternalError('Dune API key not configured');
  }

  const { address } = params;

  if (!address || !EVM_ADDRESS_REGEX.test(address)) {
    throw new ValidationError('Invalid address format');
  }

  const normalizedAddress = address.toLowerCase();

  // Step 1: Check cache
  const cachedLabels = getCachedLabels(normalizedAddress);
  if (cachedLabels) {
    return successResponse({
      status: 'cached',
      labels: cachedLabels,
      totalRows: cachedLabels.length,
      matchedLabels: cachedLabels.length,
    } as DuneResponse);
  }

  // Step 2: Check if there's already a pending execution
  const pendingExecutionId = getPendingExecution(normalizedAddress);

  if (pendingExecutionId) {
    const status = await checkStatus(pendingExecutionId, duneApiKey);

    if (!status) {
      clearPendingExecution(normalizedAddress);
    } else if (status.isFinished) {
      if (status.state === 'QUERY_STATE_COMPLETED') {
        const rows = await fetchResults(pendingExecutionId, duneApiKey);
        if (rows) {
          const labels = mapRowsToLabels(rows);
          setCachedLabels(normalizedAddress, labels);

          return successResponse({
            status: 'completed',
            labels,
            totalRows: rows.length,
            matchedLabels: labels.length,
          } as DuneResponse);
        }
      }
      clearPendingExecution(normalizedAddress);
    } else {
      return successResponse({
        status: 'waiting',
        labels: [],
      } as DuneResponse);
    }
  }

  // Step 3: Start new execution
  const executionId = await startExecution(normalizedAddress, duneApiKey);

  if (!executionId) {
    return successResponse({
      status: 'failed',
      labels: [],
    } as DuneResponse);
  }

  setPendingExecution(normalizedAddress, executionId);

  return successResponse({
    status: 'waiting',
    labels: [],
  } as DuneResponse);
});
