/**
 * Script to enrich l1-chains.json.
 *
 * Enrichment source: Glacier API (descriptions, logos, RPC URLs, network tokens).
 * Activity authority: P-Chain `platform.getAllValidatorsAt({ height: "proposed" })`.
 *
 * Why two sources: Glacier's /v1/chains is not a source of truth for active L1s —
 * it can omit live L1s (undercount) and retain chains whose validators have all
 * quit (overcount). P-Chain's validator set is authoritative: an L1 is active iff
 * its subnetID appears in validatorSets with a non-empty `validators` array.
 *
 * Default behavior (non-destructive):
 * - Updates matching chains from Glacier
 * - Adds new chains discovered in Glacier (only if their subnetID is active on P-Chain)
 * - Does NOT remove stale local entries
 *
 * Optional prune mode (explicit; non-destructive):
 * - `--prune` flags local entries based on their current P-Chain activity by
 *   writing `isActive: true` / `isActive: false`. No entry is ever deleted, so
 *   curated metadata (descriptions, socials, logos, coingeckoId, brand colors)
 *   is preserved across runs. Downstream consumers already filter on
 *   `isActive === false` to exclude inactive chains from user-facing lists.
 * - Entries with `preserveOnPrune: true` or a `chainId` in `PROTECTED_CHAIN_IDS`
 *   (C-Chain etc.) are always flagged active.
 * - If the P-Chain fetch fails, flagging is skipped (no activity changes on
 *   transient errors).
 * - `--dry-run` previews changes without writing to disk.
 *
 * Usage:
 * - `yarn enrich:chains`
 * - `yarn enrich:chains --prune`
 * - `yarn enrich:chains --prune --dry-run`
 *
 * Runs automatically during: yarn build:remote (with --prune)
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
  // Manual safeguard: if true, always flag this entry as active in --prune mode,
  // even if P-Chain reports no current validators.
  preserveOnPrune?: boolean;
  // Set by --prune mode from P-Chain validator activity. Consumers (e.g.
  // app/api/overview-stats) filter on `isActive === false` to hide inactive
  // chains from user-facing lists while preserving their metadata on disk.
  isActive?: boolean;
  // True/absent for subnet-evm L1s; false for stub entries created from
  // P-Chain `platform.getBlockchains` whose VM is not subnet-evm. Lets EVM-
  // only consumers (RPC calls, explorer pages, faucet, etc.) skip non-EVM
  // chains while they still appear in counts and the network globe.
  isEvm?: boolean;
}

const GLACIER_API_ENDPOINT = 'https://glacier-api.avax.network';

const P_CHAIN_ENDPOINTS = {
  mainnet: 'https://api.avax.network/ext/bc/P',
  fuji: 'https://api.avax-test.network/ext/bc/P',
} as const;

// validatorSets key for the Primary Network — excluded when computing active L1s.
const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

interface CliOptions {
  prune: boolean;
  dryRun: boolean;
  help: boolean;
}

interface ActivityDecision {
  active: boolean;
  reason: string;
}

// Active subnetIDs per network, from P-Chain getAllValidatorsAt({ height: "proposed" }).
interface ActiveSubnetSets {
  mainnet: Set<string>;
  fuji: Set<string>;
  // If either network's fetch failed, prune is unsafe and must be skipped.
  ok: boolean;
}

// Additional guardrails for chains that should never be pruned accidentally.
// Keep this list intentionally small and explicit.
// The C-Chain is included because its "subnet" is the Primary Network, which is
// excluded from active L1 sets by design — without this allowlist, a naive prune
// would drop C-Chain.
const PROTECTED_CHAIN_IDS = new Set<string>([
  '43114', // Avalanche C-Chain (mainnet)
  '43113', // Avalanche Fuji C-Chain (testnet)
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

function getActivityDecision(chain: L1Chain, activeSubnets: ActiveSubnetSets): ActivityDecision {
  if (chain.preserveOnPrune) {
    return { active: true, reason: 'protected: preserveOnPrune=true' };
  }

  if (PROTECTED_CHAIN_IDS.has(chain.chainId)) {
    return { active: true, reason: 'protected: chainId allowlist' };
  }

  // A local entry may lack subnetId (malformed). We cannot evaluate activity, so
  // we leave the existing isActive flag untouched (signaled with active=true +
  // reason so the caller can skip mutation).
  if (!chain.subnetId) {
    return { active: true, reason: 'kept: missing subnetId (cannot evaluate)' };
  }

  const set = chain.isTestnet ? activeSubnets.fuji : activeSubnets.mainnet;
  if (set.has(chain.subnetId)) {
    return { active: true, reason: 'active on P-Chain' };
  }

  return { active: false, reason: 'inactive: no active validators on P-Chain' };
}

interface ValidatorSet {
  validators: Array<{ nodeIDs: string[] }>;
}

interface GetAllValidatorsAtResult {
  validatorSets: Record<string, ValidatorSet>;
}

// platform.getBlockchains response entry. Used to seed stub L1 entries for
// subnets active on P-Chain but not present in Glacier.
interface PChainBlockchain {
  id: string;       // blockchainID (CB58)
  name: string;
  subnetID: string;
  vmID: string;     // CB58 VM identifier
}

// CB58 vmID for subnet-evm. L1s with this vmID are EVM-compatible; others use
// custom VMs (e.g. nftchain, kite) and don't expose an Ethereum-style RPC.
const SUBNET_EVM_VM_ID = 'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy';

async function fetchPChainBlockchains(network: 'mainnet' | 'fuji'): Promise<PChainBlockchain[] | null> {
  const url = P_CHAIN_ENDPOINTS[network];
  console.log(`Fetching blockchain registry from P-Chain (${network})...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'platform.getBlockchains',
        params: {},
      }),
    });

    if (!response.ok) {
      console.error(`P-Chain (${network}) getBlockchains returned ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { result?: { blockchains?: PChainBlockchain[] } };
    const blockchains = body.result?.blockchains;
    if (!Array.isArray(blockchains)) {
      console.error(`P-Chain (${network}) getBlockchains: unexpected response shape`);
      return null;
    }

    console.log(`P-Chain (${network}): ${blockchains.length} blockchains registered`);
    return blockchains;
  } catch (err) {
    console.error(`P-Chain (${network}) getBlockchains failed:`, err);
    return null;
  }
}

// Deterministic accent color from subnetId so stub entries get a stable look
// across runs (used as a fallback brand color for chains without a logo).
function colorFromSubnetId(subnetId: string): string {
  const hash = sha256(new TextEncoder().encode(subnetId));
  return '#' + bytesToHex(hash.slice(0, 3));
}

// Build a stub L1Chain entry for a subnet active on P-Chain but missing from
// Glacier. Uses blockchainID as the unique `chainId` — non-EVM chains have no
// EVM chainId, and even EVM L1s outside Glacier's catalog have no public way
// to discover one without their RPC. Downstream EVM-only code should branch
// on `isEvm` (or fail gracefully on non-numeric chainId).
function createPChainStubChain(
  subnetId: string,
  blockchain: PChainBlockchain,
  isTestnet: boolean,
): L1Chain {
  const isEvm = blockchain.vmID === SUBNET_EVM_VM_ID;
  return {
    chainId: blockchain.id,
    chainName: blockchain.name,
    chainLogoURI: '',
    blockchainId: toHexBlockchainId(blockchain.id),
    subnetId,
    slug: generateSlug(blockchain.name) || `subnet-${subnetId.slice(0, 8).toLowerCase()}`,
    color: colorFromSubnetId(subnetId),
    isTestnet,
    isActive: true,
    isEvm,
  };
}

// Pick one blockchain per subnet to seed stubs (preferring subnet-evm if
// multiple exist). Used to dedupe before creating stub entries.
function buildSubnetToBlockchainMap(blockchains: PChainBlockchain[] | null): Map<string, PChainBlockchain> {
  const map = new Map<string, PChainBlockchain>();
  if (!blockchains) return map;
  for (const bc of blockchains) {
    const existing = map.get(bc.subnetID);
    if (!existing || (bc.vmID === SUBNET_EVM_VM_ID && existing.vmID !== SUBNET_EVM_VM_ID)) {
      map.set(bc.subnetID, bc);
    }
  }
  return map;
}

async function fetchActiveSubnetIds(network: 'mainnet' | 'fuji'): Promise<Set<string> | null> {
  const url = P_CHAIN_ENDPOINTS[network];
  console.log(`Fetching active validator sets from P-Chain (${network})...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'platform.getAllValidatorsAt',
        params: { height: 'proposed' },
      }),
    });

    if (!response.ok) {
      console.error(`P-Chain (${network}) returned ${response.status} ${response.statusText}`);
      return null;
    }

    const body = (await response.json()) as { result?: GetAllValidatorsAtResult; error?: unknown };
    if (!body.result || !body.result.validatorSets) {
      console.error(`P-Chain (${network}) unexpected response:`, body.error ?? 'no validatorSets');
      return null;
    }

    const active = new Set<string>();
    for (const [subnetId, set] of Object.entries(body.result.validatorSets)) {
      if (subnetId === PRIMARY_NETWORK_SUBNET_ID) continue;
      if (set.validators && set.validators.length > 0) {
        active.add(subnetId);
      }
    }

    console.log(`P-Chain (${network}): ${active.size} active L1s`);
    return active;
  } catch (err) {
    console.error(`P-Chain (${network}) fetch failed:`, err);
    return null;
  }
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

  // Fetch Glacier chains + P-Chain active subnet sets + P-Chain blockchain
  // registry in parallel. The blockchain registry is only consulted when prune
  // mode is on, since that's when we materialise stub entries for active
  // subnets that Glacier doesn't know about.
  const [
    mainnetChains,
    testnetChains,
    activeMainnet,
    activeFuji,
    mainnetBlockchains,
    fujiBlockchains,
  ] = await Promise.all([
    fetchGlacierChains('mainnet'),
    fetchGlacierChains('fuji'),
    options.prune ? fetchActiveSubnetIds('mainnet') : Promise.resolve(null),
    options.prune ? fetchActiveSubnetIds('fuji') : Promise.resolve(null),
    options.prune ? fetchPChainBlockchains('mainnet') : Promise.resolve(null),
    options.prune ? fetchPChainBlockchains('fuji') : Promise.resolve(null),
  ]);

  const activeSubnets: ActiveSubnetSets = {
    mainnet: activeMainnet ?? new Set<string>(),
    fuji: activeFuji ?? new Set<string>(),
    ok: activeMainnet !== null && activeFuji !== null,
  };

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

  // Optional prune pass (non-destructive: flags activity, never deletes).
  const retainedChains: L1Chain[] = updatedChains;
  const flaggedInactive: Array<{ chainName: string; chainId: string; reason: string }> = [];
  let flaggedActive = 0;
  let protectedActive = 0;
  let skippedNoSubnetId = 0;

  if (options.prune) {
    if (!activeSubnets.ok) {
      console.warn(`\n⚠ Skipping activity flagging: P-Chain active validator set could not be fetched.`);
      console.warn(`  l1-chains.json will be enriched but isActive flags left untouched.`);
    } else {
      for (let i = 0; i < retainedChains.length; i++) {
        const chain = retainedChains[i];
        const decision = getActivityDecision(chain, activeSubnets);

        // Cannot evaluate — leave existing isActive as-is.
        if (decision.reason.startsWith('kept: missing subnetId')) {
          skippedNoSubnetId++;
          continue;
        }

        const previousActive = chain.isActive;
        const nextActive = decision.active;

        if (previousActive !== nextActive) {
          retainedChains[i] = { ...chain, isActive: nextActive };
        } else if (chain.isActive === undefined) {
          // First-time flag write even if boolean value matches default.
          retainedChains[i] = { ...chain, isActive: nextActive };
        }

        if (nextActive) {
          flaggedActive++;
          if (decision.reason.startsWith('protected:')) protectedActive++;
        } else {
          flaggedInactive.push({
            chainName: chain.chainName,
            chainId: chain.chainId,
            reason: decision.reason,
          });
        }
      }

      console.log(`\n=== Activity Flagging Summary ===`);
      console.log(`Authority: P-Chain getAllValidatorsAt`);
      console.log(`Active L1s on mainnet: ${activeSubnets.mainnet.size}`);
      console.log(`Active L1s on Fuji: ${activeSubnets.fuji.size}`);
      console.log(`Flagged isActive=true:  ${flaggedActive} (of which ${protectedActive} via protection rules)`);
      console.log(`Flagged isActive=false: ${flaggedInactive.length}`);
      if (skippedNoSubnetId > 0) {
        console.log(`Skipped (no subnetId, cannot evaluate): ${skippedNoSubnetId}`);
      }

      if (flaggedInactive.length > 0) {
        console.log(`\nEntries flagged isActive=false (metadata preserved):`);
        flaggedInactive.forEach((entry) => {
          console.log(`  - ${entry.chainName} (${entry.chainId}) -> ${entry.reason}`);
        });
      }
    }
  }

  // Find new chains from Glacier that are not in retained local chains.
  // In prune mode with active sets available, require the subnet to be active on
  // P-Chain before creating a new entry — prevents re-adding inactive ghosts that
  // Glacier still lists as public.
  const existingChainIds = new Set(retainedChains.map(c => c.chainId));
  const newGlacierChains: GlacierChain[] = [];
  const gateNewByActivity = options.prune && activeSubnets.ok;
  let skippedInactiveNewChains = 0;

  for (const [chainId, glacierChain] of glacierChainMap) {
    if (existingChainIds.has(chainId) || glacierChain.private) continue;

    if (gateNewByActivity) {
      const set = glacierChain.isTestnet ? activeSubnets.fuji : activeSubnets.mainnet;
      if (!glacierChain.subnetId || !set.has(glacierChain.subnetId)) {
        skippedInactiveNewChains++;
        continue;
      }
    }

    newGlacierChains.push(glacierChain);
  }

  if (gateNewByActivity && skippedInactiveNewChains > 0) {
    console.log(`\nSkipped ${skippedInactiveNewChains} Glacier chain(s) with no active P-Chain validators.`);
  }

  // Create new L1Chain entries from Glacier chains. When prune gating is on,
  // these come from the P-Chain-active subset, so tag isActive: true.
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
      ...(gateNewByActivity ? { isActive: true } : {}),
    };
    return newChain;
  });

  if (createdChains.length > 0) {
    console.log(`\n=== New chains created from Glacier ===`);
    createdChains.forEach(chain => {
      console.log(`  + ${chain.chainName} (${chain.chainId}) ${chain.isTestnet ? '[Testnet]' : '[Mainnet]'}`);
    });
  }

  // P-Chain stub pass: every subnet with active validators on P-Chain that's
  // still not represented (no entry with matching subnetId across retained or
  // newly-created Glacier entries) gets a stub seeded from
  // platform.getBlockchains. This makes P-Chain the source of truth for which
  // L1s exist — Glacier is just an enrichment layer when available.
  const pchainStubs: L1Chain[] = [];
  if (options.prune && activeSubnets.ok) {
    const coveredSubnetIds = new Set<string>();
    for (const c of [...retainedChains, ...createdChains]) {
      if (c.subnetId) coveredSubnetIds.add(c.subnetId);
    }

    const mainnetSubnetMap = buildSubnetToBlockchainMap(mainnetBlockchains);
    const fujiSubnetMap = buildSubnetToBlockchainMap(fujiBlockchains);

    for (const sid of activeSubnets.mainnet) {
      if (coveredSubnetIds.has(sid)) continue;
      const bc = mainnetSubnetMap.get(sid);
      if (!bc) continue; // Active subnet with no registered blockchain; skip.
      pchainStubs.push(createPChainStubChain(sid, bc, false));
    }
    for (const sid of activeSubnets.fuji) {
      if (coveredSubnetIds.has(sid)) continue;
      const bc = fujiSubnetMap.get(sid);
      if (!bc) continue;
      pchainStubs.push(createPChainStubChain(sid, bc, true));
    }

    if (pchainStubs.length > 0) {
      console.log(`\n=== P-Chain stub entries (active L1s without Glacier metadata) ===`);
      const evmCount = pchainStubs.filter(c => c.isEvm).length;
      console.log(`Total: ${pchainStubs.length}  (EVM: ${evmCount}, non-EVM: ${pchainStubs.length - evmCount})`);
      pchainStubs.forEach(c => {
        const tag = `${c.isTestnet ? 'Testnet' : 'Mainnet'}, ${c.isEvm ? 'EVM' : 'non-EVM'}`;
        console.log(`  + ${c.chainName}  [${tag}]  subnet=${c.subnetId.slice(0, 12)}...`);
      });
    }
  }

  // Merge retained + new Glacier-derived + P-Chain stub chains.
  const finalChains = [...retainedChains, ...createdChains, ...pchainStubs];

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
  console.log(`New from Glacier: ${createdChains.length}`);
  console.log(`P-Chain stubs: ${pchainStubs.length}`);
  console.log(`Total chains: ${finalChains.length}`);
  if (options.prune && activeSubnets.ok) {
    console.log(`Entries flagged isActive=false: ${flaggedInactive.length} (metadata preserved)`);
  }

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

  // When prune ran successfully, snapshot the P-Chain active L1 counts to a
  // static file. Consumers (e.g. /stats/overview) can import this at build time
  // instead of calling P-Chain on every request, which avoids serverless
  // cold-start hangs and keeps the count fresh as of the last build.
  if (options.prune && activeSubnets.ok) {
    const countsFilePath = path.join(process.cwd(), 'constants', 'active-l1-counts.json');
    const payload = {
      mainnet: activeSubnets.mainnet.size,
      fuji: activeSubnets.fuji.size,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(countsFilePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
    console.log(`✓ active-l1-counts.json written: mainnet=${payload.mainnet} fuji=${payload.fuji}\n`);
  }
}

main().catch(error => {
  console.error('Error running enrich-chains script:', error);
  process.exit(1);
});
