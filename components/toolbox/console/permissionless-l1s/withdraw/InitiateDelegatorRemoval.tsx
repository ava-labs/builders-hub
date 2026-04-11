import React, { useState, useEffect } from 'react';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface InitiateDelegatorRemovalProps {
  delegationID: string;
  stakingManagerAddress: string;
  rpcUrl: string;
  signingSubnetId: string;
  tokenType: TokenType;
  onSuccess: (data: { txHash: string }) => void;
  onError: (message: string) => void;
}

const InitiateDelegatorRemoval: React.FC<InitiateDelegatorRemovalProps> = ({
  delegationID,
  stakingManagerAddress,
  tokenType,
  onSuccess,
  onError,
}) => {
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

  const [messageIndex, setMessageIndex] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [delegationInfo, setDelegationInfo] = useState<{
    owner: string;
    validationID: string;
    weight: string;
    status: number;
  } | null>(null);

  const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
  const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

  // Fetch delegation info when component mounts or delegationID changes
  useEffect(() => {
    const fetchDelegationInfo = async () => {
      if (!chainPublicClient || !stakingManagerAddress || !delegationID) {
        setDelegationInfo(null);
        return;
      }

      try {
        const info = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getDelegatorInfo',
          args: [delegationID as `0x${string}`],
        })) as any;

        setDelegationInfo({
          owner: info.owner,
          validationID: info.validationID,
          weight: info.weight?.toString() || '0',
          status: Number(info.status),
        });
      } catch {
        setDelegationInfo(null);
      }
    };

    fetchDelegationInfo();
  }, [chainPublicClient, stakingManagerAddress, delegationID, contractAbi]);

  const handleInitiateRemoval = async () => {
    setErrorState(null);
    setTxHash(null);

    if (!walletClient || !chainPublicClient || !viemChain) {
      const msg = 'Wallet or chain configuration is not properly initialized.';
      setErrorState(msg);
      onError(msg);
      return;
    }

    if (!delegationID || delegationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const msg = 'Valid delegation ID is required.';
      setErrorState(msg);
      onError(msg);
      return;
    }

    if (!stakingManagerAddress) {
      const msg = 'Staking Manager address is required.';
      setErrorState(msg);
      onError(msg);
      return;
    }

    const msgIndex = parseInt(messageIndex);
    if (isNaN(msgIndex) || msgIndex < 0) {
      const msg = 'Message index must be a non-negative number.';
      setErrorState(msg);
      onError(msg);
      return;
    }

    setIsProcessing(true);
    try {
      // Pre-check delegation status
      const fullDelegationInfo = (await chainPublicClient.readContract({
        address: stakingManagerAddress as `0x${string}`,
        abi: contractAbi,
        functionName: 'getDelegatorInfo',
        args: [delegationID as `0x${string}`],
      })) as {
        status: number;
        owner: string;
        validationID: string;
        weight: bigint;
        startTime: bigint;
      };

      const DelegatorStatusNames: Record<number, string> = {
        0: 'Unknown',
        1: 'PendingAdded',
        2: 'Active',
        3: 'PendingRemoved',
        4: 'Completed',
      };

      const status = Number(fullDelegationInfo.status);

      if (status === 4) {
        throw new Error(`This delegation has already been completed. It cannot be removed again.`);
      }

      if (status === 3) {
        throw new Error(`This delegation is already pending removal. Please complete the removal instead.`);
      }

      if (fullDelegationInfo.weight === 0n) {
        throw new Error(`This delegation has zero weight, which typically means it has already been removed.`);
      }

      if (status !== 2) {
        throw new Error(
          `Delegation is not active. Current status: ${DelegatorStatusNames[status] || 'Unknown'}. Only active delegations can be removed.`,
        );
      }

      // Check minimum stake duration
      if (fullDelegationInfo.startTime > 0n) {
        try {
          const stakingSettings = (await chainPublicClient.readContract({
            address: stakingManagerAddress as `0x${string}`,
            abi: contractAbi,
            functionName: 'getStakingManagerSettings',
          })) as { minimumStakeDuration: bigint };

          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          const stakingDuration = currentTime - fullDelegationInfo.startTime;

          if (stakingDuration < stakingSettings.minimumStakeDuration) {
            const remainingSeconds = stakingSettings.minimumStakeDuration - stakingDuration;
            const remainingHours = Number(remainingSeconds) / 3600;
            throw new Error(
              `Minimum stake duration has not passed. You can remove this delegation in approximately ${remainingHours.toFixed(1)} hours.`,
            );
          }
        } catch (settingsErr: any) {
          if (settingsErr.message?.includes('Minimum stake duration')) {
            throw settingsErr;
          }
        }
      }

      // Use hook to initiate delegator removal (bypasses uptime proof requirement)
      const removePromise =
        tokenType === 'native'
          ? nativeStakingManager.forceInitiateDelegatorRemoval(
              delegationID as `0x${string}`,
              false, // includeUptimeProof
              msgIndex,
            )
          : erc20StakingManager.forceInitiateDelegatorRemoval(
              delegationID as `0x${string}`,
              false, // includeUptimeProof
              msgIndex,
            );

      notify({ type: 'call', name: 'Initiate Delegator Removal' }, removePromise, viemChain ?? undefined);
      const hash = await removePromise;

      setTxHash(hash);

      // Wait for confirmation
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      onSuccess({ txHash: hash });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      }

      setErrorState(`Failed to initiate delegator removal: ${message}`);
      onError(`Failed to initiate delegator removal: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const DelegatorStatusNames: Record<number, string> = {
    0: 'Unknown',
    1: 'PendingAdded',
    2: 'Active',
    3: 'PendingRemoved',
    4: 'Completed',
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      {delegationInfo && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Delegation Information ({tokenLabel} Staking)
          </h3>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
            <p>
              <strong>Status:</strong> {DelegatorStatusNames[delegationInfo.status] || 'Unknown'}
            </p>
            <p>
              <strong>Owner:</strong> <code className="text-xs">{delegationInfo.owner}</code>
            </p>
            <p>
              <strong>Validation ID:</strong>{' '}
              <code className="text-xs">{delegationInfo.validationID?.substring(0, 18)}...</code>
            </p>
            <p>
              <strong>Weight:</strong> {delegationInfo.weight}
            </p>
          </div>
        </div>
      )}

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Removal Parameters</h3>

        <div className="space-y-3">
          <Input label="Delegation ID" value={delegationID} onChange={() => {}} disabled={true} />

          <Input
            label="Message Index"
            value={messageIndex}
            onChange={setMessageIndex}
            type="number"
            min="0"
            placeholder="0"
            disabled={isProcessing}
            helperText="Index of the warp message (usually 0)"
          />
        </div>
      </div>

      <Alert variant="info">
        <p className="text-sm">
          <strong>Note:</strong> Only the delegation owner or validator owner can initiate removal. The minimum stake
          duration must have passed.
        </p>
      </Alert>

      <Button
        onClick={handleInitiateRemoval}
        disabled={isProcessing || !delegationID || !!txHash || !delegationInfo}
        loading={isProcessing}
      >
        {isProcessing ? 'Processing...' : 'Initiate Delegator Removal'}
      </Button>
    </div>
  );
};

export default InitiateDelegatorRemoval;
