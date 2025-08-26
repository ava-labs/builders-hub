export const BUILDER_HUB_BASE_URL = 'https://multinode-experimental.solokhin.com';

// Managed Testnet Nodes service endpoints
export const ManagedTestnetNodesServiceURLs = {
  addNode: (subnetId: string, password: string) => 
    `${BUILDER_HUB_BASE_URL}/node_admin/subnets/add/${subnetId}?password=${password}`,
  
  deleteNode: (subnetId: string, nodeIndex: number, password: string) =>
    `${BUILDER_HUB_BASE_URL}/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${password}`,
  
  rpcEndpoint: (blockchainId: string) =>
    `${BUILDER_HUB_BASE_URL}/ext/bc/${blockchainId}/rpc`
};
