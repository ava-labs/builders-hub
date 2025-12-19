import { NextResponse } from 'next/server';
import l1ChainsData from "@/constants/l1-chains.json";
const mainnetChains = l1ChainsData.filter(c => c.isTestnet !== true);

interface ICMFlowData {
  sourceChain: string;
  sourceChainId: string;
  sourceLogo: string;
  sourceColor: string;
  targetChain: string;
  targetChainId: string;
  targetLogo: string;
  targetColor: string;
  messageCount: number;
}

interface ChainNode {
  id: string;
  name: string;
  logo: string;
  color: string;
  totalMessages: number;
  isSource: boolean;
}

interface ICMFlowResponse {
  flows: ICMFlowData[];
  sourceNodes: ChainNode[];
  targetNodes: ChainNode[];
  totalMessages: number;
  last_updated: number;
  failedChainIds: string[];
}

// Cache for flow data - keyed by days parameter
const cachedFlowData: Map<number, { data: ICMFlowResponse; timestamp: number }> = new Map();
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

// Generate a consistent color from chain name
function generateColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

interface AggregateResult {
  flows: ICMFlowData[];
  failedChainIds: string[];
}

// Fetch ICM route data - aggregate from all chains in l1-chains.json
async function fetchICMRoutes(days: number = 30): Promise<AggregateResult> {
  console.log(`Fetching ICM data for ${mainnetChains.length} chains over ${days} days...`);
  
  try {
    // Aggregate from all chains in l1-chains.json
    const result = await aggregateChainICMData(days);
    console.log(`Found ${result.flows.length} ICM flow routes with data, ${result.failedChainIds.length} chains failed`);
    return result;
  } catch (error) {
    console.error('Failed to fetch ICM routes:', error);
    return { flows: [], failedChainIds: [] };
  }
}

// Aggregate ICM data from ALL chains in l1-chains.json
async function aggregateChainICMData(days: number): Promise<AggregateResult> {
  const flowsMap = new Map<string, ICMFlowData>();
  const failedChainIds: string[] = [];
  
  // Process chains in batches to avoid overwhelming the API
  const BATCH_SIZE = 20;
  const allChains = mainnetChains;
  
  for (let i = 0; i < allChains.length; i += BATCH_SIZE) {
    const batch = allChains.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (chain) => {
        try {
          // Fetch daily message volume which includes incoming/outgoing
          const response = await fetch(
            `https://idx6.solokhin.com/api/${chain.chainId}/metrics/dailyMessageVolume?days=${days}`,
            { 
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(5000) // 5 second timeout
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              // Sum up all messages for this chain
              const totalIncoming = data.reduce((sum: number, d: any) => sum + (d.incomingCount || 0), 0);
              const totalOutgoing = data.reduce((sum: number, d: any) => sum + (d.outgoingCount || 0), 0);
              
              // For chains with ICM activity, create flows to/from C-Chain as the hub
              const cChain = mainnetChains.find(c => c.chainId === '43114');
              
              if (totalOutgoing > 0 && chain.chainId !== '43114') {
                const key = `${chain.chainId}-43114`;
                if (!flowsMap.has(key)) {
                  flowsMap.set(key, {
                    sourceChain: chain.chainName,
                    sourceChainId: chain.chainId,
                    sourceLogo: chain.chainLogoURI || '',
                    sourceColor: chain.color || generateColor(chain.chainName),
                    targetChain: cChain?.chainName || 'Avalanche C-Chain',
                    targetChainId: '43114',
                    targetLogo: cChain?.chainLogoURI || '',
                    targetColor: cChain?.color || '#E57373',
                    messageCount: totalOutgoing,
                  });
                }
              }
              
              if (totalIncoming > 0 && chain.chainId !== '43114') {
                const key = `43114-${chain.chainId}`;
                if (!flowsMap.has(key)) {
                  flowsMap.set(key, {
                    sourceChain: cChain?.chainName || 'Avalanche C-Chain',
                    sourceChainId: '43114',
                    sourceLogo: cChain?.chainLogoURI || '',
                    sourceColor: cChain?.color || '#E57373',
                    targetChain: chain.chainName,
                    targetChainId: chain.chainId,
                    targetLogo: chain.chainLogoURI || '',
                    targetColor: chain.color || generateColor(chain.chainName),
                    messageCount: totalIncoming,
                  });
                }
              }
            }
          } else {
            // Non-OK response - track as failed
            failedChainIds.push(chain.chainId);
          }
        } catch (error) {
          // Silently skip chains that fail or timeout, but track them
          failedChainIds.push(chain.chainId);
        }
      })
    );
  }

  const flows = Array.from(flowsMap.values())
    .filter(f => f.messageCount > 0)
    .sort((a, b) => b.messageCount - a.messageCount);
    
  return { flows, failedChainIds };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const clearCache = searchParams.get('clearCache') === 'true';

    // Check cache for this specific days value
    const cached = cachedFlowData.get(days);
    if (!clearCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Days': days.toString(),
        }
      });
    }

    // Fetch flow data from all chains
    const { flows, failedChainIds } = await fetchICMRoutes(days);
    
    // Build source and target node lists
    const sourceNodesMap = new Map<string, ChainNode>();
    const targetNodesMap = new Map<string, ChainNode>();

    flows.forEach(flow => {
      // Source nodes
      const sourceKey = flow.sourceChainId || flow.sourceChain;
      if (!sourceNodesMap.has(sourceKey)) {
        sourceNodesMap.set(sourceKey, {
          id: sourceKey,
          name: flow.sourceChain,
          logo: flow.sourceLogo,
          color: flow.sourceColor,
          totalMessages: 0,
          isSource: true,
        });
      }
      sourceNodesMap.get(sourceKey)!.totalMessages += flow.messageCount;

      // Target nodes
      const targetKey = flow.targetChainId || flow.targetChain;
      if (!targetNodesMap.has(targetKey)) {
        targetNodesMap.set(targetKey, {
          id: targetKey,
          name: flow.targetChain,
          logo: flow.targetLogo,
          color: flow.targetColor,
          totalMessages: 0,
          isSource: false,
        });
      }
      targetNodesMap.get(targetKey)!.totalMessages += flow.messageCount;
    });

    const sourceNodes = Array.from(sourceNodesMap.values())
      .sort((a, b) => b.totalMessages - a.totalMessages);
    const targetNodes = Array.from(targetNodesMap.values())
      .sort((a, b) => b.totalMessages - a.totalMessages);

    const totalMessages = flows.reduce((sum, f) => sum + f.messageCount, 0);

    const response: ICMFlowResponse = {
      flows,
      sourceNodes,
      targetNodes,
      totalMessages,
      last_updated: Date.now(),
      failedChainIds,
    };

    // Update cache for this days value
    cachedFlowData.set(days, { data: response, timestamp: Date.now() });

    return NextResponse.json(response, {
      headers: {
        'X-Data-Source': 'fresh',
        'X-Total-Flows': flows.length.toString(),
        'X-Days': days.toString(),
        'X-Chains-Scanned': mainnetChains.length.toString(),
        'X-Failed-Chains': failedChainIds.length.toString(),
      }
    });
  } catch (error) {
    console.error('Error in ICM flow API:', error);
    
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    
    // Return cached data if available for this days value or any cached data
    const cached = cachedFlowData.get(days) || cachedFlowData.get(30) || Array.from(cachedFlowData.values())[0];
    if (cached) {
      return NextResponse.json(cached.data, {
        status: 206,
        headers: {
          'X-Data-Source': 'fallback-cache',
          'X-Error': 'true',
        }
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch ICM flow data' },
      { status: 500 }
    );
  }
}

