
export const MANAGED_TESTNET_NODES_SERVICE_URL = 'https://multinode-experimental.solokhin.com';


// Managed Testnet Nodes service endpoints
export const ManagedTestnetNodesServiceURLs = {
  addNode: (subnetId: string, password: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/add/${subnetId}?password=${password}`,

  deleteNode: (subnetId: string, nodeIndex: number, password: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${password}`,

  rpcEndpoint: (blockchainId: string) =>
    `${MANAGED_TESTNET_NODES_SERVICE_URL}/ext/bc/${blockchainId}/rpc`
};
