import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";
import { type ActiveValidatorDetails } from '@avalanche-sdk/chainkit/models/components/activevalidatordetails.js';
import { type Subnet } from '@avalanche-sdk/chainkit/models/components/subnet.js';
import { type SimpleValidator, type ValidatorVersion, type SubnetStats } from '@/types/validator-stats';
import { MAINNET_VALIDATOR_DISCOVERY_URL, FUJI_VALIDATOR_DISCOVERY_URL } from '@/constants/validator-discovery';
import l1ChainsData from "@/constants/l1-chains.json";

// Cache TTL constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (matches HTTP Cache-Control)
const VERSION_CACHE_DURATION = 60 * 1000; // 1 minute for validator versions
const PAGE_SIZE = 100;
const FETCH_TIMEOUT = 10000; // 10 seconds timeout for fetch requests

// Cache storage with timestamps
const validatorsCached: Partial<Record<string, { data: SimpleValidator[]; timestamp: number; promise?: Promise<SimpleValidator[]> }>> = {};
const subnetsCached: Partial<Record<string, { data: Subnet[]; timestamp: number; promise?: Promise<Subnet[]> }>> = {};
const validatorVersionsCached: Partial<Record<string, { data: Map<string, string>; timestamp: number }>> = {};

async function listClassicValidators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
    const avalancheSDK = new Avalanche({
        network
    });

    const validators: SimpleValidator[] = [];
    const result = await avalancheSDK.data.primaryNetwork.listValidators({
        pageSize: PAGE_SIZE,
        network,
        validationStatus: "active",
    });

    for await (const page of result) {
        const activeValidators = page.result.validators as ActiveValidatorDetails[];
        validators.push(...activeValidators.map(v => ({
            nodeId: v.nodeId,
            subnetId: v.subnetId,
            weight: Number(v.amountStaked)
        })));
    }

    console.log(`[${network}] Fetched ${validators.length} classic validators`);
    return validators;
}

async function listL1Validators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
    const avalancheSDK = new Avalanche({
        network
    });

    const validators: SimpleValidator[] = [];
    const result = await avalancheSDK.data.primaryNetwork.listL1Validators({
        pageSize: PAGE_SIZE,
        includeInactiveL1Validators: false,
        network,
    });

    for await (const page of result) {
        validators.push(...page.result.validators
            .filter(v => v.remainingBalance > 0)
            .map(v => ({
                nodeId: v.nodeId,
                subnetId: v.subnetId,
                weight: v.weight
            })));
    }

    console.log(`[${network}] Fetched ${validators.length} L1 validators`);
    return validators;
}

async function getAllValidators(network: "mainnet" | "fuji"): Promise<SimpleValidator[]> {
    const now = Date.now();
    const cache = validatorsCached[network];

    // Return cached data if still valid
    if (cache && (now - cache.timestamp) < CACHE_DURATION) {
        console.log(`[${network}] Using cached validators (age: ${Math.round((now - cache.timestamp) / 1000)}s)`);
        return cache.data;
    }

    // If a fetch is already in progress, wait for it
    if (cache?.promise) {
        console.log(`[${network}] Validators fetch already in progress, waiting...`);
        return cache.promise;
    }

    // Start new fetch
    const promise = (async () => {
        console.log(`[${network}] Fetching fresh validators...`);
        const [l1Validators, classicValidators] = await Promise.all([
            listL1Validators(network),
            listClassicValidators(network)
        ]);

        const allValidators = [...l1Validators, ...classicValidators];
        console.log(`[${network}] Total validators: ${allValidators.length}`);
        
        // Store in cache with timestamp
        validatorsCached[network] = {
            data: allValidators,
            timestamp: Date.now(),
        };
        
        return allValidators;
    })();

    // Store promise to prevent duplicate requests
    validatorsCached[network] = {
        data: cache?.data || [],
        timestamp: cache?.timestamp || 0,
        promise,
    };

    promise.catch(async (error) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        console.error(`Error fetching validators for ${network}: ${error}`);
        // Clear the promise on error but keep old data if available
        if (validatorsCached[network]?.promise === promise) {
            delete validatorsCached[network]?.promise;
        }
    });

    return promise;
}

async function getAllSubnets(network: "mainnet" | "fuji"): Promise<Subnet[]> {
    const now = Date.now();
    const cache = subnetsCached[network];

    // Return cached data if still valid
    if (cache && (now - cache.timestamp) < CACHE_DURATION) {
        console.log(`[${network}] Using cached subnets (age: ${Math.round((now - cache.timestamp) / 1000)}s)`);
        return cache.data;
    }

    // If a fetch is already in progress, wait for it
    if (cache?.promise) {
        console.log(`[${network}] Subnets fetch already in progress, waiting...`);
        return cache.promise;
    }

    // Start new fetch
    const promise = (async () => {
        console.log(`[${network}] Fetching fresh subnets...`);

        const avalancheSDK = new Avalanche({
            network,
        });

        const allSubnets: Subnet[] = [];
        const result = await avalancheSDK.data.primaryNetwork.listSubnets({
            pageSize: PAGE_SIZE,
            network,
        });

        for await (const page of result) {
            allSubnets.push(...page.result.subnets);
            console.log(`[${network}] Fetched ${allSubnets.length} subnets so far...`);
        }

        console.log(`[${network}] Total subnets: ${allSubnets.length}`);
        
        // Store in cache with timestamp
        subnetsCached[network] = {
            data: allSubnets,
            timestamp: Date.now(),
        };
        
        return allSubnets;
    })();

    // Store promise to prevent duplicate requests
    subnetsCached[network] = {
        data: cache?.data || [],
        timestamp: cache?.timestamp || 0,
        promise,
    };

    promise.catch(async (error) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        console.error(`Error fetching subnets for ${network}: ${error}`);
        // Clear the promise on error but keep old data if available
        if (subnetsCached[network]?.promise === promise) {
            delete subnetsCached[network]?.promise;
        }
    });

    return promise;
}

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
}

async function getValidatorVersions(network: "mainnet" | "fuji"): Promise<Map<string, string>> {
    const now = Date.now();
    const cacheKey = network;
    const cache = validatorVersionsCached[cacheKey];

    // Check if cache exists and is less than 1 minute old
    if (cache && (now - cache.timestamp) < VERSION_CACHE_DURATION) {
        console.log(`[${network}] Using cached validator versions (age: ${Math.round((now - cache.timestamp) / 1000)}s)`);
        return cache.data;
    }

    console.log(`[${network}] Fetching fresh validator versions...`);
    const url = network === "mainnet" 
        ? MAINNET_VALIDATOR_DISCOVERY_URL 
        : FUJI_VALIDATOR_DISCOVERY_URL;
    
    try {
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch validator versions: ${response.status} ${response.statusText}`);
        }

        const data: ValidatorVersion[] = await response.json();
        const versionMap = new Map<string, string>();

        for (const validator of data) {
            // Use "Unknown" if version is empty
            versionMap.set(validator.nodeId, validator.version || "Unknown");
        }

        // Update cache
        validatorVersionsCached[cacheKey] = {
            data: versionMap,
            timestamp: now
        };

        console.log(`[${network}] Fetched ${versionMap.size} validator versions`);
        return versionMap;
    } catch (error: any) {
        console.error(`[${network}] Error fetching validator versions:`, error.message);
        // Return cached data if available, even if stale, rather than failing completely
        if (cache) {
            console.log(`[${network}] Returning stale cached validator versions due to fetch error`);
            return cache.data;
        }
        // If no cache, return empty map rather than failing
        console.warn(`[${network}] No cached validator versions available, returning empty map`);
        return new Map<string, string>();
    }
}

async function getNetworkStats(network: "mainnet" | "fuji"): Promise<SubnetStats[]> {
    const [validators, subnets, versionMap] = await Promise.all([
        getAllValidators(network),
        getAllSubnets(network),
        getValidatorVersions(network)
    ]);
    console.log(`[${network}] Validators: ${validators.length}, Subnets: ${subnets.length}, Version data: ${versionMap.size}`);

    const subnetAccumulators: Record<string, {
        name: string;
        id: string;
        totalStake: bigint;
        byClientVersion: Record<string, { stake: bigint; nodes: number }>;
        isL1: boolean;
    }> = {};

    // Create a map of subnetId to isL1 from subnets
    const subnetIsL1Map = new Map<string, boolean>();
    for (const subnet of subnets) {
        subnetIsL1Map.set(subnet.subnetId, subnet.isL1);
        if (subnetAccumulators[subnet.subnetId]) {
            throw new Error(`Subnet ${subnet.subnetId} already exists, this should not happen`);
        }
        subnetAccumulators[subnet.subnetId] = {
            name: subnet.blockchains.map(blockchain => blockchain.blockchainName).join('/'),
            id: subnet.subnetId,
            byClientVersion: {},
            totalStake: 0n,
            isL1: subnet.isL1,
        }
    }

    for (const validator of validators) {
        const subnetId = validator.subnetId;

        // Create accumulator for unknown subnets
        if (!subnetAccumulators[subnetId]) {
            subnetAccumulators[subnetId] = {
                name: `Unknown (${subnetId})`,
                id: subnetId,
                byClientVersion: {},
                totalStake: 0n,
                isL1: subnetIsL1Map.get(subnetId) || false,
            };
        }

        const stake = BigInt(validator.weight);
        subnetAccumulators[subnetId].totalStake += stake;

        const version = versionMap.get(validator.nodeId)?.replace("avalanchego/", "") || "Unknown";

        if (!subnetAccumulators[subnetId].byClientVersion[version]) {
            subnetAccumulators[subnetId].byClientVersion[version] = {
                stake: 0n,
                nodes: 0
            };
        }
        subnetAccumulators[subnetId].byClientVersion[version].stake += stake;
        subnetAccumulators[subnetId].byClientVersion[version].nodes += 1;
    }

    // Create maps of subnetId to chainLogoURI and chainName from l1-chains.json
    const subnetLogoMap = new Map<string, string>();
    const subnetNameMap = new Map<string, string>();
    l1ChainsData.forEach((chain: any) => {
        if (chain.subnetId) {
            if (chain.chainLogoURI) {
                subnetLogoMap.set(chain.subnetId, chain.chainLogoURI);
            }
            if (chain.chainName) {
                subnetNameMap.set(chain.subnetId, chain.chainName);
            }
        }
    });

    const result: SubnetStats[] = [];
    for (const subnet of Object.values(subnetAccumulators)) {
        if (subnet.totalStake === 0n) continue;

        const byClientVersion: Record<string, { stakeString: string; nodes: number }> = {};
        for (const [version, data] of Object.entries(subnet.byClientVersion)) {
            byClientVersion[version] = {
                stakeString: data.stake.toString(),
                nodes: data.nodes
            };
        }

        // Use chain name from l1-chains.json if available, otherwise use the name from subnet
        const chainName = subnetNameMap.get(subnet.id) || subnet.name;

        result.push({
            name: chainName,
            id: subnet.id,
            totalStakeString: subnet.totalStake.toString(),
            byClientVersion,
            chainLogoURI: subnetLogoMap.get(subnet.id) || undefined,
            isL1: subnet.isL1
        });
    }

    return result;
}

// Helper to add timeout to promises
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const network = searchParams.get('network');

        if (!network || (network !== 'mainnet' && network !== 'fuji')) {
            return NextResponse.json(
                { error: 'Invalid or missing network parameter. Use ?network=mainnet or ?network=fuji' },
                { status: 400 }
            );
        }

        // Add overall timeout of 25 seconds (Vercel serverless functions have 10s default, but can be extended)
        const stats = await withTimeout(
            getNetworkStats(network),
            25000,
            `Request timeout after 25 seconds for ${network}`
        );
        
        return NextResponse.json(stats, {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                'X-Network': network,
            }
        });
    } catch (error: any) {
        const { searchParams } = new URL(request.url);
        const network = searchParams.get('network') || 'unknown';
        console.error(`Error in validator-stats API (${network}):`, error);
        
        const errorMessage = error?.message || `Failed to fetch validator stats for ${network}`;
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

