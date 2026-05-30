
export let MANAGED_TESTNET_NODES_SERVICE_URL = process.env.MANAGED_NODES_OVERRIDE ||
  (process.env.VERCEL_ENV === "production"
    ? 'https://nodes-prod.18.182.4.86.sslip.io'
    : 'https://nodes-staging.35.74.237.34.sslip.io');

if (MANAGED_TESTNET_NODES_SERVICE_URL.endsWith('/')) {
  MANAGED_TESTNET_NODES_SERVICE_URL = MANAGED_TESTNET_NODES_SERVICE_URL.slice(0, -1);
}

// Managed Testnet Nodes service endpoints
export const ManagedTestnetNodesServiceURLs = {
  // blockchainId/chainName are persisted on the slot's assignment so the
  // firn-explorer tenant directory (`/explorer/tenants`) can resolve
  // `<slug>.firn.gg` immediately, instead of waiting for a lazy back-fill on
  // the first /firn/* proxy hit. Without these, the wildcard host falls
  // through to the apex network switcher and the user sees the default
  // chains rather than their L1's explorer.
  addNode: (subnetId: string, password: string, blockchainId: string, chainName: string | null) => {
    const params = new URLSearchParams({ password, blockchainId });
    if (chainName) params.set('chainName', chainName);
    return `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/add/${subnetId}?${params.toString()}`;
  },

  deleteNode: (subnetId: string, nodeIndex: number, password: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${password}`,

  rpcEndpoint: (blockchainId: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/ext/bc/${blockchainId}/rpc`
};
