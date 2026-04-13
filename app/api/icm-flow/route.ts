import { withApi, successResponse } from '@/lib/api';
import { getICMFlowData } from '@/lib/icm-clickhouse';

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

export const GET = withApi(async (req) => {
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);
  const clearCache = req.nextUrl.searchParams.get('clearCache') === 'true';

  // Check cache for this specific days value
  const cached = cachedFlowData.get(days);
  if (!clearCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return successResponse(cached.data);
  }

  // Fetch flow data from ClickHouse shared cache
  const flows = await getICMFlowData(days);

  // Build source and target node lists
  const sourceNodesMap = new Map<string, ChainNode>();
  const targetNodesMap = new Map<string, ChainNode>();

  flows.forEach((flow) => {
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

  const sourceNodes = Array.from(sourceNodesMap.values()).sort((a, b) => b.totalMessages - a.totalMessages);
  const targetNodes = Array.from(targetNodesMap.values()).sort((a, b) => b.totalMessages - a.totalMessages);

  const totalMessages = flows.reduce((sum, f) => sum + f.messageCount, 0);

  const response: ICMFlowResponse = {
    flows,
    sourceNodes,
    targetNodes,
    totalMessages,
    last_updated: Date.now(),
    failedChainIds: [],
  };

  cachedFlowData.set(days, { data: response, timestamp: Date.now() });

  return successResponse(response);
});
