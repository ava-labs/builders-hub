import { useMemo } from 'react';

export function useNodeConfigHighlighting(highlightPath: string | null, configJson: string) {
    return useMemo(() => {
        if (!highlightPath || !configJson) return [];

        const lines = configJson.split('\n');
        const highlighted: number[] = [];

        // Map of highlight paths to their JSON keys
        const fieldMap: Record<string, string | string[]> = {
            'pruning': 'pruning-enabled',
            'minDelayTarget': 'min-delay-target',
            'trieCleanCache': 'trie-clean-cache',
            'trieDirtyCache': 'trie-dirty-cache',
            'trieDirtyCommitTarget': 'trie-dirty-commit-target',
            'triePrefetcherParallelism': 'trie-prefetcher-parallelism',
            'snapshotCache': 'snapshot-cache',
            'acceptedCacheSize': 'accepted-cache-size',
            'stateSyncServerTrieCache': 'state-sync-server-trie-cache',
            'commitInterval': 'commit-interval',
            'rpcGasCap': 'rpc-gas-cap',
            'rpcTxFeeCap': 'rpc-tx-fee-cap',
            'transactionHistory': 'transaction-history',
            'apiMaxBlocksPerRequest': 'api-max-blocks-per-request',
            'allowUnfinalizedQueries': 'allow-unfinalized-queries',
            'batchRequestLimit': 'batch-request-limit',
            'batchResponseMaxSize': 'batch-response-max-size',
            'skipTxIndexing': 'skip-tx-indexing',
            'stateSyncEnabled': 'state-sync-enabled',
            'preimagesEnabled': 'preimages-enabled',
            'localTxsEnabled': 'local-txs-enabled',
            'pushGossipNumValidators': 'push-gossip-num-validators',
            'pushGossipPercentStake': 'push-gossip-percent-stake',
            'continuousProfilerDir': 'continuous-profiler-dir',
            'continuousProfilerFrequency': 'continuous-profiler-frequency',
            'logLevel': 'log-level',
            'warpApi': 'warp-api-enabled',
            'ethApis': 'eth-apis',
            'adminApi': 'admin-api-enabled',
            'metricsExpensive': 'metrics-expensive-enabled',
            // Additional fields that might be in config
            'apiMaxDuration': 'api-max-duration'
        };

        const fieldName = fieldMap[highlightPath];
        if (fieldName) {
            const searchKey = typeof fieldName === 'string' ? fieldName : fieldName[0];
            const idx = lines.findIndex(line => line.includes(`"${searchKey}"`));
            if (idx >= 0) {
                highlighted.push(idx + 1);

                // For arrays, highlight multiple lines
                if (searchKey === 'eth-apis') {
                    let bracketCount = 0;
                    let inArray = false;
                    for (let i = idx; i < lines.length && i < idx + 30; i++) {
                        const line = lines[i];
                        if (line.includes('[')) {
                            inArray = true;
                            bracketCount++;
                        }
                        if (inArray) {
                            highlighted.push(i + 1);
                            if (line.includes(']')) {
                                bracketCount--;
                                if (bracketCount === 0) break;
                            }
                        }
                    }
                }
            }
        }

        return [...new Set(highlighted)];
    }, [highlightPath, configJson]);
}

