export interface Validator {
  id: string;
  nodeID: string;
  blsPublicKey: string;
  blsProofOfPossession: string;
  pChainAddress: string;
  weight: string;
  uptime: string;
  validationID?: string;
  startTimestamp?: number;
  isActive?: boolean;
  isL1Validator?: boolean;
  isConnected?: boolean;
  uptimeSeconds?: number;
  uptimePercentage?: number;
}

export interface L1ValidatorManagerDetails {
  blockchainId: string;
  contractAddress: string;
}

export interface SubnetInfo {
  isL1: boolean;
  l1ValidatorManagerDetails?: L1ValidatorManagerDetails;
}
