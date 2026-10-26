
// The OCI deployment. One service replaces the prod/staging EC2 pair, so
// previews and production share it. MANAGED_NODES_OVERRIDE still wins locally.
export let MANAGED_TESTNET_NODES_SERVICE_URL =
  process.env.MANAGED_NODES_OVERRIDE || 'https://managed-nodes.avax.network';

// Legacy EC2 box. Still serving chains created before the cutover, so the
// studio keeps probing it as a fallback candidate — see
// server/services/studio/quick-l1.ts. Remove once those chains have expired.
export const MANAGED_NODES_PRODUCTION_URL = 'https://nodes-prod.43.207.73.245.sslip.io';

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
  // The admin password goes in the x-admin-password header, not the URL, so it
  // stays out of request logs.
  addNode: (subnetId: string, blockchainId: string, chainName: string | null) => {
    const params = new URLSearchParams({ blockchainId });
    if (chainName) params.set('chainName', chainName);
    return `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/add/${subnetId}?${params.toString()}`;
  },

  deleteNode: (subnetId: string, nodeIndex: number) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/delete/${subnetId}/${nodeIndex}`,

  upgradeJson: (subnetId: string, nodeIndex: number, blockchainId: string) => {
    const params = new URLSearchParams({ blockchainId });
    return `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/${subnetId}/${nodeIndex}/upgrade-json?${params.toString()}`;
  },

  restartNode: (subnetId: string, nodeIndex: number) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/${subnetId}/${nodeIndex}/restart`,

  rpcEndpoint: (blockchainId: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/ext/bc/${blockchainId}/rpc`
};
