/**
 * One-shot migration: seed `aliasVerified` across constants/l1-chains.json.
 *
 * Usage:
 *   tsx ./scripts/seed-alias-verified.ts [--dry-run]
 *
 * Refuses to run once any entry carries `aliasVerified`, so a later run can't
 * quietly overwrite a human decision.
 */

import fs from 'fs';
import path from 'path';
import { canonicalChainSlug } from '../lib/chain-alias';
import { DEDICATED_METRICS_CHAINS } from '../lib/dedicated-stats';
import { deriveIsIndexed, fetchIndexedChainIds } from '../lib/chain-indexing';

interface CatalogChain {
  chainId: string;
  chainName: string;
  chainLogoURI?: string;
  blockchainId?: string;
  subnetId?: string;
  slug: string;
  description?: string;
  category?: string;
  website?: string;
  socials?: Record<string, string>;
  coingeckoId?: string;
  rpcUrl?: string;
  isTestnet?: boolean;
  preserveOnPrune?: boolean;
  aliasVerified?: boolean;
  isIndexed?: boolean;
  isIndexedOverride?: boolean;
  [key: string]: unknown;
}

const GLACIER_API_ENDPOINT = 'https://glacier-api.avax.network';

// The Primary Network's chains are ours by definition.
const PROTECTED_CHAIN_IDS = new Set(['43114', '43113']);

/** AvaCloud's default artwork is what a chain gets for uploading nothing. */
function hasRealLogo(chain: CatalogChain): boolean {
  const uri = chain.chainLogoURI || '';
  return uri.length > 0 && !uri.includes('AvaCloud');
}

function isAcknowledged(chain: CatalogChain, glacierChainIds: Set<string>): boolean {
  if (PROTECTED_CHAIN_IDS.has(chain.chainId)) return true;
  if (chain.preserveOnPrune) return true;
  if (glacierChainIds.has(chain.chainId)) return true;
  // We stood up a dedicated metrics pipeline for these
  if (DEDICATED_METRICS_CHAINS[chain.chainId] !== undefined) return true;
  return Boolean(
    hasRealLogo(chain) ||
      chain.website ||
      chain.socials ||
      chain.coingeckoId ||
      chain.description ||
      chain.category,
  );
}

async function fetchGlacierChainIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const network of ['mainnet', 'fuji'] as const) {
    const res = await fetch(`${GLACIER_API_ENDPOINT}/v1/chains?network=${network}`);
    if (!res.ok) throw new Error(`Glacier ${network}: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { chains?: Array<{ chainId?: string }> };
    for (const c of body.chains ?? []) if (c.chainId) ids.add(String(c.chainId));
  }
  return ids;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const filePath = path.join(process.cwd(), 'constants', 'l1-chains.json');
  const chains = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CatalogChain[];

  const alreadySeeded = chains.filter(c => c.aliasVerified !== undefined);
  if (alreadySeeded.length > 0) {
    console.error(
      `\n✗ ${alreadySeeded.length} entr${alreadySeeded.length === 1 ? 'y' : 'ies'} already carry aliasVerified.\n` +
        `  This migration has run. The field is hand-maintained now — edit constants/l1-chains.json\n` +
        `  directly and let \`yarn enrich:chains\` re-derive the slugs.\n`,
    );
    process.exit(1);
  }

  console.log('Fetching Glacier chain catalog...');
  const glacierChainIds = await fetchGlacierChainIds();
  console.log(`Glacier lists ${glacierChainIds.size} chains across mainnet + Fuji.`);

  const verified: CatalogChain[] = [];
  const demoted: Array<{ chain: CatalogChain; from: string; to: string }> = [];

  for (const chain of chains) {
    if (isAcknowledged(chain, glacierChainIds)) {
      chain.aliasVerified = true;
      verified.push(chain);
      continue;
    }
    const from = chain.slug;
    const to = canonicalChainSlug(chain);
    chain.slug = to;
    if (from !== to) demoted.push({ chain, from, to });
  }

  const pinned: string[] = [];

  // Pin the handful of hand-set isIndexed values that predate the derivation in enrich-chains.ts
  for (const chain of chains) {
    if (chain.isIndexed !== undefined && chain.isIndexedOverride === undefined) {
      chain.isIndexedOverride = chain.isIndexed;
      pinned.push(`${chain.chainName} (isIndexed=${chain.isIndexed})`);
    }
  }

  // Then populate isIndexed for everyone else
  const known = await fetchIndexedChainIds();
  if (!known) {
    console.error(
      `\n✗ Could not reach the metrics API, so isIndexed cannot be derived.\n` +
        `  Nothing written — rerun when it is back.\n`,
    );
    process.exit(1);
  }
  let unindexed = 0;
  for (const chain of chains) {
    chain.isIndexed = chain.isIndexedOverride ?? deriveIsIndexed(chain, known);
    if (!chain.isIndexed) unindexed++;
  }

  const mainnetDemoted = demoted.filter(d => !d.chain.isTestnet);

  if (mainnetDemoted.length > 0) {
    mainnetDemoted.forEach(d => console.log(`  ~ ${d.from} -> ${d.to}   (${d.chain.chainName})`));
  }

  if (pinned.length > 0) {
    pinned.forEach(p => console.log(`  · ${p}`));
  }

  if (dryRun) {
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify(chains, null, 2) + '\n', 'utf-8');
}

main().catch(error => {
  console.error('Error running seed-alias-verified script:', error);
  process.exit(1);
});
