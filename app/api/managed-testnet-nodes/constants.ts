
export let MANAGED_TESTNET_NODES_SERVICE_URL = process.env.MANAGED_NODES_OVERRIDE ||
  (process.env.VERCEL_ENV === "production"
    ? 'https://nodes-prod.18.182.4.86.sslip.io'
    : 'https://nodes-staging.35.74.237.34.sslip.io');

if (MANAGED_TESTNET_NODES_SERVICE_URL.endsWith('/')) {
  MANAGED_TESTNET_NODES_SERVICE_URL = MANAGED_TESTNET_NODES_SERVICE_URL.slice(0, -1);
}

// Managed Testnet Nodes service endpoints
export const ManagedTestnetNodesServiceURLs = {
  addNode: (subnetId: string, password: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/add/${subnetId}?password=${password}`,

  deleteNode: (subnetId: string, nodeIndex: number, password: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${password}`,

  rpcEndpoint: (blockchainId: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/ext/bc/${blockchainId}/rpc`
};
