'use client';

import { useState, useEffect, useMemo } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { useVMCDetails } from '@/components/toolbox/hooks/useVMCDetails';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import type { StakingManagerSettings } from '@/components/toolbox/hooks/contracts/types';
import type {
  StakingDetails,
  StakingType,
} from '@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext';

export default function ReadContractStep() {
  const [subnetIdInput, setSubnetIdInput] = useState('');
  const selectedL1 = useSelectedL1();
  const chainPublicClient = useChainPublicClient();

  // Auto-fill subnet ID from the currently selected L1 (skip primary network)
  const PRIMARY_NETWORK = '11111111111111111111111111111111LpoYY';
  useEffect(() => {
    if (selectedL1?.subnetId && selectedL1.subnetId !== PRIMARY_NETWORK && !subnetIdInput) {
      setSubnetIdInput(selectedL1.subnetId);
    }
  }, [selectedL1?.subnetId, subnetIdInput]);

  // Resolve VMC address + blockchain IDs from the subnet
  const {
    validatorManagerAddress,
    blockchainId,
    signingSubnetId,
    isLoading: isLoadingVMC,
  } = useVMCAddress(subnetIdInput);

  // Read on-chain VMC details (weight, owner, owner type)
  const {
    contractTotalWeight,
    l1WeightError,
    isLoadingL1Weight,
    contractOwner,
    ownershipError,
    isLoadingOwnership,
    ownerType,
    isDetectingOwnerType,
  } = useVMCDetails(validatorManagerAddress || null, chainPublicClient);

  // Detect staking details (type, settings, token address)
  const [stakingType, setStakingType] = useState<StakingType>(null);
  const [erc20TokenAddress, setErc20TokenAddress] = useState<string | null>(null);
  const [stakingSettings, setStakingSettings] = useState<StakingManagerSettings | null>(null);
  const [isLoadingStaking, setIsLoadingStaking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const detectStaking = async () => {
      if (!chainPublicClient || !validatorManagerAddress || ownerType !== 'StakingManager') {
        if (!cancelled) {
          setStakingType(null);
          setErc20TokenAddress(null);
          setStakingSettings(null);
          setIsLoadingStaking(false);
        }
        return;
      }

      if (!cancelled) setIsLoadingStaking(true);

      const candidates = [validatorManagerAddress, contractOwner].filter(Boolean) as string[];

      for (const addr of candidates) {
        try {
          const settings = (await chainPublicClient.readContract({
            address: addr as `0x${string}`,
            abi: NativeTokenStakingManager.abi,
            functionName: 'getStakingManagerSettings',
          })) as StakingManagerSettings;

          if (cancelled) return;
          setStakingSettings(settings);

          // Try to read erc20() — if it exists, it is an ERC20 staking manager
          try {
            const tokenAddr = await chainPublicClient.readContract({
              address: addr as `0x${string}`,
              abi: ERC20TokenStakingManager.abi,
              functionName: 'erc20',
            });
            if (!cancelled) {
              setStakingType('erc20');
              setErc20TokenAddress(tokenAddr as string);
            }
          } catch {
            if (!cancelled) {
              setStakingType('native');
              setErc20TokenAddress(null);
            }
          }
          break;
        } catch {
          // This candidate does not have getStakingManagerSettings, try next
        }
      }

      if (!cancelled) setIsLoadingStaking(false);
    };

    detectStaking();
    return () => {
      cancelled = true;
    };
  }, [chainPublicClient, validatorManagerAddress, contractOwner, ownerType]);

  const staking = useMemo<StakingDetails>(
    () => ({
      stakingType,
      erc20TokenAddress,
      settings: stakingSettings,
      isLoading: isLoadingStaking,
    }),
    [stakingType, erc20TokenAddress, stakingSettings, isLoadingStaking],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <SelectSubnetId
          value={subnetIdInput}
          onChange={setSubnetIdInput}
          hidePrimaryNetwork
          label="L1 (Subnet ID)"
          helperText="Select the L1 whose ERC20 Staking Manager you want to inspect."
        />
      </div>

      {subnetIdInput && (
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ValidatorManagerDetails
            validatorManagerAddress={validatorManagerAddress || null}
            blockchainId={blockchainId || null}
            subnetId={subnetIdInput}
            isLoading={isLoadingVMC}
            signingSubnetId={signingSubnetId}
            contractTotalWeight={contractTotalWeight}
            l1WeightError={l1WeightError}
            isLoadingL1Weight={isLoadingL1Weight}
            contractOwner={contractOwner}
            ownershipError={ownershipError}
            isLoadingOwnership={isLoadingOwnership}
            ownerType={ownerType}
            isDetectingOwnerType={isDetectingOwnerType}
            staking={staking}
            isExpanded
          />
        </div>
      )}
    </div>
  );
}
