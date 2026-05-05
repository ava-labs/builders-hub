import { NextResponse } from 'next/server';
import type { DAppDetail, DAppCategory, SubProtocolTVL } from '@/types/dapps';
import { mapDefiLlamaCategory } from '@/types/dapps';
import { SLUG_ALIASES, PROTOCOL_SLUGS, getProtocolContracts } from '@/lib/contracts';

const DEFILLAMA_API = 'https://api.llama.fi';

export const revalidate = 300; // Cache for 5 minutes

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// Get all DefiLlama slugs that map to a canonical protocol
function getRelatedSlugs(canonicalSlug: string): string[] {
  const relatedSlugs: string[] = [];
  for (const [slug, protocolName] of Object.entries(SLUG_ALIASES)) {
    if (PROTOCOL_SLUGS[protocolName] === canonicalSlug) {
      relatedSlugs.push(slug);
    }
  }
  return relatedSlugs;
}

// Check if a slug is canonical (in our registry)
function isCanonicalSlug(slug: string): boolean {
  return Object.values(PROTOCOL_SLUGS).includes(slug);
}

async function fetchProtocolBySlug(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${DEFILLAMA_API}/protocol/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error fetching protocol:', error);
    return null;
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Check if this is a canonical slug with multiple sub-protocols
    let subProtocols: SubProtocolTVL[] = [];
    let mainProtocol: any = null;
    let combinedTvl = 0;
    let combinedTvlHistory: { timestamp: number; value: number }[] = [];

    if (isCanonicalSlug(slug)) {
      // Fetch all related sub-protocols in parallel
      const relatedSlugs = getRelatedSlugs(slug);
      const protocols = await Promise.all(
        relatedSlugs.map(s => fetchProtocolBySlug(s))
      );

      // Filter out null responses and collect sub-protocol data
      for (const protocol of protocols) {
        if (protocol) {
          const tvl = protocol.currentChainTvls?.Avalanche || 0;
          if (tvl > 0) {
            subProtocols.push({
              name: protocol.name,
              slug: protocol.slug,
              tvl,
              logo: protocol.logo,
            });
            combinedTvl += tvl;

            // Use the largest sub-protocol as the main one
            if (!mainProtocol || tvl > (mainProtocol.currentChainTvls?.Avalanche || 0)) {
              mainProtocol = protocol;
            }
          }
        }
      }

      // Sort sub-protocols by TVL
      subProtocols.sort((a, b) => b.tvl - a.tvl);
    }

    // If no main protocol found via consolidation, try fetching directly
    if (!mainProtocol) {
      mainProtocol = await fetchProtocolBySlug(slug);
    }

    // If not found in DefiLlama, check if it's a local-only protocol from our registry
    if (!mainProtocol) {
      // Check if this slug maps to a protocol in our registry
      const protocolName = SLUG_ALIASES[slug];
      if (protocolName) {
        const protocolData = getProtocolContracts(protocolName);
        if (protocolData && protocolData.contracts.length > 0) {
          // This is a local-only protocol (has on-chain data but no DefiLlama entry)
          const category = protocolData.contracts[0].category as DAppCategory;

          const localDapp: DAppDetail = {
            id: `local-${slug}`,
            name: protocolName,
            slug: slug,
            logo: `/logos/${slug}.png`,
            category,
            tvl: 0,
            change_1d: null,
            change_7d: null,
            description: `${protocolName} - ${protocolData.contracts.length} tracked contract${protocolData.contracts.length > 1 ? 's' : ''} on Avalanche C-Chain. This protocol has on-chain activity data but no TVL tracking on DefiLlama.`,
            chains: ['Avalanche'],
            tvlHistory: [],
            chainTvls: {},
            isLocalOnly: true,
          };

          return NextResponse.json(localDapp);
        }
      }

      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });
    }

    const avalancheTvl = combinedTvl > 0 ? combinedTvl : (mainProtocol.currentChainTvls?.Avalanche || 0);
    const category = mapDefiLlamaCategory(mainProtocol.category) as DAppCategory;

    // Get TVL history for Avalanche if available
    let tvlHistory: { timestamp: number; value: number }[] = [];
    if (mainProtocol.chainTvls?.Avalanche?.tvl) {
      tvlHistory = mainProtocol.chainTvls.Avalanche.tvl
        .slice(-90) // Last 90 days
        .map((item: { date: number; totalLiquidityUSD: number }) => ({
          timestamp: item.date * 1000,
          value: item.totalLiquidityUSD,
        }));
    } else if (mainProtocol.tvl) {
      tvlHistory = mainProtocol.tvl.slice(-90).map((item: { date: number; totalLiquidityUSD: number }) => ({
        timestamp: item.date * 1000,
        value: item.totalLiquidityUSD,
      }));
    }

    // Calculate change values from TVL history (DefiLlama individual endpoint doesn't provide these)
    let change_1d: number | null = null;
    let change_7d: number | null = null;

    if (tvlHistory.length > 0) {
      const currentTvl = tvlHistory[tvlHistory.length - 1]?.value;

      // Find TVL from ~1 day ago (looking for entry closest to 24h ago)
      if (tvlHistory.length >= 2 && currentTvl > 0) {
        const oneDayAgoTvl = tvlHistory[tvlHistory.length - 2]?.value;
        if (oneDayAgoTvl > 0) {
          change_1d = ((currentTvl - oneDayAgoTvl) / oneDayAgoTvl) * 100;
        }
      }

      // Find TVL from ~7 days ago
      if (tvlHistory.length >= 8 && currentTvl > 0) {
        const sevenDaysAgoTvl = tvlHistory[tvlHistory.length - 8]?.value;
        if (sevenDaysAgoTvl > 0) {
          change_7d = ((currentTvl - sevenDaysAgoTvl) / sevenDaysAgoTvl) * 100;
        }
      }
    }

    // Clean up protocol name (remove version/variant suffixes)
    let cleanName = mainProtocol.name;
    if (subProtocols.length > 1) {
      cleanName = cleanName.replace(' Staked Avax', '').replace(' Lending', '').replace(' V2', '').replace(' V3', '');
    }

    const dapp: DAppDetail = {
      id: mainProtocol.id,
      name: cleanName,
      slug: slug, // Use the requested canonical slug
      logo: mainProtocol.logo,
      category,
      tvl: avalancheTvl,
      change_1d,
      change_7d,
      mcap: mainProtocol.mcap,
      url: mainProtocol.url,
      twitter: mainProtocol.twitter,
      description: mainProtocol.description || '',
      chains: mainProtocol.chains || [],
      tvlHistory,
      chainTvls: mainProtocol.currentChainTvls || {},
      token: mainProtocol.symbol,
      audit_links: mainProtocol.audit_links,
      isLocalOnly: false,
      subProtocols: subProtocols.length > 1 ? subProtocols : undefined,
    };

    return NextResponse.json(dapp);
  } catch (error) {
    console.error('Error fetching dApp details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dApp data' },
      { status: 500 }
    );
  }
}
