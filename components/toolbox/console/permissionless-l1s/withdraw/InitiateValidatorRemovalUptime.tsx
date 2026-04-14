'use client';

import React, { useState } from 'react';
import { hexToBytes } from 'viem';
import { CliAlternative } from '@/components/console/cli-alternative';
import { CAST_COMMANDS } from '@/components/toolbox/console/shared/pchainCommands';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { LockedContent } from '@/components/toolbox/components/LockedContent';
import { ValidatorPreflightChecklist } from '@/components/toolbox/components/ValidatorPreflightChecklist';
import { useValidatorPreflight } from '@/components/toolbox/hooks/useValidatorPreflight';
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
  uptimeBlockchainID: string;
  tokenType: TokenType;
  onSuccess: (data: { txHash: string }) => void;
  onError: (message: string) => void;
}

const InitiateValidatorRemovalUptime: React.FC<InitiateValidatorRemovalUptimeProps> = ({
  validationID,
  stakingManagerAddress,
  rpcUrl,
  uptimeBlockchainID,
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

  const preflight = useValidatorPreflight({
    validationID: validationID || undefined,
    stakingManagerAddress,
    validatorManagerAddress: stakingManagerAddress,
    walletAddress: walletEVMAddress || undefined,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [uptimeInfo, setUptimeInfo] = useState<{ seconds: number; signed: boolean } | null>(null);
  const [customValidatorsUrl, setCustomValidatorsUrl] = useState<string>('');
  const [showCustomUrl, setShowCustomUrl] = useState(false);

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
      // Pre-checks are handled by useValidatorPreflight — the button is gated
      // behind preflight.checks.initiateRemoval.status === 'met', so we only
      // reach here when all on-chain preconditions are satisfied.

      // Step 1: Create and sign uptime proof
      // Fetches real-time uptime from L1 node's /validators endpoint, then
      // aggregates BLS signatures from subnet validators with progressive retry.
      const uptimeProofPromise = createAndSignUptimeProof(
        validationID,
        rpcUrl,
        uptimeBlockchainID,
        customValidatorsUrl || undefined,
      );

      notify({ type: 'local', name: 'Aggregate Uptime Proof Signatures' }, uptimeProofPromise);

      const uptimeProof = await uptimeProofPromise;
      setUptimeInfo({ seconds: Number(uptimeProof.uptimeSeconds), signed: true });

      // Step 2: Pack signed uptime message into access list
      const signedWarpBytes = hexToBytes(`0x${uptimeProof.signedWarpMessage}`);
      const accessList = packWarpIntoAccessList(signedWarpBytes);

      // Step 3: Call initiateValidatorRemoval with uptime proof in access list
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

      // Auto-show the custom URL input when the validators endpoint fails
      if (message.includes('validators') && message.includes('unavailable')) {
        setShowCustomUrl(true);
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

      {validationID && <ValidatorPreflightChecklist preflight={preflight} currentFlow="initiate-removal" />}

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Removal with Uptime Proof ({tokenLabel} Staking)
        </h3>

        <div className="space-y-3">
          <Input label="Validation ID" value={validationID} onChange={() => {}} disabled={true} />
        </div>
      </div>

      {/* Custom validators URL — collapsed by default, auto-shown on endpoint failure */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowCustomUrl(!showCustomUrl)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showCustomUrl ? 'Hide custom endpoint' : 'Custom Validators API URL (optional)'}
        </button>
        {showCustomUrl && (
          <Input
            label="Validators API URL"
            value={customValidatorsUrl}
            onChange={setCustomValidatorsUrl}
            placeholder="https://your-node/ext/bc/<blockchainID>/validators"
            disabled={isProcessing}
            helperText="Override the auto-detected URL if your node uses a non-standard path or the default endpoint is unavailable."
          />
        )}
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

      <LockedContent
        isUnlocked={!validationID || (!preflight.isLoading && preflight.checks.initiateRemoval.status === 'met')}
      >
        <Button
          onClick={handleInitiateRemoval}
          disabled={isProcessing || !validationID || !!txHash || preflight.isLoading}
          loading={isProcessing || isSigningUptime || preflight.isLoading}
        >
          {isSigningUptime
            ? 'Aggregating Uptime Proof...'
            : isProcessing
              ? 'Processing...'
              : 'Initiate Removal with Uptime Proof'}
        </Button>

        {validationID && stakingManagerAddress && rpcUrl && (
          <CliAlternative
            command={CAST_COMMANDS.initiateValidatorRemoval({
              managerAddress: stakingManagerAddress,
              validationId: validationID,
              includeUptimeProof: true,
              rpcUrl,
              signedWarpMessage: '<signed-uptime-proof-hex>',
            })}
          />
        )}
      </LockedContent>
    </div>
  );
};

export default InitiateValidatorRemovalUptime;
