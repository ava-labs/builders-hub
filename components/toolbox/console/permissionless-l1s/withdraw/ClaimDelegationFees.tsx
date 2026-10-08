import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { HashChip } from '@/components/explorer-v2/ui';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';

type TokenType = 'native' | 'erc20';

interface ClaimDelegationFeesProps {
  validationID: string;
  stakingManagerAddress: string;
  tokenType: TokenType;
  onSuccess: (data: { txHash: string; message: string }) => void;
  onError: (message: string) => void;
}

const ClaimDelegationFees: React.FC<ClaimDelegationFeesProps> = ({
  validationID,
  stakingManagerAddress,
  tokenType,
  onSuccess,
  onError,
}) => {
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

  const handleClaimFees = async () => {
    setErrorState(null);
    setTxHash(null);
    setConfirmed(false);

    if (!walletClient || !chainPublicClient || !viemChain) {
      setErrorState('Wallet or chain configuration is not properly initialized.');
      onError('Wallet or chain configuration is not properly initialized.');
      return;
    }

    if (!validationID || validationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setErrorState('Valid validation ID is required.');
      onError('Valid validation ID is required.');
      return;
    }

    if (!stakingManagerAddress) {
      setErrorState('Staking Manager address is required.');
      onError('Staking Manager address is required.');
      return;
    }

    setIsProcessing(true);
    try {
      // Use hook to claim delegation fees
      const hash =
        tokenType === 'native'
          ? await nativeStakingManager.claimDelegationFees(validationID as `0x${string}`)
          : await erc20StakingManager.claimDelegationFees(validationID as `0x${string}`);

      setTxHash(hash);

      // Wait for confirmation
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      setConfirmed(true);
      const successMsg = 'Delegation fees claimed successfully.';

      onSuccess({
        txHash: hash,
        message: successMsg,
      });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      // Provide more helpful error messages
      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('InvalidValidationID')) {
        message = 'Invalid validation ID. The validator may not exist.';
      } else if (message.includes('NoFeesToClaim') || message.includes('NothingToClaim')) {
        message = 'No delegation fees available to claim for this validator.';
      } else if (message.includes('Unauthorized') || message.includes('OnlyValidator')) {
        message = 'Only the validator owner can claim delegation fees.';
      }

      setErrorState(`Failed to claim delegation fees: ${message}`);
      onError(`Failed to claim delegation fees: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}

      <dl className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
          <dt className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 sm:w-32 dark:text-zinc-500">
            Staking
          </dt>
          <dd className="font-mono text-[13px] text-zinc-900 dark:text-zinc-50">{tokenLabel}</dd>
        </div>
        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
          <dt className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 sm:w-32 dark:text-zinc-500">
            Validation ID
          </dt>
          <dd className="min-w-0">
            {validationID ? (
              <HashChip value={validationID} len={18} />
            ) : (
              <span className="font-mono text-[13px] text-zinc-400">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          About delegation fees
        </p>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {[
            'The fee rate is set when the validator registers (delegation fee basis points).',
            'Fees come out of delegator rewards when delegations are removed.',
            'Fees are claimed separately from validator rewards.',
            'Only the validator owner can claim them.',
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 bg-zinc-400 dark:bg-zinc-600" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <Button
        onClick={handleClaimFees}
        disabled={isProcessing || !!confirmed}
        loading={isProcessing}
        loadingText="Claiming…"
        icon={confirmed ? <Check className="h-3.5 w-3.5" /> : undefined}
      >
        {confirmed ? 'Fees claimed' : 'Claim delegation fees'}
      </Button>

      {txHash && !confirmed && (
        <p
          role="status"
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Submitted · waiting for confirmation
        </p>
      )}

      {confirmed && <Alert variant="success">Delegation fees were claimed and sent to your address.</Alert>}

      <Alert variant="warning">
        Delegation fees are separate from validator rewards. Complete the validator removal to claim those too.
      </Alert>
    </div>
  );
};

export default ClaimDelegationFees;
