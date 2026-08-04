// Some L1s are not indexed by the shared Metrics API (metrics.avax.network) and are
// instead served by a dedicated metrics source. This mapping is the single source of
// truth shared by the chain-stats data route and the explorer indexed-status probe, so
// both agree on which chains use the dedicated source and how their ids remap
export const DEDICATED_STATS_BASE_URL = 'http://44.221.18.159';

// Maps the chainId the routes receive (from l1-chains.json) -> EVM chainId on the
// dedicated metrics source. KiteAI's route chainId is its Avalanche blockchain ID, so it
// remaps to EVM 2366; every other chain already uses its EVM id as the route chainId
export const DEDICATED_METRICS_CHAINS: Record<string, string> = {
  '3USaEfTcoUhHxpKXvpAG916UKCUEyjrtkg2hBArBG3JyDP7my': '2366', // KiteAI Mainnet
  '43114': '43114', // C-Chain
  '27827': '27827', // zeroone Mainnet L1
  '5566': '5566',   // StraitsX
  '4337': '4337',   // Beam
  '10849': '10849', // Lamina1 L1
  '7272': '7272',   // Hashfire
  '36463': '36463', // The Grotto
};

// Returns the EVM chainId on the dedicated source for a given route chainId, or
// undefined if the chain is served by the shared Metrics API
export function resolveDedicatedMetricsChain(chainId: string): string | undefined {
  return DEDICATED_METRICS_CHAINS[chainId];
}
