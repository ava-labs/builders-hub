import { NextRequest, NextResponse } from "next/server";
import l1ChainsData from '@/constants/l1-chains.json';
import { getAddressForExecution, setCachedLabels, cleanupExecution } from '@/app/api/dune/cache';

interface DuneLabel {
  blockchain: string;
  name: string;
  category: string;
  source: string;
  chainId?: string;
  chainName?: string;
  chainLogoURI?: string;
  chainSlug?: string;
  chainColor?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const duneApiKey = process.env.DUNE_API_KEY;
  if (!duneApiKey) {
    return NextResponse.json({ error: 'Dune API key not configured' }, { status: 500 });
  }

  try {
    const { executionId } = await params;

    if (!executionId) {
      return NextResponse.json({ error: 'Missing execution ID' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.dune.com/api/v1/execution/${executionId}/results`,
      {
        headers: { 'X-Dune-API-Key': duneApiKey },
      }
    );

    if (!response.ok) {
      console.warn('[Dune] Results fetch failed:', response.status);
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: response.status });
    }

    const data = await response.json();
    const rows = data.result?.rows || [];

    // Map Dune results to our format and match with l1-chains
    // Only include labels that have a matching chain
    const labels: DuneLabel[] = [];
    for (const row of rows) {
      const matchedChain = (l1ChainsData as any[]).find(c => c.duneId === row.blockchain);
      if (!matchedChain) continue; // Skip if no matching chain
      
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

    // Cache the results for future requests
    const address = getAddressForExecution(executionId);
    if (address) {
      setCachedLabels(address, labels);
      cleanupExecution(executionId);
    }

    console.log(`[Dune] Results for ${executionId}: ${labels.length} labels (${rows.length} total rows)`);

    return NextResponse.json({
      labels,
      totalRows: rows.length,
      matchedLabels: labels.length,
    });
  } catch (error) {
    console.error('[Dune] Results error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

