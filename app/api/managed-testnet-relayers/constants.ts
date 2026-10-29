// Same service as managed testnet nodes — see its constants.ts.
export let MANAGED_TESTNET_RELAYERS_SERVICE_URL =
  process.env.MANAGED_NODES_OVERRIDE || 'https://managed-nodes.avax.network';

if (MANAGED_TESTNET_RELAYERS_SERVICE_URL.endsWith('/')) {
  MANAGED_TESTNET_RELAYERS_SERVICE_URL = MANAGED_TESTNET_RELAYERS_SERVICE_URL.slice(0, -1);
}

// The admin password goes in the x-admin-password header, not the URL, so it
// stays out of request logs.
export const RelayerServiceURLs = {
  list: () =>
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers`,
  create: () =>
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers`,
  delete: (relayerId: string) =>
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers/${relayerId}`,
  restart: (relayerId: string) =>
    `${MANAGED_TESTNET_RELAYERS_SERVICE_URL}/node_admin/relayers/${relayerId}/restart`,
};

export const RELAYER_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

