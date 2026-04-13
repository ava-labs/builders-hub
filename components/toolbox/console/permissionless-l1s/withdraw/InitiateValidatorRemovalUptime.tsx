'use client';

import React, { useState } from 'react';
import { hexToBytes } from 'viem';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useUptimeProof } from '@/components/toolbox/hooks/useUptimeProof';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/validator-manager/packWarp';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface InitiateValidatorRemovalUptimeProps {
  validationID: string;
  stakingManagerAddress: string;
  rpcUrl: string;
  signingSubnetId: string;
  tokenType: TokenType;
  onSuccess: (data: { txHash: string }) => void;
  onError: (message: string) => void;
}

const InitiateValidatorRemovalUptime: React.FC<InitiateValidatorRemovalUptimeProps> = ({
  validationID,
  stakingManagerAddress,
  rpcUrl,
  signingSubnetId,
  tokenType,
  onSuccess,
  onError,
}) => {
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);
  const { createAndSignUptimeProof, isLoading: isSigningUptime } = useUptimeProof();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [uptimeInfo, setUptimeInfo] = useState<{ seconds: bigint; signed: boolean } | null>(null);

  const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
  const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

  const handleInitiateRemoval = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorState(null);
    setTxHash(null);
    setUptimeInfo(null);

    if (!walletClient || !chainPublicClient || !viemChain) {
      const msg = 'Wallet or chain configuration is not properly initialized.';
      setErrorState(msg);
      onError(msg);
      setIsProcessing(false);
      return;
    }

    if (!validationID || validationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const msg = 'Valid validation ID is required.';
      setErrorState(msg);
      onError(msg);
      setIsProcessing(false);
      return;
    }

    if (!stakingManagerAddress) {
      const msg = 'Staking Manager address is required.';
      setErrorState(msg);
      onError(msg);
      setIsProcessing(false);
      return;
    }
    try {
      // Pre-check validator state
      try {
        const stakingValidatorInfo = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getStakingValidator',
          args: [validationID as `0x${string}`],
        })) as { owner: string; delegationFeeBips: number; minStakeDuration: bigint; uptimeSeconds: bigint };

        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
        const isGenesisValidator = stakingValidatorInfo.owner === ZERO_ADDRESS;

        if (!isGenesisValidator && stakingValidatorInfo.owner.toLowerCase() !== walletEVMAddress?.toLowerCase()) {
          throw new Error(`You are not the owner of this validator. Owner: ${stakingValidatorInfo.owner}`);
        }

        // Check validator status via ValidatorManager
        const settings = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getStakingManagerSettings',
        })) as { manager: string; minimumStakeDuration: bigint };

        const ValidatorManagerAbi = [
          {
            type: 'function',
            name: 'getValidator',
            inputs: [{ name: 'validationID', type: 'bytes32' }],
            outputs: [
              {
                type: 'tuple',
                components: [
                  { name: 'status', type: 'uint8' },
                  { name: 'nodeID', type: 'bytes' },
                  { name: 'startingWeight', type: 'uint64' },
                  { name: 'weight', type: 'uint64' },
                  { name: 'startTime', type: 'uint64' },
                  { name: 'endedAt', type: 'uint64' },
                ],
              },
            ],
            stateMutability: 'view',
          },
        ];

        const validatorInfo = (await chainPublicClient.readContract({
          address: settings.manager as `0x${string}`,
          abi: ValidatorManagerAbi,
          functionName: 'getValidator',
          args: [validationID as `0x${string}`],
        })) as { status: number; startTime: bigint };

        const statusNames: Record<number, string> = {
          0: 'Unknown',
          1: 'Pending',
          2: 'Active',
          3: 'Removing',
          4: 'Completed',
        };

        if (Number(validatorInfo.status) !== 2) {
          throw new Error(
            `Validator is not active. Current status: ${statusNames[validatorInfo.status] || validatorInfo.status}. Only active validators can be removed.`,
          );
        }

        if (!isGenesisValidator && stakingValidatorInfo.minStakeDuration > 0n) {
          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          const endTime = validatorInfo.startTime + stakingValidatorInfo.minStakeDuration;
          if (currentTime < endTime) {
            const remaining = endTime - currentTime;
            const hours = Number(remaining) / 3600;
            throw new Error(`Minimum stake duration has not passed. Time remaining: ${hours.toFixed(1)} hours.`);
          }
        }
      } catch (preCheckErr) {
        if (
          preCheckErr instanceof Error &&
          (preCheckErr.message.includes('not the owner') ||
            preCheckErr.message.includes('stake duration') ||
            preCheckErr.message.includes('not active') ||
            preCheckErr.message.includes('active delegations'))
        ) {
          throw preCheckErr;
        }
      }

      // Step 1: Create and sign uptime proof
      // Fetches real-time uptime from L1 node's /validators endpoint, then
      // aggregates BLS signatures from subnet validators with progressive retry.
      const uptimeProofPromise = createAndSignUptimeProof(validationID, rpcUrl, signingSubnetId);

      notify({ type: 'local', name: 'Aggregate Uptime Proof Signatures' }, uptimeProofPromise);

      const uptimeProof = await uptimeProofPromise;
      setUptimeInfo({ seconds: uptimeProof.uptimeSeconds, signed: true });

      // Step 2: Pack signed uptime message into access list
      const signedWarpBytes = hexToBytes(`0x${uptimeProof.signedWarpMessage}`);
      const accessList = packWarpIntoAccessList(signedWarpBytes);

      // Step 3: Call initiateValidatorRemoval with uptime proof
      const hash = await (tokenType === 'native'
        ? nativeStakingManager.initiateValidatorRemoval(
            validationID as `0x${string}`,
            true, // includeUptimeProof
            0, // messageIndex
            accessList,
          )
        : erc20StakingManager.initiateValidatorRemoval(
            validationID as `0x${string}`,
            true, // includeUptimeProof
            0, // messageIndex
            accessList,
          ));
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
      } else if (message.includes('ValidatorIneligibleForRewards')) {
        message =
          'Validator is ineligible for rewards based on current uptime. Use "Force Remove Validator" to proceed without rewards.';
      }

      setErrorState(`Failed to initiate validator removal: ${message}`);
      onError(`Failed to initiate validator removal: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Removal with Uptime Proof ({tokenLabel} Staking)
        </h3>

        <div className="space-y-3">
          <Input label="Validation ID" value={validationID} onChange={() => {}} disabled={true} />
        </div>
      </div>

      {uptimeInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
            <p>
              <strong>Uptime:</strong> {(Number(uptimeInfo.seconds) / 3600).toFixed(1)} hours (
              {uptimeInfo.seconds.toString()} seconds)
            </p>
            <p>
              <strong>Proof signed:</strong> {uptimeInfo.signed ? 'Yes' : 'Pending'}
            </p>
          </div>
        </div>
      )}

      <Alert variant="info">
        <p className="text-sm">
          This will aggregate an uptime proof from L1 validators and include it in the removal transaction. Higher
          uptime = higher staking rewards. If the validator is ineligible for rewards, the transaction will revert — use{' '}
          <strong>Force Remove</strong> instead.
        </p>
      </Alert>

      <Button
        onClick={handleInitiateRemoval}
        disabled={isProcessing || !validationID || !!txHash}
        loading={isProcessing || isSigningUptime}
      >
        {isSigningUptime
          ? 'Aggregating Uptime Proof...'
          : isProcessing
            ? 'Processing...'
            : 'Initiate Removal with Uptime Proof'}
      </Button>
    </div>
  );
};

export default InitiateValidatorRemovalUptime;
