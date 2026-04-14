import React, { useState } from 'react';
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

type TokenType = 'native' | 'erc20';

interface InitiateValidatorRemovalProps {
  validationID: string;
  stakingManagerAddress: string;
  rpcUrl: string;
  signingSubnetId: string;
  tokenType: TokenType;
  onSuccess: (data: { txHash: string }) => void;
  onError: (message: string) => void;
}

const InitiateValidatorRemoval: React.FC<InitiateValidatorRemovalProps> = ({
  validationID,
  stakingManagerAddress,
  tokenType,
  onSuccess,
  onError,
}) => {
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

  const preflight = useValidatorPreflight({
    validationID: validationID || undefined,
    stakingManagerAddress,
    validatorManagerAddress: stakingManagerAddress,
    walletAddress: walletEVMAddress || undefined,
  });

  const [messageIndex, setMessageIndex] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

  const handleInitiateRemoval = async () => {
    setErrorState(null);
    setTxHash(null);

    if (!walletClient || !chainPublicClient || !viemChain) {
      const msg = 'Wallet or chain configuration is not properly initialized.';
      setErrorState(msg);
      onError(msg);
      return;
    }

    if (!validationID || validationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const msg = 'Valid validation ID is required.';
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
      // Pre-checks are handled by useValidatorPreflight — the button is gated
      // behind preflight.checks.initiateRemoval.status === 'met', so we only
      // reach here when all on-chain preconditions are satisfied.

      // Use hook to initiate validator removal (no uptime proof)
      // (useContractActions.write() already calls notify() internally)
      const hash = await (tokenType === 'native'
        ? nativeStakingManager.forceInitiateValidatorRemoval(
            validationID as `0x${string}`,
            false, // includeUptimeProof
            msgIndex,
          )
        : erc20StakingManager.forceInitiateValidatorRemoval(
            validationID as `0x${string}`,
            false, // includeUptimeProof
            msgIndex,
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
          Removal Parameters ({tokenLabel} Staking)
        </h3>

        <div className="space-y-3">
          <Input label="Validation ID" value={validationID} onChange={() => {}} disabled={true} />

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

      <LockedContent
        isUnlocked={!validationID || (!preflight.isLoading && preflight.checks.initiateRemoval.status === 'met')}
      >
        <Button
          onClick={handleInitiateRemoval}
          disabled={isProcessing || !validationID || !!txHash || preflight.isLoading}
          loading={isProcessing || preflight.isLoading}
        >
          {isProcessing ? 'Processing...' : 'Initiate Validator Removal'}
        </Button>
      </LockedContent>
    </div>
  );
};

export default InitiateValidatorRemoval;
