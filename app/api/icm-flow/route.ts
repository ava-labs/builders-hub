import { NextResponse } from 'next/server';
import { getICMFlowData } from "@/lib/icm-clickhouse";

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

const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

// Cache for flow data - keyed by days parameter
const cachedFlowData: Map<number, { data: ICMFlowResponse; timestamp: number }> = new Map();
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

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
          'Cache-Control': CACHE_CONTROL_HEADER,
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cached.timestamp).toISOString(),
          'X-Days': days.toString(),
        }
      });
    }

    // Fetch flow data from ClickHouse shared cache
    const flows = await getICMFlowData(days);

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
      failedChainIds: [],
    };

    // Update cache for this days value
    cachedFlowData.set(days, { data: response, timestamp: Date.now() });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Data-Source': 'fresh',
        'X-Total-Flows': flows.length.toString(),
        'X-Days': days.toString(),
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
