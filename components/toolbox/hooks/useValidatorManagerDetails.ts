import { useVMCAddress } from "./useVMCAddress";
import { useVMCDetails } from "./useVMCDetails";
import { useChainPublicClient } from "./useChainPublicClient";

interface ValidatorManagerDetails {
    validatorManagerAddress: string;
    blockchainId: string;
    signingSubnetId: string;
    error: string | null;
    isLoading: boolean;
    contractTotalWeight: bigint;
    l1WeightError: string | null;
    isLoadingL1Weight: boolean;
    contractOwner: string | null;
    ownershipError: string | null;
    isLoadingOwnership: boolean;
    isOwnerContract: boolean;
    ownerType: 'PoAManager' | 'StakingManager' | 'EOA' | null;
    isDetectingOwnerType: boolean;
    ownershipStatus: 'loading' | 'currentWallet' | 'differentEOA' | 'contract' | 'error';
    refetchOwnership: () => void;
}

interface UseValidatorManagerDetailsProps {
    subnetId: string;
}

/**
 * @deprecated Prefer using `useVMCAddress` and `useVMCDetails` directly for
 * more granular control. This hook is kept for backward compatibility and
 * composes both focused hooks.
 */
export function useValidatorManagerDetails({ subnetId }: UseValidatorManagerDetailsProps): ValidatorManagerDetails {
    const chainPublicClient = useChainPublicClient();
    const { validatorManagerAddress, blockchainId, signingSubnetId, isLoading, error } = useVMCAddress(subnetId);
    const {
        contractTotalWeight,
        l1WeightError,
        isLoadingL1Weight,
        contractOwner,
        ownershipError,
        isLoadingOwnership,
        isOwnerContract,
        ownerType,
        isDetectingOwnerType,
        ownershipStatus,
        refetchOwnership,
    } = useVMCDetails(validatorManagerAddress || null, chainPublicClient);

    return {
        validatorManagerAddress,
        blockchainId,
        signingSubnetId,
        error,
        isLoading,
        contractTotalWeight,
        l1WeightError,
        isLoadingL1Weight,
        contractOwner,
        ownershipError,
        isLoadingOwnership,
        isOwnerContract,
        ownerType,
        isDetectingOwnerType,
        ownershipStatus,
        refetchOwnership,
    };
}
