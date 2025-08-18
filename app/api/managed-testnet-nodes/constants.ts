export const BUILDER_HUB_BASE_URL = 'https://multinode-experimental.solokhin.com';

// Helper function to build Builder Hub URLs
export const builderHubUrls = {
  addNode: (subnetId: string, password: string) => 
    `${BUILDER_HUB_BASE_URL}/node_admin/subnets/add/${subnetId}?password=${password}`,
  
  nodeStatus: (subnetId: string, password: string) =>
    `${BUILDER_HUB_BASE_URL}/node_admin/subnets/status/${subnetId}?password=${password}`,
  
  deleteNode: (subnetId: string, nodeIndex: number, password: string) =>
    `${BUILDER_HUB_BASE_URL}/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${password}`,
  
  rpcEndpoint: (blockchainId: string) =>
    `${BUILDER_HUB_BASE_URL}/ext/bc/${blockchainId}/rpc`
};
