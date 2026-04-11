import PoAManagerAbi from '@/contracts/icm-contracts/compiled/PoAManager.json';
import { useContractActions } from '../useContractActions';
import { PChainOwner, ValidatorData } from '../core/useValidatorManager';

export interface PoAManagerHook {
  // Read functions
  owner: () => Promise<string>;
  getValidator: (validationID: string) => Promise<ValidatorData>;

  // Write functions - PoA specific
  completeValidatorRegistration: (messageIndex: number, accessList?: any[]) => Promise<string>;
  completeValidatorRemoval: (messageIndex: number, accessList?: any[]) => Promise<string>;
  completeValidatorWeightUpdate: (messageIndex: number, accessList?: any[]) => Promise<string>;
  initiateValidatorRegistration: (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: PChainOwner,
    disableOwner: PChainOwner,
    weight: bigint
  ) => Promise<string>;
  initiateValidatorRemoval: (validationID: string) => Promise<string>;
  initiateValidatorWeightUpdate: (validationID: string, weight: bigint) => Promise<string>;
  transferOwnership: (newOwner: string) => Promise<string>;
  transferValidatorManagerOwnership: (newOwner: string) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
  isReadReady: boolean;
}

/**
 * Hook for interacting with PoAManager contracts (Proof of Authority Manager)
 * @param contractAddress - The address of the PoAManager contract
 * @param abi - Optional custom ABI (defaults to PoAManager.json abi)
 */
export function usePoAManager(
  contractAddress: string | null,
  abi?: any
): PoAManagerHook {
  const { read, write, isReady, isReadReady } = useContractActions(
    contractAddress,
    abi ?? PoAManagerAbi.abi
  );

  return {
    // Read functions
    owner: () =>
      read('owner') as Promise<string>,
    getValidator: (validationID) =>
      read('getValidator', [validationID]) as Promise<ValidatorData>,

    // Write functions
    completeValidatorRegistration: (messageIndex, accessList?) =>
      write('completeValidatorRegistration', [messageIndex], 'Complete Validator Registration', { accessList }),

    completeValidatorRemoval: (messageIndex, accessList?) =>
      write('completeValidatorRemoval', [messageIndex], 'Complete Validator Removal', { accessList }),

    completeValidatorWeightUpdate: (messageIndex, accessList?) =>
      write('completeValidatorWeightUpdate', [messageIndex], 'Complete Validator Weight Update', { accessList }),

    initiateValidatorRegistration: (nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, weight) =>
      write('initiateValidatorRegistration', [nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, weight], 'Initiate Validator Registration (PoA)'),

    initiateValidatorRemoval: (validationID) =>
      write('initiateValidatorRemoval', [validationID], 'Initiate Validator Removal (PoA)'),

    initiateValidatorWeightUpdate: (validationID, weight) =>
      write('initiateValidatorWeightUpdate', [validationID, weight], 'Initiate Validator Weight Update (PoA)'),

    transferOwnership: (newOwner) =>
      write('transferOwnership', [newOwner], 'Transfer PoA Manager Ownership'),

    transferValidatorManagerOwnership: (newOwner) =>
      write('transferValidatorManagerOwnership', [newOwner], 'Transfer Validator Manager Ownership (via PoA)'),

    // Metadata
    contractAddress,
    isReady,
    isReadReady,
  };
}
