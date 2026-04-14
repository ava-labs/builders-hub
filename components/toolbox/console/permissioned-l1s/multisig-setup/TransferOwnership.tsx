'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { ResultField } from '@/components/toolbox/components/ResultField';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { TransactionReceipt } from 'viem';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { Alert } from '@/components/toolbox/components/Alert';
import { useValidatorManager } from '@/components/toolbox/hooks/contracts';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';

const metadata: ConsoleToolMetadata = {
  title: 'Transfer Validator Manager Ownership',
  description: 'Transfer the ownership of the Validator Manager to a new address (EOA, StakingManager, or PoAManager)',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

export interface TransferOwnershipProps extends BaseConsoleToolProps {
  defaultNewOwnerAddress?: string;
}

function TransferOwnership({ onSuccess: _onSuccess, defaultNewOwnerAddress }: TransferOwnershipProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const { walletClient } = useConnectedWallet();
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedSubnetId, setSelectedSubnetId] = useState<string>('');
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>(defaultNewOwnerAddress || '');
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [isNewOwnerContract, setIsNewOwnerContract] = useState(false);
  const [isCheckingNewOwner, setIsCheckingNewOwner] = useState(false);
  const [newOwnerContractType, setNewOwnerContractType] = useState<'StakingManager' | 'PoAManager' | 'Unknown' | null>(
    null,
  );

  // Update newOwnerAddress when defaultNewOwnerAddress prop changes
  useEffect(() => {
    if (defaultNewOwnerAddress && !newOwnerAddress) {
      setNewOwnerAddress(defaultNewOwnerAddress);
    }
  }, [defaultNewOwnerAddress, newOwnerAddress]);

  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  const validatorManagerData = useValidatorManagerDetails({ subnetId: selectedSubnetId });
  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingValidatorManager,
    contractOwner,
    isLoadingOwnership,
    isOwnerContract,
  } = validatorManagerData;

  const validatorManager = useValidatorManager(validatorManagerAddress || null);
  // Ownership check
  const isCurrentUserOwner =
    contractOwner && walletEVMAddress && contractOwner.toLowerCase() === walletEVMAddress.toLowerCase();

  // Only show error if user is definitely not the owner
  const showOwnershipError =
    !isLoadingOwnership && contractOwner && walletEVMAddress && !isCurrentUserOwner && !isOwnerContract;

  // Check if new owner address is a contract
  useEffect(() => {
    const checkNewOwnerType = async () => {
      if (!newOwnerAddress.trim() || !chainPublicClient) {
        setIsNewOwnerContract(false);
        setIsCheckingNewOwner(false);
        return;
      }

      // Basic address validation
      if (!newOwnerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        setIsNewOwnerContract(false);
        setIsCheckingNewOwner(false);
        return;
      }

      setIsCheckingNewOwner(true);
      setNewOwnerContractType(null);
      try {
        const bytecode = await chainPublicClient.getBytecode({
          address: newOwnerAddress as `0x${string}`,
        });
        const isContract = !!bytecode && bytecode !== '0x';
        setIsNewOwnerContract(isContract);

        if (isContract) {
          // Detect contract type using getStakingManagerSettings (unique to StakingManager)
          try {
            await chainPublicClient.readContract({
              address: newOwnerAddress as `0x${string}`,
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
            setNewOwnerContractType('StakingManager');
          } catch {
            // Not a StakingManager — check for PoAManager via owner()
            try {
              await chainPublicClient.readContract({
                address: newOwnerAddress as `0x${string}`,
                abi: [
                  {
                    name: 'owner',
                    type: 'function',
                    inputs: [],
                    outputs: [{ name: '', type: 'address' }],
                    stateMutability: 'view',
                  },
                ],
                functionName: 'owner',
              });
              setNewOwnerContractType('PoAManager');
            } catch {
              setNewOwnerContractType('Unknown');
            }
          }
        }
      } catch (e) {
        console.warn('Could not check if new owner is a contract:', e);
        setIsNewOwnerContract(false);
      } finally {
        setIsCheckingNewOwner(false);
      }
    };

    const timeoutId = setTimeout(checkNewOwnerType, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [newOwnerAddress, chainPublicClient]);

  async function handleTransferOwnership() {
    setIsTransferring(true);
    if (!walletClient.account) {
      throw new Error('No wallet account connected');
    }
    try {
      const hash = await validatorManager.transferOwnership(newOwnerAddress);
      const receipt = await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (!receipt.status || receipt.status !== 'success') {
        throw new Error('Transfer failed');
      }

      setReceipt(receipt);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTransferring(false);
    }
  }

  const canTransfer =
    !isTransferring &&
    !isLoadingValidatorManager &&
    validatorManagerAddress &&
    newOwnerAddress.trim() &&
    !validatorManagerError &&
    (isCurrentUserOwner || isOwnerContract || isLoadingOwnership); // Allow contract owners and loading states

  return (
    <>
      <div className="space-y-4">
        <SelectSubnetId
          value={selectedSubnetId}
          onChange={setSelectedSubnetId}
          onlyNotConverted={false}
          hidePrimaryNetwork={true}
          error={validatorManagerError}
        />

        <ValidatorManagerDetails
          validatorManagerAddress={validatorManagerData.validatorManagerAddress}
          blockchainId={validatorManagerData.blockchainId}
          subnetId={selectedSubnetId}
          isLoading={validatorManagerData.isLoading}
          signingSubnetId={validatorManagerData.signingSubnetId}
          contractTotalWeight={validatorManagerData.contractTotalWeight}
          l1WeightError={validatorManagerData.l1WeightError}
          isLoadingL1Weight={validatorManagerData.isLoadingL1Weight}
          contractOwner={validatorManagerData.contractOwner}
          ownershipError={validatorManagerData.ownershipError}
          isLoadingOwnership={validatorManagerData.isLoadingOwnership}
          isOwnerContract={validatorManagerData.isOwnerContract}
          ownerType={validatorManagerData.ownerType}
          isDetectingOwnerType={validatorManagerData.isDetectingOwnerType}
          isExpanded={isDetailsExpanded}
          onToggleExpanded={() => setIsDetailsExpanded(!isDetailsExpanded)}
        />

        {/* Minimal ownership error display */}
        {showOwnershipError && (
          <Alert variant="error">
            You are not the owner of this Validator Manager. Only the current owner can transfer ownership.
          </Alert>
        )}

        <EVMAddressInput
          label="New Owner Address"
          value={newOwnerAddress}
          onChange={setNewOwnerAddress}
          disabled={isTransferring}
        />

        {/* Contract type badge */}
        {isNewOwnerContract && !isCheckingNewOwner && newOwnerContractType && (
          <p className="text-xs text-zinc-500">
            Detected: <span className="font-medium text-zinc-700 dark:text-zinc-300">{newOwnerContractType}</span>
          </p>
        )}

        <Button variant="primary" onClick={handleTransferOwnership} loading={isTransferring} disabled={!canTransfer}>
          Transfer Ownership
        </Button>
      </div>
      {receipt && (
        <ResultField label="Transaction Hash" value={receipt.transactionHash} showCheck={!!receipt.transactionHash} />
      )}
    </>
  );
}

export { TransferOwnership };
export default withConsoleToolMetadata(TransferOwnership, metadata);
