import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther, formatEther, decodeEventLog } from 'viem';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useERC20Token } from '@/components/toolbox/hooks/useERC20Token';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface ContractSettings {
  minimumStakeAmount: string;
  maximumStakeAmount: string;
}

interface InitiateDelegationProps {
  validationID: string;
  stakingManagerAddress: string;
  tokenType: TokenType;
  erc20TokenAddress?: string;
  onSuccess: (data: { txHash: string; delegationID: string }) => void;
  onError: (message: string) => void;
}

const InitiateDelegation: React.FC<InitiateDelegationProps> = ({
  validationID,
  stakingManagerAddress,
  tokenType,
  erc20TokenAddress,
  onSuccess,
  onError,
}) => {
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  // Initialize hooks
  const nativeStakingManager = useNativeTokenStakingManager(stakingManagerAddress || null);
  const erc20StakingManager = useERC20TokenStakingManager(stakingManagerAddress || null);
  const erc20Token = useERC20Token(erc20TokenAddress || null, ExampleERC20.abi);

  const [delegationAmount, setDelegationAmount] = useState<string>('');
  const [rewardRecipient, setRewardRecipient] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [delegationID, setDelegationID] = useState<string | null>(null);
  const [contractSettings, setContractSettings] = useState<ContractSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
  const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
  const isNative = tokenType === 'native';

  // Fetch contract settings to show minimum delegation amount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!chainPublicClient || !stakingManagerAddress) return;

      try {
        const settings = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getStakingManagerSettings',
        })) as {
          manager: string;
          minimumStakeAmount: bigint;
          maximumStakeAmount: bigint;
          minimumStakeDuration: bigint;
          minimumDelegationFeeBips: number;
          maximumDelegationFeeBips: number;
          rewardCalculator: string;
          uptimeBlockchainID: string;
        };

        setContractSettings({
          minimumStakeAmount: formatEther(settings.minimumStakeAmount),
          maximumStakeAmount: formatEther(settings.maximumStakeAmount),
        });
        setSettingsError(null);
      } catch (err: any) {
        console.warn('Failed to fetch contract settings:', err);
        setSettingsError('Could not fetch delegation requirements. Proceed with caution.');
      }
    };

    fetchSettings();
  }, [chainPublicClient, stakingManagerAddress, contractAbi]);

  const handleApproveERC20 = async () => {
    if (!erc20TokenAddress || !walletClient || !chainPublicClient || !viemChain) {
      setErrorState('ERC20 token address or wallet not available');
      return;
    }

    setIsApproving(true);
    setErrorState(null);

    try {
      const amountWei = parseEther(delegationAmount);

      const approvePromise = erc20Token.approve(stakingManagerAddress as `0x${string}`, amountWei.toString());
      notify({ type: 'call', name: 'Approve ERC20 for Delegation' }, approvePromise, viemChain ?? undefined);
      const hash = await approvePromise;
      await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      setErrorState(null);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorState(`Failed to approve tokens: ${message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleInitiateDelegation = async () => {
    setErrorState(null);
    setTxHash(null);
    setDelegationID(null);

    if (!walletClient || !chainPublicClient || !viemChain) {
      setErrorState('Wallet or chain configuration is not properly initialized.');
      onError('Wallet or chain configuration is not properly initialized.');
      return;
    }

    if (!validationID) {
      setErrorState('Validation ID is required.');
      onError('Validation ID is required.');
      return;
    }

    if (!delegationAmount || parseFloat(delegationAmount) <= 0) {
      setErrorState('Valid delegation amount is required.');
      onError('Valid delegation amount is required.');
      return;
    }

    if (!stakingManagerAddress) {
      setErrorState('Staking Manager address is required.');
      onError('Staking Manager address is required.');
      return;
    }

    setIsProcessing(true);
    try {
      const amountWei = parseEther(delegationAmount);
      const recipient = rewardRecipient || walletEVMAddress || '';

      // Pre-transaction validation: Check validator status and PoS eligibility
      try {
        // Get the underlying ValidatorManager address from StakingManager settings
        const settings = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getStakingManagerSettings',
        })) as { manager: string };

        const validatorManagerAbi = [
          {
            name: 'getValidator',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'validationID', type: 'bytes32' }],
            outputs: [
              {
                name: '',
                type: 'tuple',
                components: [
                  { name: 'status', type: 'uint8' },
                  { name: 'nodeID', type: 'bytes' },
                  { name: 'startingWeight', type: 'uint64' },
                  { name: 'messageNonce', type: 'uint64' },
                  { name: 'weight', type: 'uint64' },
                  { name: 'startedAt', type: 'uint64' },
                  { name: 'endedAt', type: 'uint64' },
                ],
              },
            ],
          },
        ];

        // Check if validator exists and get its status
        const validator = (await chainPublicClient.readContract({
          address: settings.manager as `0x${string}`,
          abi: validatorManagerAbi,
          functionName: 'getValidator',
          args: [validationID as `0x${string}`],
        })) as { status: number };

        // Status enum: 0=Unknown, 1=PendingAdded, 2=Active, 3=PendingRemoved, 4=Completed, 5=Invalidated
        if (validator.status === 0) {
          throw new Error('Validator not found. Please verify the validation ID is correct.');
        } else if (validator.status === 1) {
          throw new Error(
            'Validator registration is still pending. Please complete the validator registration first (Step 6 of staking flow).',
          );
        } else if (validator.status !== 2) {
          const statusNames = ['Unknown', 'PendingAdded', 'Active', 'PendingRemoved', 'Completed', 'Invalidated'];
          throw new Error(
            `Validator is not active. Current status: ${statusNames[validator.status] || validator.status}. Only active validators can receive delegations.`,
          );
        }

        // Check if this is a PoS validator
        const posValidator = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getStakingValidator',
          args: [validationID as `0x${string}`],
        })) as { owner: string };

        if (posValidator.owner === '0x0000000000000000000000000000000000000000') {
          throw new Error(
            'This validator is not a PoS (Proof-of-Stake) validator. It may be a PoA validator that cannot receive delegations.',
          );
        }

        // Check if delegation amount is within bounds
        if (contractSettings) {
          const minAmount = parseEther(contractSettings.minimumStakeAmount);
          const maxAmount = parseEther(contractSettings.maximumStakeAmount);

          if (amountWei < minAmount) {
            throw new Error(
              `Delegation amount (${delegationAmount}) is below the minimum required (${contractSettings.minimumStakeAmount}).`,
            );
          }
          if (amountWei > maxAmount) {
            throw new Error(
              `Delegation amount (${delegationAmount}) exceeds the maximum allowed (${contractSettings.maximumStakeAmount}).`,
            );
          }
        }
      } catch (preCheckErr: any) {
        // If it's one of our custom errors, throw it directly
        if (preCheckErr.message && !preCheckErr.message.includes('reverted')) {
          throw preCheckErr;
        }
        // Otherwise, continue - the gas estimation will catch the actual error
      }

      // Call the appropriate hook based on token type
      // (useContractActions.write() already calls notify() internally)
      const hash = await (isNative
        ? nativeStakingManager.initiateDelegatorRegistration(
            validationID as `0x${string}`,
            recipient as `0x${string}`,
            amountWei,
          )
        : erc20StakingManager.initiateDelegatorRegistration(
            validationID as `0x${string}`,
            amountWei,
            recipient as `0x${string}`,
          ));
      setTxHash(hash);

      // Wait for confirmation
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      // Extract delegationID from InitiatedDelegatorRegistration event
      // Event: InitiatedDelegatorRegistration(bytes32 indexed delegationID, bytes32 indexed validationID, address indexed delegatorAddress, ...)
      let extractedDelegationID: string | null = null;
      try {
        const initiatedDelegatorRegistrationEvent = {
          type: 'event' as const,
          name: 'InitiatedDelegatorRegistration',
          inputs: [
            { name: 'delegationID', type: 'bytes32', indexed: true },
            { name: 'validationID', type: 'bytes32', indexed: true },
            { name: 'delegatorAddress', type: 'address', indexed: true },
            { name: 'nonce', type: 'uint64', indexed: false },
            { name: 'validatorWeight', type: 'uint64', indexed: false },
            { name: 'delegatorWeight', type: 'uint64', indexed: false },
            { name: 'setWeightMessageID', type: 'bytes32', indexed: false },
            { name: 'rewardRecipient', type: 'address', indexed: false },
          ],
        };

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: [initiatedDelegatorRegistrationEvent],
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName === 'InitiatedDelegatorRegistration') {
              extractedDelegationID = (decoded.args as { delegationID: string }).delegationID;
              setDelegationID(extractedDelegationID);
              break;
            }
          } catch {
            // Not this event, continue
          }
        }
      } catch (err) {
        console.warn('Could not extract delegation ID from logs:', err);
      }

      onSuccess({
        txHash: hash,
        delegationID: extractedDelegationID || '',
      });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      // Provide more helpful error messages
      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('insufficient funds')) {
        message = `Insufficient ${tokenLabel.toLowerCase()} balance for delegation`;
      } else if (message.includes('ERC20: insufficient allowance')) {
        message = 'Insufficient ERC20 allowance. Please approve tokens first.';
      } else if (message.includes('InvalidValidationID')) {
        message = 'Invalid validation ID. The validator may not be active.';
      } else if (message.includes('MinStakeDurationNotMet')) {
        message = 'Delegation amount does not meet minimum stake duration requirements.';
      }

      setErrorState(`Failed to initiate delegation: ${message}`);
      onError(`Failed to initiate delegation: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      {settingsError && <Alert variant="warning">{settingsError}</Alert>}

      {validationID && (
        <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs">
          <span className="text-zinc-500">Validator: </span>
          <code className="text-zinc-700 dark:text-zinc-300 font-mono">
            {validationID.slice(0, 18)}...{validationID.slice(-6)}
          </code>
        </div>
      )}

      <Input
        label="Delegation Amount"
        value={delegationAmount}
        onChange={setDelegationAmount}
        type="number"
        min="0"
        step="0.01"
        placeholder="100"
        disabled={isProcessing || isApproving}
        helperText={
          contractSettings
            ? `Min: ${contractSettings.minimumStakeAmount} · Max: ${contractSettings.maximumStakeAmount}`
            : `Amount of ${tokenLabel.toLowerCase()}s to delegate`
        }
      />

      <Input
        label="Reward Recipient (optional)"
        value={rewardRecipient}
        onChange={setRewardRecipient}
        placeholder={walletEVMAddress || '0x...'}
        disabled={isProcessing || isApproving}
        helperText="Defaults to your connected wallet address"
      />

      {!isNative && erc20TokenAddress && (
        <Button
          onClick={handleApproveERC20}
          disabled={isApproving || isProcessing || !delegationAmount}
          loading={isApproving}
          variant="secondary"
          className="w-full"
        >
          Approve {delegationAmount || '0'} Tokens
        </Button>
      )}

      <Button
        onClick={handleInitiateDelegation}
        disabled={isProcessing || isApproving || !delegationAmount || !!txHash}
        loading={isProcessing}
        variant="primary"
        className="w-full"
      >
        Initiate Delegation
      </Button>

      {txHash && delegationID && <Success label="Delegation ID" value={delegationID} />}
    </div>
  );
};

export default InitiateDelegation;
