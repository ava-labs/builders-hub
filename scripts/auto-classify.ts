/**
 * Auto-Classification Script
 *
 * Chains multiple data sources to bulk-identify unclassified C-Chain contracts.
 *
 * Phase 1: Routescan API — verified contract name lookup
 * Phase 2: Deployer Clustering — group by deployer, inherit protocol from siblings
 * Phase 3: DefiLlama Adapters — mine hardcoded addresses from adapter source files
 *
 * Usage:
 *   npx tsx scripts/auto-classify.ts
 *   npx tsx scripts/auto-classify.ts --days 30 --limit 200 --phase 1
 *   npx tsx scripts/auto-classify.ts --days 90 --limit 300
 */

import "dotenv/config";
import { CONTRACT_REGISTRY, type ContractInfo } from "../lib/contracts";
import { getTopUnknownContracts, getTotalChainGas } from "../lib/clickhouse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassifiedResult {
  address: string;
  contractName: string;
  suggestedProtocol: string;
  suggestedCategory: ContractInfo["category"];
  suggestedType: ContractInfo["type"];
  confidence: "high" | "medium" | "low";
  source: "routescan" | "deployer" | "defillama";
  gasPercent?: number;
}

interface DeployerCluster {
  deployer: string;
  knownProtocol: string | null;
  knownCategory: ContractInfo["category"] | null;
  knownContracts: string[];
  unknownContracts: string[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { days: number; limit: number; phase: number | null } {
  const args = process.argv.slice(2);
  let days = 30;
  let limit = 200;
  let phase: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--phase" && args[i + 1]) {
      phase = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { days, limit, phase };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Phase 1: Routescan contract name lookup
// ---------------------------------------------------------------------------

/**
 * Name-to-protocol mapping. Keys are lowercased substrings or patterns
 * matched against the contract name returned by Routescan getsourcecode.
 */
const NAME_TO_PROTOCOL: {
  pattern: RegExp;
  protocol: string;
  category: ContractInfo["category"];
  type: ContractInfo["type"];
}[] = [
  // DEXs
  { pattern: /traderjoe|joerouter|joelib|joefactory|joebar|joetoken|^joe[^p]/i, protocol: "Trader Joe", category: "dex", type: "router" },
  { pattern: /liquiditybook|^lb(router|factory|pair|quoter|hook)/i, protocol: "Trader Joe", category: "dex", type: "pool" },
  { pattern: /pangolin/i, protocol: "Pangolin", category: "dex", type: "router" },
  { pattern: /uniswap|uniV3|nonfungiblepositionmanager/i, protocol: "Uniswap", category: "dex", type: "router" },
  { pattern: /sushiswap|sushirouter|masterchef(?!joe)/i, protocol: "SushiSwap", category: "dex", type: "router" },
  { pattern: /curve|stableswap.*pool/i, protocol: "Curve", category: "dex", type: "pool" },
  { pattern: /platypus/i, protocol: "Platypus", category: "dex", type: "pool" },
  { pattern: /pharaoh|ramses(?!.*nft)/i, protocol: "Pharaoh", category: "dex", type: "router" },
  { pattern: /kyberswap|kyber/i, protocol: "KyberSwap", category: "dex", type: "router" },
  { pattern: /dodo/i, protocol: "DODO", category: "dex", type: "router" },
  { pattern: /balancer|weightedpool|vault.*balancer/i, protocol: "Balancer", category: "dex", type: "pool" },
  { pattern: /blackhole/i, protocol: "Blackhole DEX", category: "dex", type: "router" },
  { pattern: /aquaspace/i, protocol: "AquaSpace", category: "dex", type: "router" },

  // DEX Aggregators
  { pattern: /paraswap|augustus/i, protocol: "ParaSwap", category: "dex", type: "router" },
  { pattern: /1inch|aggregationrouter/i, protocol: "1inch", category: "dex", type: "router" },
  { pattern: /openocean/i, protocol: "OpenOcean", category: "dex", type: "router" },
  { pattern: /odos/i, protocol: "Odos", category: "dex", type: "router" },
  { pattern: /0x.*exchange|zerox|fillquote/i, protocol: "0x Protocol", category: "dex", type: "router" },
  { pattern: /cowprotocol|cowswap|gpsettlement/i, protocol: "CoW Protocol", category: "dex", type: "router" },
  { pattern: /okx|dexrouter/i, protocol: "OKX DEX", category: "dex", type: "router" },
  { pattern: /magpie|flytrade/i, protocol: "Fly.trade", category: "dex", type: "router" },
  { pattern: /metamask.*swap/i, protocol: "MetaMask Swaps", category: "dex", type: "router" },

  // Lending
  { pattern: /aave|atoken|variabledebt|stabledebt|lendingpool|pooladdressprovider/i, protocol: "Aave", category: "lending", type: "pool" },
  { pattern: /benqi|qitoken|qi(avax|usdc|btc|eth|dai|link|usdt)|comptroller/i, protocol: "Benqi", category: "lending", type: "pool" },

  // Derivatives (GMX subaccount patterns BEFORE Relay to prevent false match)
  { pattern: /gmx|glp|positionrouter|orderbook(?!.*joe)|subaccount.*gelato.*relay/i, protocol: "GMX", category: "derivatives", type: "vault" },

  // Bridge
  { pattern: /stargate|stgtoken|stargaterouter/i, protocol: "Stargate", category: "bridge", type: "router" },
  { pattern: /layerzero|endpoint.*lz|ultralightnode/i, protocol: "LayerZero", category: "bridge", type: "router" },
  { pattern: /lifi|lifidiamond/i, protocol: "LI.FI", category: "bridge", type: "router" },
  { pattern: /^relay(router|bridge|receiver)/i, protocol: "Relay", category: "bridge", type: "router" },
  { pattern: /mayan/i, protocol: "Mayan Finance", category: "bridge", type: "router" },

  // Yield
  { pattern: /yieldyak|yakvault|yakrouter|yakstrategy/i, protocol: "Yield Yak", category: "yield", type: "vault" },
  { pattern: /avant/i, protocol: "Avant", category: "yield", type: "vault" },
  { pattern: /sickle|vfat/i, protocol: "vfat.io", category: "yield", type: "vault" },

  // Infrastructure
  { pattern: /wavax|weth|wrappedavax|wrappednative/i, protocol: "Infrastructure", category: "infrastructure", type: "token" },
  { pattern: /multicall/i, protocol: "Infrastructure", category: "infrastructure", type: "other" },
  { pattern: /chainlink|aggregator.*oracle|pricefeed/i, protocol: "Chainlink", category: "infrastructure", type: "other" },
  { pattern: /pyth/i, protocol: "Pyth", category: "infrastructure", type: "other" },
  { pattern: /^entrypoint$|entrypoint.*account|erc4337|account.*abstraction/i, protocol: "ERC-4337", category: "infrastructure", type: "other" },
  { pattern: /rain(?!bow)/i, protocol: "Rain", category: "infrastructure", type: "other" },

  // Tokens
  { pattern: /tether|usdt(?!.*swap)/i, protocol: "Tether", category: "token", type: "token" },
  { pattern: /circle|usdc(?!.*swap)|fiattoken/i, protocol: "Circle", category: "token", type: "token" },
  { pattern: /xen/i, protocol: "XEN Crypto", category: "token", type: "token" },

  // NFT / Gaming
  { pattern: /opensea|seaport|conduit/i, protocol: "OpenSea", category: "nft", type: "other" },
  { pattern: /dokyo/i, protocol: "Dokyo", category: "nft", type: "other" },
  { pattern: /joepegs/i, protocol: "Joepegs", category: "nft", type: "other" },
  { pattern: /crabada/i, protocol: "Crabada", category: "gaming", type: "other" },
  { pattern: /chikn/i, protocol: "Chikn", category: "gaming", type: "other" },
  { pattern: /stepapp/i, protocol: "Step App", category: "gaming", type: "other" },
  { pattern: /sealfi/i, protocol: "Sealfi", category: "gaming", type: "other" },
  { pattern: /avaxpixel|apix/i, protocol: "AvaxPixel", category: "gaming", type: "other" },
  { pattern: /movequest|getfit/i, protocol: "MoveQuest", category: "gaming", type: "other" },
  { pattern: /myprize/i, protocol: "MyPrize", category: "gaming", type: "other" },

  // ICM / Avalanche native
  { pattern: /teleporter|icm|warp/i, protocol: "Avalanche ICM", category: "icm", type: "router" },

  // Chainlink CCIP
  { pattern: /commitstore|onramp|offramp|ccip|evm2evm|blockhashstore|keystoneforwarder|authorizedforwarder/i, protocol: "Chainlink", category: "infrastructure", type: "other" },

  // Gauges (Solidly-fork pattern — Pharaoh on Avalanche)
  { pattern: /^gauge(cl|v2)?$/i, protocol: "Pharaoh", category: "dex", type: "staking" },
  { pattern: /votingescrow.*helper|^ve(split|helper)/i, protocol: "Pharaoh", category: "dex", type: "other" },

  // GMX v2 handlers
  { pattern: /glvshifthandler|withdrawalhandler|liquidationhandler|deposithandler/i, protocol: "GMX", category: "derivatives", type: "controller" },

  // LayerZero v2
  { pattern: /receiveuln|senduln|ultralightnode|^uln\d/i, protocol: "LayerZero", category: "bridge", type: "other" },

  // DODO (DPP = DODO Private Pool)
  { pattern: /^dpp(advanced)?admin$/i, protocol: "DODO", category: "dex", type: "pool" },

  // Rango
  { pattern: /rango/i, protocol: "Rango", category: "bridge", type: "router" },

  // Aave v3 additional
  { pattern: /wrappedtokengateway/i, protocol: "Aave", category: "lending", type: "other" },
  { pattern: /riskoracle/i, protocol: "Aave", category: "lending", type: "other" },

  // Silo Finance
  { pattern: /silo(vault|router|lens)/i, protocol: "Silo Finance", category: "lending", type: "vault" },

  // MEV
  { pattern: /flashbot|mev|arbitrage/i, protocol: "MEV / Arbitrage", category: "mev", type: "other" },

  // RWA
  { pattern: /valinor|oatfi|fence/i, protocol: "Valinor OatFi", category: "rwa", type: "other" },
];

/**
 * Try to infer protocol/category/type from a Routescan contract name.
 */
function inferFromContractName(
  contractName: string
): { protocol: string; category: ContractInfo["category"]; type: ContractInfo["type"]; confidence: "high" | "medium" } | null {
  if (!contractName || contractName === "Contract") return null;

  for (const mapping of NAME_TO_PROTOCOL) {
    if (mapping.pattern.test(contractName)) {
      return {
        protocol: mapping.protocol,
        category: mapping.category,
        type: mapping.type,
        confidence: "high",
      };
    }
  }

  // Heuristic fallback: try to classify by common contract suffixes
  const lc = contractName.toLowerCase();
  if (/router|swap/i.test(lc)) return { protocol: contractName, category: "dex", type: "router", confidence: "medium" };
  if (/pool|pair|amm/i.test(lc)) return { protocol: contractName, category: "dex", type: "pool", confidence: "medium" };
  if (/vault|strategy/i.test(lc)) return { protocol: contractName, category: "yield", type: "vault", confidence: "medium" };
  if (/factory/i.test(lc)) return { protocol: contractName, category: "infrastructure", type: "factory", confidence: "medium" };
  if (/token|erc20/i.test(lc)) return { protocol: contractName, category: "token", type: "token", confidence: "medium" };
  if (/proxy|diamond/i.test(lc)) return { protocol: contractName, category: "infrastructure", type: "controller", confidence: "medium" };
  if (/staking|rewards|farm|gauge/i.test(lc)) return { protocol: contractName, category: "yield", type: "staking", confidence: "medium" };
  if (/bridge/i.test(lc)) return { protocol: contractName, category: "bridge", type: "router", confidence: "medium" };
  if (/nft|erc721|erc1155/i.test(lc)) return { protocol: contractName, category: "nft", type: "other", confidence: "medium" };
  if (/lending|borrow|collateral/i.test(lc)) return { protocol: contractName, category: "lending", type: "pool", confidence: "medium" };

  return null;
}

interface RoutescanSourceResult {
  ContractName: string;
  CompilerVersion: string;
  ABI: string;
  Proxy: string;
  Implementation: string;
}

async function routescanGetSourceCode(address: string): Promise<RoutescanSourceResult | null> {
  const url = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=${address}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== "1" || !json.result?.[0]) return null;
    const r = json.result[0];
    if (!r.ContractName || r.ContractName === "" || r.ABI === "Contract source code not verified") {
      return null;
    }
    return r as RoutescanSourceResult;
  } catch {
    return null;
  }
}

async function runPhase1(
  unknowns: { address: string; totalGas: number }[],
  totalGas: number
): Promise<{ classified: ClassifiedResult[]; remaining: string[] }> {
  console.log("\n--- Phase 1: Routescan Contract Name Lookup ---\n");

  const classified: ClassifiedResult[] = [];
  const remaining: string[] = [];
  let verified = 0;
  let identified = 0;

  for (let i = 0; i < unknowns.length; i++) {
    const { address, totalGas: contractGas } = unknowns[i];
    const gasPct = totalGas > 0 ? (contractGas / totalGas) * 100 : 0;

    process.stdout.write(`  [${i + 1}/${unknowns.length}] ${shortAddr(address)} ...`);

    const src = await routescanGetSourceCode(address);

    if (!src) {
      process.stdout.write(" not verified\n");
      remaining.push(address);
      await sleep(500); // be gentle with rate limits
      continue;
    }

    verified++;
    const inference = inferFromContractName(src.ContractName);

    if (inference) {
      identified++;
      classified.push({
        address,
        contractName: src.ContractName,
        suggestedProtocol: inference.protocol,
        suggestedCategory: inference.category,
        suggestedType: inference.type,
        confidence: inference.confidence,
        source: "routescan",
        gasPercent: gasPct,
      });
      process.stdout.write(` "${src.ContractName}" → ${inference.protocol} [${inference.confidence}]\n`);
    } else {
      classified.push({
        address,
        contractName: src.ContractName,
        suggestedProtocol: src.ContractName,
        suggestedCategory: "other",
        suggestedType: "other",
        confidence: "low",
        source: "routescan",
        gasPercent: gasPct,
      });
      remaining.push(address);
      process.stdout.write(` "${src.ContractName}" → ??? [unknown]\n`);
    }

    await sleep(500);
  }

  console.log(`\n  Phase 1 summary: ${verified} verified, ${identified} identified / ${unknowns.length} queried`);
  return { classified, remaining };
}

// ---------------------------------------------------------------------------
// Phase 2: Deployer Clustering via Routescan getcontractcreation
// ---------------------------------------------------------------------------

interface CreationInfo {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
}

async function routescanGetCreators(addresses: string[]): Promise<CreationInfo[]> {
  // Batch up to 5 per call
  const results: CreationInfo[] = [];
  for (let i = 0; i < addresses.length; i += 5) {
    const batch = addresses.slice(i, i + 5);
    const url = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getcontractcreation&contractaddresses=${batch.join(",")}`;
    try {
      const res = await fetch(url);
      if (!res.ok) { await sleep(500); continue; }
      const json = await res.json();
      if (json.status === "1" && Array.isArray(json.result)) {
        for (const r of json.result) {
          results.push({
            contractAddress: r.contractAddress?.toLowerCase(),
            contractCreator: r.contractCreator?.toLowerCase(),
            txHash: r.txHash,
          });
        }
      }
    } catch {
      // skip
    }
    await sleep(500);
  }
  return results;
}

async function runPhase2(
  remainingAddresses: string[],
  totalGas: number,
  unknownsMap: Map<string, number> // address -> totalGas
): Promise<{ classified: ClassifiedResult[]; remaining: string[]; clusters: DeployerCluster[] }> {
  console.log("\n--- Phase 2: Deployer Clustering ---\n");

  // 1. Get deployers for known contracts
  const knownAddresses = Object.keys(CONTRACT_REGISTRY);
  console.log(`  Fetching deployers for ${knownAddresses.length} known contracts...`);
  const knownCreations = await routescanGetCreators(knownAddresses);

  // Build deployer -> known contracts map
  const deployerToKnown = new Map<string, string[]>();
  for (const c of knownCreations) {
    if (!c.contractCreator) continue;
    const list = deployerToKnown.get(c.contractCreator) || [];
    list.push(c.contractAddress);
    deployerToKnown.set(c.contractCreator, list);
  }
  console.log(`  Found ${deployerToKnown.size} unique deployers for known contracts`);

  // 2. Get deployers for unknown contracts
  console.log(`  Fetching deployers for ${remainingAddresses.length} unclassified contracts...`);
  const unknownCreations = await routescanGetCreators(remainingAddresses);

  // Build deployer -> unknown contracts map
  const deployerToUnknown = new Map<string, string[]>();
  for (const c of unknownCreations) {
    if (!c.contractCreator) continue;
    const list = deployerToUnknown.get(c.contractCreator) || [];
    list.push(c.contractAddress);
    deployerToUnknown.set(c.contractCreator, list);
  }

  // 3. Find overlapping deployers
  const classified: ClassifiedResult[] = [];
  const classifiedAddrs = new Set<string>();
  const clusters: DeployerCluster[] = [];

  for (const [deployer, unknownContracts] of deployerToUnknown.entries()) {
    const knownContracts = deployerToKnown.get(deployer);
    if (knownContracts && knownContracts.length > 0) {
      // Look up the protocol from the known contracts
      const knownInfo = CONTRACT_REGISTRY[knownContracts[0]];
      if (!knownInfo) continue;

      const cluster: DeployerCluster = {
        deployer,
        knownProtocol: knownInfo.protocol,
        knownCategory: knownInfo.category,
        knownContracts,
        unknownContracts,
      };
      clusters.push(cluster);

      for (const addr of unknownContracts) {
        const gasPct = unknownsMap.has(addr) ? (unknownsMap.get(addr)! / totalGas) * 100 : 0;
        classified.push({
          address: addr,
          contractName: `(deployed by ${shortAddr(deployer)})`,
          suggestedProtocol: knownInfo.protocol,
          suggestedCategory: knownInfo.category,
          suggestedType: "other",
          confidence: "medium",
          source: "deployer",
          gasPercent: gasPct,
        });
        classifiedAddrs.add(addr);
      }
    } else if (unknownContracts.length >= 3) {
      // Large cluster of unknowns from same deployer — flag for review
      clusters.push({
        deployer,
        knownProtocol: null,
        knownCategory: null,
        knownContracts: [],
        unknownContracts,
      });
    }
  }

  const remaining = remainingAddresses.filter((a) => !classifiedAddrs.has(a));

  console.log(`  Phase 2 summary: ${classified.length} identified via deployer clustering / ${remainingAddresses.length} queried`);
  console.log(`  Found ${clusters.length} deployer clusters (${clusters.filter((c) => c.knownProtocol).length} with known protocol)`);

  return { classified, remaining, clusters };
}

// ---------------------------------------------------------------------------
// Phase 3: DefiLlama Adapters Mining
// ---------------------------------------------------------------------------

interface DefiLlamaProtocol {
  name: string;
  slug: string;
  chains: string[];
  category: string;
  url: string;
}

async function fetchDefiLlamaProtocols(): Promise<DefiLlamaProtocol[]> {
  try {
    const res = await fetch("https://api.llama.fi/protocols", {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.log(`  DefiLlama API returned ${res.status}`);
      return [];
    }
    const text = await res.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      console.log("  DefiLlama API returned non-array");
      return [];
    }
    return data
      .filter((p: any) => p.chains?.includes("Avalanche"))
      .map((p: any) => ({
        name: p.name,
        slug: p.slug,
        chains: p.chains,
        category: p.category || "unknown",
        url: p.url || "",
      }));
  } catch (err) {
    console.log(`  DefiLlama fetch error: ${err}`);
    return [];
  }
}

async function fetchAdapterSource(slug: string): Promise<string | null> {
  const urls = [
    `https://raw.githubusercontent.com/DefiLlama/DefiLlama-Adapters/main/projects/${slug}/index.js`,
    `https://raw.githubusercontent.com/DefiLlama/DefiLlama-Adapters/main/projects/${slug}.js`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      // try next
    }
  }
  return null;
}

function extractAddresses(source: string): string[] {
  const regex = /0x[a-fA-F0-9]{40}/g;
  const matches = source.match(regex) || [];
  // Deduplicate and lowercase
  return [...new Set(matches.map((a) => a.toLowerCase()))];
}

function mapDefiLlamaCategory(category: string): ContractInfo["category"] {
  const lc = category.toLowerCase();
  if (lc.includes("dex")) return "dex";
  if (lc.includes("lending") || lc.includes("cdp")) return "lending";
  if (lc.includes("derivative") || lc.includes("option") || lc.includes("perp")) return "derivatives";
  if (lc.includes("bridge") || lc.includes("cross-chain")) return "bridge";
  if (lc.includes("nft")) return "nft";
  if (lc.includes("yield") || lc.includes("farm") || lc.includes("liquid staking")) return "yield";
  if (lc.includes("gaming") || lc.includes("game")) return "gaming";
  if (lc.includes("rwa") || lc.includes("real world")) return "rwa";
  return "other";
}

async function runPhase3(
  remainingAddresses: string[],
  totalGas: number,
  unknownsMap: Map<string, number>
): Promise<{ classified: ClassifiedResult[] }> {
  console.log("\n--- Phase 3: DefiLlama Adapters Mining ---\n");

  const remainingSet = new Set(remainingAddresses);
  const classified: ClassifiedResult[] = [];

  // 1. Fetch all Avalanche protocols from DefiLlama
  console.log("  Fetching Avalanche protocols from DefiLlama...");
  const protocols = await fetchDefiLlamaProtocols();
  console.log(`  Found ${protocols.length} Avalanche protocols`);

  // Filter out protocols we already have fully covered
  const knownProtocols = new Set(
    Object.values(CONTRACT_REGISTRY).map((c) => c.protocol.toLowerCase())
  );

  let fetchedCount = 0;
  let matchCount = 0;

  for (const protocol of protocols) {
    const source = await fetchAdapterSource(protocol.slug);
    if (!source) continue;
    fetchedCount++;

    const addresses = extractAddresses(source);
    const matches = addresses.filter((a) => remainingSet.has(a));

    if (matches.length > 0) {
      const category = mapDefiLlamaCategory(protocol.category);
      for (const addr of matches) {
        matchCount++;
        const gasPct = unknownsMap.has(addr) ? (unknownsMap.get(addr)! / totalGas) * 100 : 0;
        classified.push({
          address: addr,
          contractName: `(from ${protocol.slug} adapter)`,
          suggestedProtocol: protocol.name,
          suggestedCategory: category,
          suggestedType: "other",
          confidence: "medium",
          source: "defillama",
          gasPercent: gasPct,
        });
        remainingSet.delete(addr);
      }
    }

    // Rate-limit GitHub raw access
    if (fetchedCount % 50 === 0) {
      console.log(`  [${fetchedCount}/${protocols.length}] adapters fetched, ${matchCount} matches so far`);
      await sleep(200);
    }
  }

  console.log(`\n  Phase 3 summary: ${matchCount} identified from ${fetchedCount} adapters / ${remainingAddresses.length} remaining`);
  return { classified };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function printResults(
  allClassified: ClassifiedResult[],
  clusters: DeployerCluster[],
  meta: { days: number; limit: number; totalGas: number; knownCount: number; phase1: number; phase2: number; phase3: number }
) {
  // Deduplicate by address (earlier phases take priority)
  const seen = new Set<string>();
  const deduped: ClassifiedResult[] = [];
  for (const r of allClassified) {
    if (!seen.has(r.address)) {
      seen.add(r.address);
      deduped.push(r);
    }
  }

  const high = deduped.filter((r) => r.confidence === "high");
  const medium = deduped.filter((r) => r.confidence === "medium");
  const low = deduped.filter((r) => r.confidence === "low");

  const totalGasImpact = deduped
    .filter((r) => r.confidence !== "low")
    .reduce((sum, r) => sum + (r.gasPercent || 0), 0);

  console.log("\n" + "=".repeat(100));
  console.log(`  Auto-Classification Results (${meta.days}d, top ${meta.limit})`);
  console.log(`  Phase 1 (Routescan):  ${meta.phase1} identified`);
  console.log(`  Phase 2 (Deployer):   ${meta.phase2} identified`);
  console.log(`  Phase 3 (DefiLlama):  ${meta.phase3} identified`);
  console.log(`  Total unique:         ${deduped.length} (${high.length} high, ${medium.length} medium, ${low.length} low confidence)`);
  console.log("=".repeat(100));

  if (high.length > 0) {
    console.log(`\n  HIGH CONFIDENCE (${high.length}):`);
    console.log("  " + "-".repeat(96));
    const hdr = `  ${padRight("Address", 44)}${padRight("ContractName", 28)}${padRight("Protocol", 20)}${padRight("Cat", 14)}Gas%`;
    console.log(hdr);
    console.log("  " + "-".repeat(96));
    for (const r of high.sort((a, b) => (b.gasPercent || 0) - (a.gasPercent || 0))) {
      const line = `  ${padRight(r.address, 44)}${padRight(r.contractName.slice(0, 26), 28)}${padRight(r.suggestedProtocol.slice(0, 18), 20)}${padRight(r.suggestedCategory, 14)}${(r.gasPercent || 0).toFixed(2)}%`;
      console.log(line);
    }
  }

  if (medium.length > 0) {
    console.log(`\n  MEDIUM CONFIDENCE (${medium.length}):`);
    console.log("  " + "-".repeat(96));
    for (const r of medium.sort((a, b) => (b.gasPercent || 0) - (a.gasPercent || 0))) {
      const line = `  ${padRight(r.address, 44)}${padRight(r.contractName.slice(0, 26), 28)}${padRight(r.suggestedProtocol.slice(0, 18), 20)}${padRight(r.suggestedCategory, 14)}${(r.gasPercent || 0).toFixed(2)}%`;
      console.log(line);
    }
  }

  if (low.length > 0) {
    console.log(`\n  LOW CONFIDENCE / UNKNOWN (${low.length}):`);
    console.log("  " + "-".repeat(96));
    for (const r of low.sort((a, b) => (b.gasPercent || 0) - (a.gasPercent || 0)).slice(0, 30)) {
      const line = `  ${padRight(r.address, 44)}${padRight(r.contractName.slice(0, 26), 28)}${padRight("???", 20)}${padLeft((r.gasPercent || 0).toFixed(2) + "%", 8)}`;
      console.log(line);
    }
    if (low.length > 30) {
      console.log(`  ... and ${low.length - 30} more`);
    }
  }

  // Deployer clusters
  const knownClusters = clusters.filter((c) => c.knownProtocol);
  const unknownClusters = clusters.filter((c) => !c.knownProtocol);

  if (knownClusters.length > 0) {
    console.log(`\n  DEPLOYER CLUSTERS (matched to known protocols):`);
    console.log("  " + "-".repeat(96));
    for (const c of knownClusters.sort((a, b) => b.unknownContracts.length - a.unknownContracts.length)) {
      console.log(`  Deployer ${shortAddr(c.deployer)} → ${c.knownProtocol} (${c.unknownContracts.length} new, ${c.knownContracts.length} known)`);
    }
  }

  if (unknownClusters.length > 0) {
    console.log(`\n  DEPLOYER CLUSTERS (unknown protocol, 3+ contracts):`);
    console.log("  " + "-".repeat(96));
    for (const c of unknownClusters.sort((a, b) => b.unknownContracts.length - a.unknownContracts.length).slice(0, 15)) {
      console.log(`  Deployer ${shortAddr(c.deployer)} deployed ${c.unknownContracts.length} unclassified contracts`);
      for (const addr of c.unknownContracts.slice(0, 3)) {
        console.log(`    - ${addr}`);
      }
      if (c.unknownContracts.length > 3) {
        console.log(`    ... and ${c.unknownContracts.length - 3} more`);
      }
    }
  }

  // Coverage impact
  console.log(`\n  COVERAGE IMPACT:`);
  console.log(`  High+Medium confidence adds ~${totalGasImpact.toFixed(1)}% gas coverage`);
  console.log();

  // Generate copy-pasteable registry entries for high-confidence results
  if (high.length > 0) {
    console.log("=".repeat(100));
    console.log("  COPY-PASTE REGISTRY ENTRIES (high confidence only):");
    console.log("=".repeat(100));
    console.log();

    for (const r of high.sort((a, b) => (b.gasPercent || 0) - (a.gasPercent || 0))) {
      console.log(`  '${r.address}': {`);
      console.log(`    address: '${r.address}',`);
      console.log(`    name: '${r.contractName}',`);
      console.log(`    protocol: '${r.suggestedProtocol}',`);
      console.log(`    category: '${r.suggestedCategory}',`);
      console.log(`    type: '${r.suggestedType}',`);
      console.log(`  },`);
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { days, limit, phase } = parseArgs();

  if (!process.env.CLICKHOUSE_URL) {
    console.error("Error: CLICKHOUSE_URL not set. Make sure .env is loaded.");
    process.exit(1);
  }

  const knownAddresses = Object.keys(CONTRACT_REGISTRY);

  console.log(`\nAuto-Classify: ${days}d window, top ${limit} unclassified, ${knownAddresses.length} known contracts`);
  console.log(`Phases to run: ${phase ? `Phase ${phase} only` : "All (1 → 2 → 3)"}\n`);

  // Fetch unclassified + total gas
  console.log("Querying ClickHouse for unclassified addresses...");
  const [unknowns, chainStats] = await Promise.all([
    getTopUnknownContracts(knownAddresses, days, limit),
    getTotalChainGas(days),
  ]);
  const totalGas = chainStats.totalGas;

  // Build address → gas map
  const unknownsMap = new Map<string, number>();
  for (const u of unknowns) {
    unknownsMap.set(u.address, u.totalGas);
  }

  console.log(`Found ${unknowns.length} unclassified addresses, total chain gas: ${totalGas.toLocaleString()}`);

  let allClassified: ClassifiedResult[] = [];
  let clusters: DeployerCluster[] = [];
  let remaining = unknowns.map((u) => u.address);
  let phase1Count = 0;
  let phase2Count = 0;
  let phase3Count = 0;

  // Phase 1
  if (!phase || phase === 1) {
    const p1 = await runPhase1(unknowns, totalGas);
    allClassified.push(...p1.classified);
    remaining = p1.remaining;
    phase1Count = p1.classified.filter((c) => c.confidence !== "low").length;
  }

  // Phase 2
  if (!phase || phase === 2) {
    const p2 = await runPhase2(remaining, totalGas, unknownsMap);
    allClassified.push(...p2.classified);
    remaining = p2.remaining;
    clusters = p2.clusters;
    phase2Count = p2.classified.length;
  }

  // Phase 3
  if (!phase || phase === 3) {
    const p3 = await runPhase3(remaining, totalGas, unknownsMap);
    allClassified.push(...p3.classified);
    phase3Count = p3.classified.length;
  }

  printResults(allClassified, clusters, {
    days,
    limit,
    totalGas,
    knownCount: knownAddresses.length,
    phase1: phase1Count,
    phase2: phase2Count,
    phase3: phase3Count,
  });
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
