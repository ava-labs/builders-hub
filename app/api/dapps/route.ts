import { NextResponse } from 'next/server';
import type {
  DAppStats,
  DAppsMetrics,
  DAppCategory,
  DefiLlamaProtocol,
  DAppsApiResponse
} from '@/types/dapps';
import { mapDefiLlamaCategory } from '@/types/dapps';
import { SLUG_ALIASES, PROTOCOL_SLUGS, CONTRACT_REGISTRY, getProtocolContracts } from '@/lib/contracts';
import { getAllRWAProjects } from '@/lib/rwa/projects';

const DEFILLAMA_API = 'https://api.llama.fi';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Get canonical slug for a protocol (for protocols we track)
function getCanonicalSlug(slug: string): string | null {
  const protocolName = SLUG_ALIASES[slug];
  if (protocolName && PROTOCOL_SLUGS[protocolName]) {
    return PROTOCOL_SLUGS[protocolName];
  }
  return null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

async function fetchAllProtocols(): Promise<DefiLlamaProtocol[]> {
  try {
    const res = await fetch(`${DEFILLAMA_API}/protocols`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('Failed to fetch protocols');
    return await res.json();
  } catch (error) {
    console.error('Error fetching protocols:', error);
    return [];
  }
}

async function fetchAvalancheProtocols(): Promise<DefiLlamaProtocol[]> {
  const allProtocols = await fetchAllProtocols();
  return allProtocols.filter(
    (p) =>
      p.chains?.includes('Avalanche') &&
      p.chainTvls?.Avalanche &&
      p.chainTvls.Avalanche > 0
  );
}

async function fetchAvalancheTVL(): Promise<{ tvl: number; protocols: number } | null> {
  try {
    const res = await fetch(`${DEFILLAMA_API}/v2/chains`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('Failed to fetch chain TVL');
    const chains = await res.json();
    const avax = chains.find(
      (c: { name: string; gecko_id?: string }) =>
        c.name === 'Avalanche' || c.gecko_id === 'avalanche-2'
    );
    if (avax) {
      return {
        tvl: avax.tvl,
        protocols: avax.protocols || 0,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Avalanche TVL:', error);
    return null;
  }
}

async function fetchAVAXPrice(): Promise<{ usd: number; usd_24h_change: number } | null> {
  try {
    const res = await fetch(
      `${COINGECKO_API}/simple/price?ids=avalanche-2&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error('Failed to fetch AVAX price');
    const data = await res.json();
    return {
      usd: data['avalanche-2'].usd,
      usd_24h_change: data['avalanche-2'].usd_24h_change,
    };
  } catch (error) {
    console.error('Error fetching AVAX price:', error);
    return null;
  }
}

async function fetchDEXVolumes(): Promise<{ name: string; total24h: number }[]> {
  try {
    const res = await fetch(`${DEFILLAMA_API}/overview/dexs/Avalanche`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('Failed to fetch DEX volumes');
    const data = await res.json();
    return data.protocols || [];
  } catch (error) {
    console.error('Error fetching DEX volumes:', error);
    return [];
  }
}

export async function GET() {
  try {
    const [protocols, chainTVL, avaxPrice, dexVolumes] = await Promise.all([
      fetchAvalancheProtocols(),
      fetchAvalancheTVL(),
      fetchAVAXPrice(),
      fetchDEXVolumes(),
    ]);

    // Create a map of DEX volumes by protocol name (lowercase for matching)
    const volumeMap = new Map<string, number>();
    dexVolumes.forEach((dex) => {
      if (dex.name && dex.total24h) {
        volumeMap.set(dex.name.toLowerCase(), dex.total24h);
      }
    });

    // Transform protocols
    const rawDapps = protocols.map((p) => {
      const avalancheTvl = p.chainTvls?.Avalanche || 0;
      const category = mapDefiLlamaCategory(p.category);
      const volume24h = volumeMap.get(p.name.toLowerCase());

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        logo: p.logo,
        category,
        tvl: avalancheTvl,
        change_1d: p.change_1d,
        change_7d: p.change_7d,
        volume24h,
        mcap: p.mcap,
        url: p.url,
        twitter: p.twitter,
        description: p.description,
      };
    });

    // Consolidate protocols that belong to the same canonical protocol
    // e.g., benqi, benqi-staked-avax, benqi-lending -> single Benqi entry with breakdown
    const consolidatedMap = new Map<string, DAppStats>();
    const subProtocolsMap = new Map<string, { name: string; slug: string; tvl: number; logo?: string }[]>();
    const standaloneProtocols: DAppStats[] = [];

    for (const p of rawDapps) {
      const canonicalSlug = getCanonicalSlug(p.slug);

      if (canonicalSlug) {
        // Track this sub-protocol's TVL
        const subProtocols = subProtocolsMap.get(canonicalSlug) || [];
        subProtocols.push({
          name: p.name,
          slug: p.slug,
          tvl: p.tvl,
          logo: p.logo,
        });
        subProtocolsMap.set(canonicalSlug, subProtocols);

        // This protocol has a canonical version - consolidate
        const existing = consolidatedMap.get(canonicalSlug);
        if (existing) {
          // Add TVL to existing, keep the higher mcap, combine volumes
          existing.tvl += p.tvl;
          if (p.mcap && (!existing.mcap || p.mcap > existing.mcap)) {
            existing.mcap = p.mcap;
          }
          if (p.volume24h) {
            existing.volume24h = (existing.volume24h || 0) + p.volume24h;
          }
          // Keep better change values (prefer non-null)
          if (p.change_1d !== null && p.change_1d !== undefined && existing.change_1d === null) {
            existing.change_1d = p.change_1d;
          }
          if (p.change_7d !== null && p.change_7d !== undefined && existing.change_7d === null) {
            existing.change_7d = p.change_7d;
          }
          // Use the largest sub-protocol's logo (usually the main one)
          if (p.tvl > (existing.tvl - p.tvl)) {
            existing.logo = p.logo;
            existing.name = p.name.replace(' Staked Avax', '').replace(' Lending', '').replace(' V2', '').replace(' V3', '');
          }
        } else {
          // First entry for this canonical protocol
          consolidatedMap.set(canonicalSlug, {
            ...p,
            slug: canonicalSlug,
            name: p.name.replace(' Staked Avax', '').replace(' Lending', '').replace(' V2', '').replace(' V3', ''),
          });
        }
      } else {
        // Standalone protocol (not in our registry)
        standaloneProtocols.push(p);
      }
    }

    // Add sub-protocol breakdown to consolidated entries (sorted by TVL)
    for (const [slug, entry] of consolidatedMap.entries()) {
      const subProtocols = subProtocolsMap.get(slug) || [];
      if (subProtocols.length > 1) {
        entry.subProtocols = subProtocols.sort((a, b) => b.tvl - a.tvl);
      }
    }

    // Get all unique protocols from our local registry
    const localProtocols = new Set<string>();
    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      localProtocols.add(contract.protocol);
    }

    // Add local-only protocols (in our registry but not in DefiLlama/consolidated)
    const existingSlugs = new Set([
      ...Array.from(consolidatedMap.keys()),
      ...standaloneProtocols.map(p => p.slug),
    ]);

    const localOnlyProtocols: DAppStats[] = [];

    // Add RWA projects as separate leaderboard entries
    const rwaProjects = getAllRWAProjects();
    const rwaSlugs = new Set(rwaProjects.map(p => p.slug));
    for (const project of rwaProjects) {
      if (!existingSlugs.has(project.slug)) {
        localOnlyProtocols.push({
          id: `local-${project.slug}`,
          name: project.name,
          slug: project.slug,
          logo: project.icon,
          category: 'rwa' as DAppCategory,
          tvl: 0,
          change_1d: null,
          change_7d: null,
          description: project.description,
          darkInvert: project.darkInvert ?? true,
        });
        existingSlugs.add(project.slug);
      }
    }

    for (const protocolName of localProtocols) {
      const slug = PROTOCOL_SLUGS[protocolName];
      if (slug && !existingSlugs.has(slug)) {
        // Skip the combined Valinor OatFi entry since we added individual RWA projects above
        const contracts = getProtocolContracts(protocolName);
        if (contracts.length > 0 && contracts[0].category === 'rwa') {
          continue;
        }
        // This protocol is in our registry but not in DefiLlama
        if (contracts.length > 0) {
          const category = contracts[0].category as DAppCategory;
          localOnlyProtocols.push({
            id: `local-${slug}`,
            name: protocolName,
            slug: slug,
            logo: `/logos/${slug}.png`, // Local logo fallback
            category: category,
            tvl: 0, // No TVL data from DefiLlama
            change_1d: null,
            change_7d: null,
            description: `${protocolName} - ${contracts.length} tracked contracts on Avalanche C-Chain`,
          });
        }
      }
    }

    // Combine all protocols: consolidated (TVL > 0), standalone (TVL > 0), local-only (TVL = 0 but has on-chain data)
    const dapps: DAppStats[] = [
      ...consolidatedMap.values(),
      ...standaloneProtocols,
    ]
      .filter((p) => p.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .map((p, index) => ({ ...p, rank: index + 1 }));

    // Add local-only protocols at the end (they have on-chain data but no TVL)
    const localOnlyWithRank = localOnlyProtocols.map((p, index) => ({
      ...p,
      rank: dapps.length + index + 1,
    }));

    dapps.push(...localOnlyWithRank);

    // Calculate category breakdown
    const categoryBreakdown = dapps.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Partial<Record<DAppCategory, number>>);

    // Calculate total 24h DEX volume
    const total24hVolume = dexVolumes.reduce(
      (sum, dex) => sum + (dex.total24h || 0),
      0
    );

    const metrics: DAppsMetrics = {
      totalTVL: chainTVL?.tvl || 0,
      totalProtocols: dapps.length,
      total24hVolume,
      categoryBreakdown,
      avaxPrice: avaxPrice || undefined,
    };

    const response: DAppsApiResponse = {
      dapps,
      metrics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dApps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dApps data' },
      { status: 500 }
    );
  }
}
