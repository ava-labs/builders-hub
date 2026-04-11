import { useState, useEffect, useMemo, useCallback } from 'react';
import { type PublicClient } from 'viem';
import { useWalletStore } from '../stores/walletStore';
import { useValidatorManager } from './contracts/core/useValidatorManager';
import { usePoAManager } from './contracts/governance/usePoAManager';

interface VMCDetailsResult {
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

/**
 * Hook B: Reads on-chain details from the Validator Manager Contract:
 * - L1 total weight
 * - Contract owner address + whether it's an EOA or contract
 * - Owner type detection (PoAManager vs StakingManager)
 *
 * Steps 2 and 3 (weight + owner) run in parallel via Promise.all.
 */
export function useVMCDetails(
  validatorManagerAddress: string | null,
  chainPublicClient: PublicClient | null,
): VMCDetailsResult {
  const { walletEVMAddress } = useWalletStore();

  const [contractTotalWeight, setContractTotalWeight] = useState<bigint>(0n);
  const [l1WeightError, setL1WeightError] = useState<string | null>(null);
  const [isLoadingL1Weight, setIsLoadingL1Weight] = useState(false);

  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [isLoadingOwnership, setIsLoadingOwnership] = useState(false);
  const [isOwnerContract, setIsOwnerContract] = useState(false);

  const [ownerType, setOwnerType] = useState<'PoAManager' | 'StakingManager' | 'EOA' | null>(null);
  const [isDetectingOwnerType, setIsDetectingOwnerType] = useState(false);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const validatorManager = useValidatorManager(validatorManagerAddress || null);
  const poaManager = usePoAManager(contractOwner);

  // Fetch L1 total weight + contract owner in parallel
  useEffect(() => {
    let cancelled = false;

    const fetchWeightAndOwner = async () => {
      if (!chainPublicClient || !validatorManagerAddress) {
        if (!cancelled) {
          setContractTotalWeight(0n);
          setL1WeightError(null);
          setIsLoadingL1Weight(false);
          setContractOwner(null);
          setOwnershipError(null);
          setIsLoadingOwnership(false);
          setIsOwnerContract(false);
          setOwnerType(null);
          setIsDetectingOwnerType(false);
        }
        return;
      }

      if (!validatorManager.isReadReady) {
        return;
      }

      if (!cancelled) {
        setIsLoadingL1Weight(true);
        setL1WeightError(null);
        setIsLoadingOwnership(true);
        setOwnershipError(null);
        setIsOwnerContract(false);
        setOwnerType(null);
      }

      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setContractOwner(null);
          setOwnershipError('Ownership check timed out.');
          setIsOwnerContract(false);
          setIsLoadingOwnership(false);
        }
      }, 15000);

      // Run weight and owner fetches in parallel
      const weightPromise = (async () => {
        try {
          const totalWeight = await validatorManager.l1TotalWeight();
          if (!cancelled) {
            setContractTotalWeight(totalWeight);
            if (totalWeight === 0n) {
              setL1WeightError(
                'VMC potentially uninitialized: L1 Total Weight is 0. Please verify the Validator Manager Contract setup.',
              );
            } else {
              setL1WeightError(null);
            }
          }
        } catch (e: any) {
          if (!cancelled) {
            setContractTotalWeight(0n);
            if (
              e.message?.includes('returned no data ("0x")') ||
              e.message?.includes('The contract function "l1TotalWeight" returned no data')
            ) {
              setL1WeightError('Validator Manager contract weight is 0, is the contract initialized?');
            } else if (e.message?.includes('address is not a contract')) {
              setL1WeightError(
                'VMC Address Error: The provided address is not a contract. Please check the VMC address.',
              );
            } else {
              setL1WeightError('Failed to load L1 weight data from contract. Check network or VMC address.');
            }
          }
        } finally {
          if (!cancelled) {
            setIsLoadingL1Weight(false);
          }
        }
      })();

      const ownerPromise = (async () => {
        try {
          const owner = (await validatorManager.owner()) as `0x${string}`;
          clearTimeout(timeoutId);

          if (!cancelled) {
            setContractOwner(owner);
          }

          // Check if the owner is a contract by checking if it has bytecode
          if (owner) {
            try {
              const bytecode = await chainPublicClient!.getBytecode({ address: owner });
              const isContract = !!bytecode && bytecode !== '0x';
              if (!cancelled) {
                setIsOwnerContract(isContract);
                if (!isContract) {
                  setOwnerType('EOA');
                }
              }
            } catch {
              if (!cancelled) {
                setIsOwnerContract(false);
                setOwnerType('EOA');
              }
            }
          }
        } catch (e: any) {
          if (!cancelled) {
            setContractOwner(null);
            setOwnershipError(e.message || 'Failed to fetch contract owner information.');
            setIsOwnerContract(false);
          }
        } finally {
          clearTimeout(timeoutId);
          if (!cancelled) {
            setIsLoadingOwnership(false);
          }
        }
      })();

      await Promise.all([weightPromise, ownerPromise]);
    };

    fetchWeightAndOwner();
    return () => {
      cancelled = true;
    };
  }, [validatorManagerAddress, chainPublicClient, validatorManager.isReadReady, refetchCounter]);

  // Detect owner contract type when owner is a contract
  useEffect(() => {
    let cancelled = false;

    const detectOwnerType = async () => {
      if (!isOwnerContract || !contractOwner || !chainPublicClient) {
        if (!cancelled) {
          setIsDetectingOwnerType(false);
        }
        return;
      }

      if (!cancelled) {
        setIsDetectingOwnerType(true);
      }

      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setOwnerType('StakingManager');
          setIsDetectingOwnerType(false);
        }
      }, 10000);

      try {
        // Try getStakingManagerSettings() first — this is unique to StakingManager
        // and does NOT exist on PoAManager, making it a reliable discriminator.
        await chainPublicClient.readContract({
          address: contractOwner as `0x${string}`,
          abi: [
            {
              name: 'getStakingManagerSettings',
              type: 'function',
              inputs: [],
              outputs: [
                {
                  name: '',
                  type: 'tuple',
                  components: [
                    { name: 'manager', type: 'address' },
                    { name: 'minimumStakeAmount', type: 'uint256' },
                    { name: 'maximumStakeAmount', type: 'uint256' },
                    { name: 'minimumStakeDuration', type: 'uint64' },
                    { name: 'minimumDelegationFeeBips', type: 'uint16' },
                    { name: 'maximumStakeMultiplier', type: 'uint8' },
                    { name: 'weightToValueFactor', type: 'uint256' },
                    { name: 'rewardCalculator', type: 'address' },
                    { name: 'uptimeBlockchainID', type: 'bytes32' },
                  ],
                },
              ],
              stateMutability: 'view',
            },
          ],
          functionName: 'getStakingManagerSettings',
        });
        clearTimeout(timeoutId);

        if (!cancelled) {
          setOwnerType('StakingManager');
        }
      } catch {
        // getStakingManagerSettings() failed — not a StakingManager.
        // Try owner() via PoAManager hook to confirm it's a PoAManager.
        try {
          if (poaManager.isReadReady) {
            const ownerAddress = await poaManager.owner();
            clearTimeout(timeoutId);
            if (!cancelled) {
              setOwnerType(ownerAddress ? 'PoAManager' : 'StakingManager');
            }
          } else if (!cancelled) {
            setOwnerType('StakingManager');
          }
        } catch {
          if (!cancelled) {
            setOwnerType('StakingManager');
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setIsDetectingOwnerType(false);
        }
      }
    };

    detectOwnerType();
    return () => {
      cancelled = true;
    };
  }, [isOwnerContract, contractOwner, chainPublicClient, poaManager.isReadReady]);

  const refetchOwnership = useCallback(() => {
    setRefetchCounter((c) => c + 1);
  }, []);

  const ownershipStatus = useMemo(() => {
    if (isLoadingOwnership) return 'loading' as const;
    if (ownershipError) return 'error' as const;
    if (isOwnerContract) return 'contract' as const;
    if (contractOwner && walletEVMAddress) {
      return walletEVMAddress.toLowerCase() === contractOwner.toLowerCase()
        ? ('currentWallet' as const)
        : ('differentEOA' as const);
    }
    if (!isLoadingOwnership && validatorManagerAddress && !contractOwner) return 'error' as const;
    return 'loading' as const;
  }, [isLoadingOwnership, ownershipError, isOwnerContract, contractOwner, walletEVMAddress, validatorManagerAddress]);

  return {
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
