export interface NodeInfo {
  nodeIndex: number;
  nodeInfo: {
    result: {
      nodeID: string;
      nodePOP: {
        publicKey: string;
        proofOfPossession: string;
      };
    };
  };
  dateCreated: number;
  expiresAt: number;
}

export interface SubnetStatusResponse {
  subnetId: string;
  nodes: NodeInfo[];
  error?: string;
  message?: string;
}

export interface CreateNodeRequest {
  subnetId: string;
  blockchainId: string;
}


