import { NextResponse } from 'next/server';
import { getICMFlowData, getICMFlowDataBothSides } from "@/lib/icm-clickhouse";

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
  /** with sides=both: whether the direction was counted as its sender's sends or its receiver's deliveries */
  countedAs?: 'sent' | 'delivered';
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
  /** with sides=both: "both", or "delivered" when the sends could not be read and the deliveries came back alone */
  sides?: 'both' | 'delivered';
}

const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

// Cache for flow data - keyed by days parameter and sides
const cachedFlowData: Map<string, { data: ICMFlowResponse; timestamp: number }> = new Map();
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
// A both-sides answer that fell back to deliveries alone is kept only this long, so the next ask tries the sends again
const PARTIAL_DURATION = 5 * 60 * 1000;

/* Opt-in: sides=both counts each direction once, as the larger of its sender's sends and its receiver's deliveries
   (lib/icm-clickhouse.ts getICMFlowDataBothSides); the city draws it. Without it, the flows are the receivers'
   deliveries alone, as every other page has read them */
const sidesOf = (searchParams: URLSearchParams): 'both' | 'delivered' => (searchParams.get('sides') === 'both' ? 'both' : 'delivered');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const clearCache = searchParams.get('clearCache') === 'true';
    const sides = sidesOf(searchParams);
    const key = `${days}|${sides}`;

    // Check cache for this specific days value
    const cached = cachedFlowData.get(key);
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
    const both = sides === 'both' ? await getICMFlowDataBothSides(days) : null;
    const flows: ICMFlowData[] = both ? both.flows : await getICMFlowData(days);

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
      ...(both ? { sides: both.complete ? ('both' as const) : ('delivered' as const) } : {}),
    };

    // Update cache for this days value; a both-sides answer without its sends is kept only a few minutes
    const partial = both !== null && !both.complete;
    cachedFlowData.set(key, { data: response, timestamp: partial ? Date.now() - CACHE_DURATION + PARTIAL_DURATION : Date.now() });

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
    const sides = sidesOf(searchParams);

    // Return cached data if available for this days value or any cached data, counted the same way
    const same = Array.from(cachedFlowData.entries()).filter(([k]) => k.endsWith(`|${sides}`));
    const cached = cachedFlowData.get(`${days}|${sides}`) || cachedFlowData.get(`30|${sides}`) || same[0]?.[1];
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
