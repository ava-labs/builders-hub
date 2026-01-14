"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Users, Fuel } from "lucide-react";

export type BenchmarkChainInfo = {
    peers: string[];
    gasLimit: number;
    peerFlags: string[];
}

const countryFlagCache = new Map<string, Promise<string>>();

async function getCountryFlag(ip: string): Promise<string> {
    // Check in-memory cache first
    if (countryFlagCache.has(ip)) {
        return countryFlagCache.get(ip)!;
    }

    // Check localStorage
    const storageKey = `flag-${ip}`;
    if (typeof window !== 'undefined') {
        const storedFlag = localStorage.getItem(storageKey);
        if (storedFlag) {
            return storedFlag;
        }
    }

    const flagPromise = (async () => {
        try {
            const response = await fetch(`https://ipwho.is/${ip}`);
            const data = await response.json();
            const flag = data.flag?.emoji || '🌐';

            // Store in localStorage only on success
            if (typeof window !== 'undefined') {
                localStorage.setItem(storageKey, flag);
            }
            return flag;
        } catch {
            return '🌐';
        }
    })();

    countryFlagCache.set(ip, flagPromise);
    return flagPromise;
}

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: method, params: params, id: 1 }),
    });
    const data = await response.json();
    if ('result' in data) {
        return data.result;
    }
    if ('error' in data) {
        throw new Error(typeof data.error === 'object' ? JSON.stringify(data.error) : data.error);
    }
    throw new Error(JSON.stringify(data));
}

export async function getChainInfo(rpcUrl: string, subnetId: string, chainID: string): Promise<BenchmarkChainInfo> {
    rpcUrl = rpcUrl.replace(/^ws/, 'http').replace(/\/$/, '');

    const peers = await rpcRequest<{
        numPeers: string;
        peers: Array<{
            ip: string;
            publicIP: string;
            nodeID: string;
            version: string;
            lastSent: string;
            lastReceived: string;
            observedUptime: string;
            trackedSubnets: string[];
            supportedACPs: number[];
            objectedACPs: number[];
            benched: number[];
        }>;
    }>(rpcUrl + "/ext/info", 'info.peers', [{ nodeIDs: [] }]);

    const peerIpPorts = peers.peers.filter(peer => peer.trackedSubnets.includes(subnetId)).map(peer => peer.ip);
    const currentNodeIp = (await rpcRequest<{ ip: string }>(rpcUrl + "/ext/info", 'info.getNodeIP', [])).ip;
    peerIpPorts.push(currentNodeIp);

    const peerIps = peerIpPorts.map(peerIpPort => peerIpPort.split(':')[0]);
    const peerFlags = await Promise.all(peerIps.map(ip => getCountryFlag(ip)));

    // Get latest block from EVM chain
    const evmRpcUrl = rpcUrl + "/ext/bc/" + chainID + "/rpc";
    const blockResponse = await rpcRequest<{
        gasLimit: `0x${string}`;
    }>(evmRpcUrl, 'eth_getBlockByNumber', ['latest', true]);

    const gasLimit = parseInt(blockResponse.gasLimit, 16);

    return {
        peers: peerIps,
        gasLimit: gasLimit,
        peerFlags: peerFlags,
    }
}

interface ChainInfoProps {
    rpcUrl: string;
    subnetId: string;
    chainID: string;
}

export function ChainInfo({ rpcUrl, subnetId, chainID }: ChainInfoProps) {
    const [chainInfo, setChainInfo] = useState<BenchmarkChainInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!rpcUrl || !subnetId || !chainID) {
            setChainInfo(null);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        getChainInfo(rpcUrl, subnetId, chainID)
            .then(info => {
                setChainInfo(info);
                setIsLoading(false);
            })
            .catch(err => {
                setError(err instanceof Error ? err.message : String(err));
                setIsLoading(false);
            });
    }, [rpcUrl, subnetId, chainID]);

    if (!rpcUrl || !subnetId || !chainID) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="animate-spin h-4 w-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full"></div>
                    Loading chain info...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                        <strong>Error loading chain info:</strong> {error}
                    </div>
                </div>
            </div>
        );
    }

    if (!chainInfo) {
        return null;
    }

    return (
        <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">
                        Gas Limit: <strong>{(chainInfo.gasLimit / 1_000_000).toFixed(1)}M</strong> per block
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">
                        <strong>{chainInfo.peers.length}</strong> validators online:
                        <span className="ml-1">{chainInfo.peerFlags.join(' ')}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
