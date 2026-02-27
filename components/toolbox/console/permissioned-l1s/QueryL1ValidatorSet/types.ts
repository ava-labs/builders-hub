export interface ValidatorResponse {
  validationId: string;
  nodeId: string;
  subnetId: string;
  weight: number;
  remainingBalance: string;
  creationTimestamp: number;
  remainingBalanceOwner?: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner?: {
    addresses: string[];
    threshold: number;
  };
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatStake(stake: string): string {
  const stakeNum = parseFloat(stake);
  if (isNaN(stakeNum)) return stake;
  return stakeNum.toLocaleString();
}
