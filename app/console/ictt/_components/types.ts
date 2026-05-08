/**
 * Shared types for the ICTT Bridge Console.
 *
 * The bridge is modeled as a spatial object with two chains (home/remote)
 * linked by ICM. Each phase represents a step in constructing or operating
 * the bridge. Phase status is derived from on-chain contract state plus
 * local indexer reads.
 */
export type PhaseId = 'token' | 'home' | 'remote' | 'register' | 'collateral' | 'transfer';

export type PhaseStatus = 'idle' | 'active' | 'done' | 'blocked';

export type ContractStatus = 'idle' | 'pending' | 'deployed';

export type TokenKind = 'erc20' | 'native';

export interface PhaseDescriptor {
  id: PhaseId;
  label: string;
  description: string;
}

export const PHASES: PhaseDescriptor[] = [
  { id: 'token', label: 'Token', description: 'Pick or deploy the home asset' },
  { id: 'home', label: 'Home', description: 'Deploy TokenHome on origin chain' },
  { id: 'remote', label: 'Remote', description: 'Deploy TokenRemote on destination' },
  { id: 'register', label: 'Register', description: 'Pair Remote ↔ Home over ICM' },
  { id: 'collateral', label: 'Collateral', description: 'Fund the bridge' },
  { id: 'transfer', label: 'Live', description: 'Send tokens across' },
];

export interface ContractSlot {
  label: string;
  address: string | null;
  status: ContractStatus;
}

export interface ActivityEvent {
  id: string;
  kind: 'deploy' | 'register' | 'send' | 'collateral' | 'error';
  label: string;
  amount?: string;
  timestamp: number;
  txHash?: string;
  chainId?: number;
}
