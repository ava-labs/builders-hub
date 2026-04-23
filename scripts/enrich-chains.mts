/**
 * Script to enrich l1-chains.json with data from Glacier API.
 *
 * Default behavior (non-destructive):
 * - Updates matching chains
 * - Adds new chains
 * - Does NOT remove stale local entries
 *
 * Optional prune mode (explicit):
 * - `--prune` removes stale local entries that are no longer in Glacier's
 *   public chain list (or are now private), unless protected.
 * - `--dry-run` previews changes without writing to disk.
 *
 * Usage:
 * - `yarn enrich:chains`
 * - `yarn enrich:chains --prune`
 * - `yarn enrich:chains --prune --dry-run`
 *
 * Runs automatically during: yarn build:remote
 */

import fs from 'fs';
import path from 'path';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { base58 } from '@scure/base';

// CB58 utilities (same as components/tools/common/utils/cb58.ts)
const CHECKSUM_LENGTH = 4;

function cb58ToBytes(cb58: string): Uint8Array {
  const decodedBytes = base58.decode(cb58);
  if (decodedBytes.length < CHECKSUM_LENGTH) {
    throw new Error('Input string is smaller than the checksum size');
  }
  return decodedBytes.slice(0, -CHECKSUM_LENGTH);
}

function cb58ToHex(cb58: string, include0x: boolean = true): string {
  const rawBytes = cb58ToBytes(cb58);
  return (include0x ? '0x' : '') + bytesToHex(rawBytes);
}

// Check if string is already hex format
function isHexString(str: string): boolean {
  return str.startsWith('0x') || /^[0-9a-fA-F]+$/.test(str);
}

// Convert blockchainId to hex if it's in cb58 format
function toHexBlockchainId(blockchainId: string): string {
  if (!blockchainId) return blockchainId;
  
  // Already hex format
  if (isHexString(blockchainId)) {
    return blockchainId.startsWith('0x') ? blockchainId : `0x${blockchainId}`;
  }
  
  // Convert from cb58 to hex
  try {
    return cb58ToHex(blockchainId);
  } catch (error) {
    console.warn(`Failed to convert blockchainId "${blockchainId}" to hex:`, error);
    return blockchainId;
  }
}

// Generate URL-safe slug from chain name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface NetworkTokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  logoUri: string;
  description: string;
}

interface GlacierChain {
  chainId: string;
  status: string;
  chainName: string;
  description: string;
  platformChainId: string; // This is the blockchainId (may be cb58 or hex)
  subnetId: string;
  vmId: string;
  vmName: string;
  explorerUrl: string;
  rpcUrl: string;
  wsUrl?: string;
  isTestnet: boolean;
  networkToken: NetworkTokenInfo;
  chainLogoUri: string;
  private: boolean;
  enabledFeatures: string[];
}

interface GlacierChainsResponse {
  chains: GlacierChain[];
}

interface L1NetworkToken {
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
  description?: string;
}

interface L1Chain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  blockchainId?: string;
  subnetId: string;
  slug: string;
  color?: string;
  category?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  explorers?: Array<{ name: string; link: string }>;
  rpcUrl?: string;
  coingeckoId?: string;
  networkToken?: L1NetworkToken;
  sourcifySupport?: boolean;
  isTestnet?: boolean;
  // Manual safeguard: if true, never remove this entry in --prune mode.
  preserveOnPrune?: boolean;
}

const GLACIER_API_ENDPOINT = 'https://glacier-api.avax.network';

interface CliOptions {
  prune: boolean;
  dryRun: boolean;
  help: boolean;
}

interface PruneDecision {
  keep: boolean;
  reason: string;
}

// Additional guardrails for chains that should never be pruned accidentally.
// Keep this list intentionally small and explicit.
const PROTECTED_CHAIN_IDS = new Set<string>([
  '43114', // Avalanche C-Chain
]);

function parseCliArgs(argv: string[]): CliOptions {
  const args = new Set(argv);
  return {
    prune: args.has('--prune'),
    dryRun: args.has('--dry-run'),
    help: args.has('--help') || args.has('-h'),
  };
}

function printUsage(): void {
  console.log(`
Usage: tsx ./scripts/enrich-chains.mts [options]

Options:
  --prune      Remove stale chains not present in Glacier public list (or now private)
  --dry-run    Show planned updates/prunes without writing constants/l1-chains.json
  -h, --help   Show this help
`);
}

function getPruneDecision(chain: L1Chain, glacierChain?: GlacierChain): PruneDecision {
  if (chain.preserveOnPrune) {
    return { keep: true, reason: 'protected: preserveOnPrune=true' };
  }

  if (PROTECTED_CHAIN_IDS.has(chain.chainId)) {
    return { keep: true, reason: 'protected: chainId allowlist' };
  }

  if (!glacierChain) {
    return { keep: false, reason: 'stale: missing from Glacier' };
  }

  if (glacierChain.private) {
    return { keep: false, reason: 'stale: now private in Glacier' };
  }

  return { keep: true, reason: 'present in Glacier public list' };
}

async function fetchGlacierChains(network: 'mainnet' | 'fuji'): Promise<GlacierChain[]> {
  const url = `${GLACIER_API_ENDPOINT}/v1/chains?network=${network}`;
  
  console.log(`Fetching chains from Glacier API (${network})...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch chains for ${network}: ${response.status} ${response.statusText}`);
    return [];
  }

  const data: GlacierChainsResponse = await response.json();
  console.log(`Found ${data.chains?.length || 0} chains on ${network}`);
  return data.chains || [];
}

function enrichChain(existingChain: L1Chain, glacierChain: GlacierChain): L1Chain {
  const updated: L1Chain = { ...existingChain };

  // Only enrich if the field is missing or empty
  
  // Description - only if not already set
  if (!updated.description && glacierChain.description) {
    updated.description = glacierChain.description;
  }

  // RPC URL - only if not already set
  if (!updated.rpcUrl && glacierChain.rpcUrl) {
    updated.rpcUrl = glacierChain.rpcUrl;
  }

  // Blockchain ID (convert to hex format) - only if not already set
  if (!updated.blockchainId && glacierChain.platformChainId) {
    updated.blockchainId = toHexBlockchainId(glacierChain.platformChainId);
  }

  // Network Token - full object, only if not already set
  if (!updated.networkToken && glacierChain.networkToken) {
    updated.networkToken = {
      name: glacierChain.networkToken.name,
      symbol: glacierChain.networkToken.symbol,
      decimals: glacierChain.networkToken.decimals,
      logoUri: glacierChain.networkToken.logoUri || undefined,
      description: glacierChain.networkToken.description || undefined,
    };
  }

  // Chain Logo URI - only if not already set or empty
  if ((!updated.chainLogoURI || updated.chainLogoURI === '') && glacierChain.chainLogoUri) {
    updated.chainLogoURI = glacierChain.chainLogoUri;
  }

  // SubnetId - verify/update if different (Glacier is authoritative)
  if (glacierChain.subnetId && updated.subnetId !== glacierChain.subnetId) {
    console.log(`  SubnetId mismatch for ${updated.chainName}: local=${updated.subnetId}, glacier=${glacierChain.subnetId}`);
    // Keep the existing one, just log the discrepancy
  }

  // Explorers - add Glacier explorer if not already in the list
  if (glacierChain.explorerUrl) {
    const existingExplorers = updated.explorers || [];
    const hasGlacierExplorer = existingExplorers.some(
      e => e.link.includes('subnets.avax.network') || e.link === glacierChain.explorerUrl
    );
    
    if (!hasGlacierExplorer && glacierChain.explorerUrl.includes('subnets.avax.network')) {
      updated.explorers = [
        { name: 'Avalanche Explorer', link: glacierChain.explorerUrl },
        ...existingExplorers.filter(e => e.name !== 'Avalanche Explorer'),
      ];
    }
  }

  // isTestnet flag
  if (glacierChain.isTestnet) {
    updated.isTestnet = true;
  }

  return updated;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  console.log('=== Enriching l1-chains.json from Glacier API ===\n');
  console.log(`Mode: ${options.prune ? 'enrich + prune' : 'enrich only'}${options.dryRun ? ' (dry-run)' : ''}\n`);

  // Read existing l1-chains.json
  const chainsFilePath = path.join(process.cwd(), 'constants', 'l1-chains.json');

  if (!fs.existsSync(chainsFilePath)) {
    console.error('l1-chains.json not found at:', chainsFilePath);
    process.exit(1);
  }

  const existingChains: L1Chain[] = JSON.parse(fs.readFileSync(chainsFilePath, 'utf-8'));
  console.log(`Loaded ${existingChains.length} existing chains from l1-chains.json\n`);

  // Fetch chains from Glacier API (both mainnet and testnet)
  const [mainnetChains, testnetChains] = await Promise.all([
    fetchGlacierChains('mainnet'),
    fetchGlacierChains('fuji'),
  ]);

  // Create a map of Glacier chains by chainId for quick lookup
  const glacierChainMap = new Map<string, GlacierChain>();
  
  for (const chain of mainnetChains) {
    glacierChainMap.set(chain.chainId, chain);
  }
  
  for (const chain of testnetChains) {
    // Testnet chains might have different chainIds, store them too
    if (!glacierChainMap.has(chain.chainId)) {
      glacierChainMap.set(chain.chainId, chain);
    }
  }

  console.log(`\nTotal unique chains from Glacier: ${glacierChainMap.size}\n`);

  // Enrich existing chains
  let updatedCount = 0;
  let matchedCount = 0;

  const updatedChains = existingChains.map(existingChain => {
    const glacierChain = glacierChainMap.get(existingChain.chainId);
    
    if (glacierChain) {
      matchedCount++;
      const original = JSON.stringify(existingChain);
      const updated = enrichChain(existingChain, glacierChain);
      const updatedStr = JSON.stringify(updated);
      
      if (original !== updatedStr) {
        updatedCount++;
        console.log(`✓ Updated: ${existingChain.chainName} (${existingChain.chainId})`);
      }
      
      return updated;
    }
    
    return existingChain;
  });

  console.log(`\n=== Enrichment Summary ===`);
  console.log(`Total chains in l1-chains.json: ${existingChains.length}`);
  console.log(`Chains matched with Glacier: ${matchedCount}`);
  console.log(`Chains updated: ${updatedCount}`);

  // Optional prune pass. Default remains non-destructive.
  let retainedChains: L1Chain[] = updatedChains;
  const prunedChains: Array<{ chainName: string; chainId: string; reason: string }> = [];
  let protectedKeeps = 0;

  if (options.prune) {
    retainedChains = [];

    for (const chain of updatedChains) {
      const decision = getPruneDecision(chain, glacierChainMap.get(chain.chainId));

      if (decision.keep) {
        retainedChains.push(chain);
        if (decision.reason.startsWith('protected:')) {
          protectedKeeps++;
        }
      } else {
        prunedChains.push({
          chainName: chain.chainName,
          chainId: chain.chainId,
          reason: decision.reason,
        });
      }
    }

    console.log(`\n=== Prune Summary ===`);
    console.log(`Prune enabled: yes`);
    console.log(`Protected keeps: ${protectedKeeps}`);
    console.log(`Pruned chains: ${prunedChains.length}`);

    if (prunedChains.length > 0) {
      console.log(`\nPruned entries:`);
      prunedChains.forEach((entry) => {
        console.log(`  - ${entry.chainName} (${entry.chainId}) -> ${entry.reason}`);
      });
    }
  }

  // Find new chains from Glacier that are not in retained local chains
  const existingChainIds = new Set(retainedChains.map(c => c.chainId));
  const newGlacierChains: GlacierChain[] = [];

  for (const [chainId, glacierChain] of glacierChainMap) {
    if (!existingChainIds.has(chainId) && !glacierChain.private) {
      newGlacierChains.push(glacierChain);
    }
  }

  // Create new L1Chain entries from Glacier chains
  const createdChains: L1Chain[] = newGlacierChains.map(glacierChain => {
    const newChain: L1Chain = {
      chainId: glacierChain.chainId,
      chainName: glacierChain.chainName,
      chainLogoURI: glacierChain.chainLogoUri || '',
      blockchainId: glacierChain.platformChainId ? toHexBlockchainId(glacierChain.platformChainId) : undefined,
      subnetId: glacierChain.subnetId,
      slug: generateSlug(glacierChain.chainName),
      description: glacierChain.description || undefined,
      rpcUrl: glacierChain.rpcUrl || undefined,
      networkToken: glacierChain.networkToken ? {
        name: glacierChain.networkToken.name,
        symbol: glacierChain.networkToken.symbol,
        decimals: glacierChain.networkToken.decimals,
        logoUri: glacierChain.networkToken.logoUri || undefined,
        description: glacierChain.networkToken.description || undefined,
      } : undefined,
      explorers: glacierChain.explorerUrl ? [
        { name: 'Avalanche Explorer', link: glacierChain.explorerUrl }
      ] : undefined,
      isTestnet: glacierChain.isTestnet || false,
    };
    return newChain;
  });

  if (createdChains.length > 0) {
    console.log(`\n=== New chains created from Glacier ===`);
    createdChains.forEach(chain => {
      console.log(`  + ${chain.chainName} (${chain.chainId}) ${chain.isTestnet ? '[Testnet]' : '[Mainnet]'}`);
    });
  }

  // Merge retained + new chains
  const finalChains = [...retainedChains, ...createdChains];

  // Sort chains: mainnet first, then testnet, alphabetically within each group
  finalChains.sort((a, b) => {
    // First sort by testnet status (mainnet first)
    if (a.isTestnet !== b.isTestnet) {
      return a.isTestnet ? 1 : -1;
    }
    // Then alphabetically by name
    return a.chainName.localeCompare(b.chainName);
  });

  console.log(`\n=== Final Summary ===`);
  console.log(`Existing chains: ${existingChains.length}`);
  console.log(`Retained existing chains: ${retainedChains.length}`);
  console.log(`Pruned chains: ${prunedChains.length}`);
  console.log(`New chains added: ${createdChains.length}`);
  console.log(`Total chains: ${finalChains.length}`);

  if (options.dryRun) {
    console.log(`\n⚠ Dry-run mode: no file changes written.`);
    return;
  }

  // Write updated chains back to file
  fs.writeFileSync(
    chainsFilePath,
    JSON.stringify(finalChains, null, 2) + '\n',
    'utf-8'
  );

  console.log(`\n✓ l1-chains.json updated successfully!\n`);
}

main().catch(error => {
  console.error('Error running enrich-chains script:', error);
  process.exit(1);
});
