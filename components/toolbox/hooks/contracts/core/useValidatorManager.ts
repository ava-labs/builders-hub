import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { useContractActions } from '../useContractActions';
import type {
  PChainOwner,
  ValidatorRegistrationParams,
  ValidatorData,
  ValidatorSetParams,
  InitParams,
  MigrationParams,
} from '../types';

export type {
  PChainOwner,
  ValidatorRegistrationParams,
  ValidatorData,
  ValidatorSetParams,
  InitParams,
  MigrationParams,
} from '../types';

export interface ValidatorManagerHook {
  // Read functions
  getValidator: (validationID: string) => Promise<ValidatorData>;
  owner: () => Promise<string>;
  l1TotalWeight: () => Promise<bigint>;
  subnetID: () => Promise<string>;
  isValidatorSetInitialized: () => Promise<boolean>;
  getNodeValidationID: (nodeID: string) => Promise<string>;

  // Write functions
  initiateValidatorRegistration: (params: ValidatorRegistrationParams) => Promise<string>;
  completeValidatorRegistration: (index: number, accessList?: any[]) => Promise<string>;
  resendRegisterValidatorMessage: (validationID: string) => Promise<string>;
  initiateValidatorRemoval: (validationID: string) => Promise<string>;
  completeValidatorRemoval: (index: number, accessList?: any[]) => Promise<string>;
  resendValidatorRemovalMessage: (validationID: string) => Promise<string>;
  initiateValidatorWeightUpdate: (validationID: string, weight: bigint) => Promise<string>;
  completeValidatorWeightUpdate: (index: number, accessList?: any[]) => Promise<string>;
  initializeValidatorSet: (params: ValidatorSetParams, messageIndex: number, accessList?: any[]) => Promise<string>;
  initialize: (params: InitParams) => Promise<string>;
  transferOwnership: (newOwner: string) => Promise<string>;
  migrateFromV1: (params: MigrationParams) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
  isReadReady: boolean;
}

/**
 * Hook for interacting with ValidatorManager contracts
 * @param contractAddress - The address of the ValidatorManager contract
 * @param abi - Optional custom ABI (defaults to ValidatorManager.json abi)
 */
export function useValidatorManager(
  contractAddress: string | null,
  abi?: any
): ValidatorManagerHook {
  const { read, write, isReady, isReadReady } = useContractActions(
    contractAddress,
    abi ?? ValidatorManagerAbi.abi
  );

  return {
    // Read functions
    getValidator: (validationID) =>
      read('getValidator', [validationID]) as Promise<ValidatorData>,
    owner: () =>
      read('owner') as Promise<string>,
    l1TotalWeight: () =>
      read('l1TotalWeight') as Promise<bigint>,
    subnetID: () =>
      read('subnetID') as Promise<string>,
    isValidatorSetInitialized: () =>
      read('isValidatorSetInitialized') as Promise<boolean>,
    getNodeValidationID: (nodeID) =>
      read('getNodeValidationID', [nodeID]) as Promise<string>,

    // Write functions
    initiateValidatorRegistration: (params) =>
      write('initiateValidatorRegistration', [
        params.nodeID,
        params.blsPublicKey,
        params.remainingBalanceOwner,
        params.disableOwner,
        params.weight,
      ], 'Initiate Validator Registration'),

    completeValidatorRegistration: (index, accessList?) =>
      write('completeValidatorRegistration', [index], 'Complete Validator Registration', { accessList }),

    resendRegisterValidatorMessage: (validationID) =>
      write('resendRegisterValidatorMessage', [validationID], 'Resend Register Validator Message'),

    initiateValidatorRemoval: (validationID) =>
      write('initiateValidatorRemoval', [validationID], 'Initiate Validator Removal'),

    completeValidatorRemoval: (index, accessList?) =>
      write('completeValidatorRemoval', [index], 'Complete Validator Removal', { accessList }),

    resendValidatorRemovalMessage: (validationID) =>
      write('resendValidatorRemovalMessage', [validationID], 'Resend Validator Removal Message'),

    initiateValidatorWeightUpdate: (validationID, weight) =>
      write('initiateValidatorWeightUpdate', [validationID, weight], 'Initiate Validator Weight Update'),

    completeValidatorWeightUpdate: (index, accessList?) =>
      write('completeValidatorWeightUpdate', [index], 'Complete Validator Weight Update', { accessList }),

    initializeValidatorSet: (params, messageIndex, accessList?) =>
      write('initializeValidatorSet', [params, messageIndex], 'Initialize Validator Set', {
        gas: BigInt(2_000_000),
        accessList,
      }),

    initialize: (params) =>
      write('initialize', [params.settings], 'Initialize Validator Manager'),

    transferOwnership: (newOwner) =>
      write('transferOwnership', [newOwner], 'Transfer Validator Manager Ownership'),

    migrateFromV1: (params) =>
      write('migrateFromV1', [params.validationID as `0x${string}`, params.receivedNonce], 'Migrate From V1'),

    // Metadata
    contractAddress,
    isReady,
    isReadReady,
  };
}
