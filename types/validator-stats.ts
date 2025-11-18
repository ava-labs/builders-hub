export interface ValidatorVersion {
  nodeId: string;
  version: string;
  trackedSubnets: string[];
  lastAttempted: number;
  lastSeenOnline: number;
  ip: string;
}

export interface SimpleValidator {
  nodeId: string;
  subnetId: string;
  weight: number;
}

export interface SubnetStats {
  name: string;
  id: string;
  totalStakeString: string;
  byClientVersion: Record<string, { stakeString: string; nodes: number }>;
  chainLogoURI?: string;
  isL1: boolean;
}

