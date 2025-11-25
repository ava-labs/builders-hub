// Reuse the same base URLs as managed testnet nodes
export let MANAGED_TESTNET_RELAYERS_SERVICE_URL = process.env.MANAGED_NODES_OVERRIDE ||
  (process.env.VERCEL_ENV === "production"
    ? 'https://nodes-prod.18.182.4.86.sslip.io'
    : 'https://nodes-staging.35.74.237.34.sslip.io');

if (MANAGED_TESTNET_RELAYERS_SERVICE_URL.endsWith('/')) {
  MANAGED_TESTNET_RELAYERS_SERVICE_URL = MANAGED_TESTNET_RELAYERS_SERVICE_URL.slice(0, -1);
}

export const RelayerServiceURLs = {
  list: (password: string) => 
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers?password=${password}`,
  create: (password: string) => 
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers?password=${password}`,
  delete: (relayerId: string, password: string) => 
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers/${relayerId}?password=${password}`,
  restart: (relayerId: string, password: string) => 
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers/${relayerId}/restart?password=${password}`,
};

export const RELAYER_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

