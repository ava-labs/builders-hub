import { useEffect, useState } from "react";

export function ChainInfo({ rpcUrl, subnetID, chainID }: { rpcUrl: string, subnetID: string, chainID: string }) {
    const [chainInfo, setChainInfo] = useState<benchmarkChainInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getChainInfo(rpcUrl, subnetID, chainID).then(setChainInfo).catch(err => setError(err instanceof Error ? err.message : String(err)));
    }, [rpcUrl, subnetID, chainID]);

    return <div>
        {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded">
                <strong>Error:</strong> {error}
            </div>
        )}
        {chainInfo && (
            <div className="mb-4 p-3.">
                <div>
                    Max gas {(chainInfo.gasLimit / 1_000_000).toFixed(1)}M per block.
                    {' '}{chainInfo.peers.length} validators online: {chainInfo.peerFlags.join(' ')}
                </div>
            </div>
        )}
    </div>;
}

export type benchmarkChainInfo = {
    peers: string[];
    gasLimit: number;
    peerFlags: string[];
}

const countryFlagCache = new Map<string, Promise<string>>();
async function getCountryFlag(ip: string): Promise<string> {
    if (countryFlagCache.has(ip)) {
        return countryFlagCache.get(ip)!;
    }

    const flagPromise = (async () => {
        try {
            const response = await fetch(`https://ipwho.is/${ip}`);
            const data = await response.json();
            return data.flag.emoji;
        } catch (error) {
            return '🌐';
        }
    })();

    countryFlagCache.set(ip, flagPromise);
    return flagPromise;
}

export async function getChainInfo(rpcUrl: string, subnetID: string, chainID: string): Promise<benchmarkChainInfo> {
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

    const peerIpPorts = peers.peers.filter(peer => peer.trackedSubnets.includes(subnetID)).map(peer => peer.ip);
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

async function rpcRequest<T>(rpcUrl: string, method: string, params: any[]): Promise<T> {
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
        throw new Error(data.error);
    }
    throw new Error(JSON.stringify(data));
}
