import { NextRequest, NextResponse } from "next/server";
import l1ChainsData from '@/constants/l1-chains.json';
import { 
  getCachedLabels, 
  setCachedLabels, 
  getPendingExecution,
  setPendingExecution,
  clearPendingExecution,
  DuneLabel 
} from '@/app/api/dune/cache';

const DUNE_QUERY_ID = '6275927';

interface DuneResponse {
  status: 'cached' | 'completed' | 'waiting' | 'failed';
  labels?: DuneLabel[];
  totalRows?: number;
  matchedLabels?: number;
}

// Start Dune query execution
async function startExecution(address: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.dune.com/api/v1/query/${DUNE_QUERY_ID}/execute`,
      {
        method: 'POST',
        headers: {
          'X-Dune-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_parameters: { address: address },
          performance: 'medium',
        }),
      }
    );

    if (!response.ok) {
      console.warn('[Dune] Execute failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.execution_id || null;
  } catch (error) {
    console.warn('[Dune] Failed to start execution:', error);
    return null;
  }
}

// Check execution status
async function checkStatus(executionId: string, apiKey: string): Promise<{ isFinished: boolean; state: string } | null> {
  try {
    const response = await fetch(
      `https://api.dune.com/api/v1/execution/${executionId}/status`,
      {
        headers: { 'X-Dune-API-Key': apiKey },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      isFinished: data.is_execution_finished,
      state: data.state,
    };
  } catch (error) {
    return null;
  }
}

// Fetch execution results
async function fetchResults(executionId: string, apiKey: string): Promise<any[] | null> {
  try {
    const response = await fetch(
      `https://api.dune.com/api/v1/execution/${executionId}/results`,
      {
        headers: { 'X-Dune-API-Key': apiKey },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.result?.rows || [];
  } catch (error) {
    return null;
  }
}

// Map Dune rows to DuneLabel format
function mapRowsToLabels(rows: any[]): DuneLabel[] {
  const labels: DuneLabel[] = [];
  for (const row of rows) {
    const matchedChain = (l1ChainsData as any[]).find(c => c.duneId === row.blockchain);
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const duneApiKey = process.env.DUNE_API_KEY;
  if (!duneApiKey) {
    return NextResponse.json({ error: 'Dune API key not configured' }, { status: 500 });
  }

  try {
    const { address } = await params;

    // Validate address format
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // Step 1: Check cache
    const cachedLabels = getCachedLabels(normalizedAddress);
    if (cachedLabels) {
      return NextResponse.json({
        status: 'cached',
        labels: cachedLabels,
        totalRows: cachedLabels.length,
        matchedLabels: cachedLabels.length,
      } as DuneResponse);
    }

    // Step 2: Check if there's already a pending execution
    const pendingExecutionId = getPendingExecution(normalizedAddress);
    
    if (pendingExecutionId) {
      // Check status of pending execution
      const status = await checkStatus(pendingExecutionId, duneApiKey);
      
      if (!status) {
        // Status check failed, clear pending and start fresh
        clearPendingExecution(normalizedAddress);
      } else if (status.isFinished) {
        if (status.state === 'QUERY_STATE_COMPLETED') {
          // Execution complete, fetch results
          const rows = await fetchResults(pendingExecutionId, duneApiKey);
          if (rows) {
            const labels = mapRowsToLabels(rows);
            setCachedLabels(normalizedAddress, labels);
            
            console.log(`[Dune] Completed for ${normalizedAddress}: ${labels.length} labels (${rows.length} total rows)`);
            
            return NextResponse.json({
              status: 'completed',
              labels,
              totalRows: rows.length,
              matchedLabels: labels.length,
            } as DuneResponse);
          }
        }
        // Execution failed or results fetch failed
        clearPendingExecution(normalizedAddress);
      } else {
        // Still executing, return waiting status
        return NextResponse.json({
          status: 'waiting',
          labels: [],
        } as DuneResponse);
      }
    }

    // Step 3: Start new execution
    console.log(`[Dune] Starting execution for ${normalizedAddress}`);
    const executionId = await startExecution(normalizedAddress, duneApiKey);
    
    if (!executionId) {
      return NextResponse.json({
        status: 'failed',
        labels: [],
      } as DuneResponse);
    }

    // Store pending execution
    setPendingExecution(normalizedAddress, executionId);

    // Return waiting status - UI will poll again
    return NextResponse.json({
      status: 'waiting',
      labels: [],
    } as DuneResponse);

  } catch (error) {
    console.error('[Dune] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
