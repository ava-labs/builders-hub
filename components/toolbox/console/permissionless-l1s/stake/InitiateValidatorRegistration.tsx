'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { LockedContent } from '@/components/toolbox/components/LockedContent';
import { ValidatorPreflightChecklist } from '@/components/toolbox/components/ValidatorPreflightChecklist';
import { useValidatorPreflight } from '@/components/toolbox/hooks/useValidatorPreflight';
import { parseNodeID, parsePChainAddress } from '@/components/toolbox/coreViem/utils/ids';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther, formatEther } from 'viem';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useERC20Token } from '@/components/toolbox/hooks/useERC20Token';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';

interface ContractSettings {
  minimumStakeAmount: string;
  maximumStakeAmount: string;
  minimumStakeDuration: string;
  minimumDelegationFeeBips: number;
}

type TokenType = 'native' | 'erc20';

interface InitiateValidatorRegistrationProps {
  nodeID: string;
  blsPublicKey: string;
  stakingManagerAddress: string;
  tokenType: TokenType;
  erc20TokenAddress?: string;
  remainingBalanceOwner?: { addresses: string[]; threshold: number };
  disableOwner?: { addresses: string[]; threshold: number };
  onSuccess: (data: { txHash: string; validationID: string }) => void;
  onError: (message: string) => void;
}

const InitiateValidatorRegistration: React.FC<InitiateValidatorRegistrationProps> = ({
  nodeID,
  blsPublicKey,
  stakingManagerAddress,
  tokenType,
  erc20TokenAddress,
  remainingBalanceOwner: remainingBalanceOwnerProp,
  disableOwner: disableOwnerProp,
  onSuccess,
  onError,
}) => {
  const { walletEVMAddress, pChainAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const nativeStakingManager = useNativeTokenStakingManager(stakingManagerAddress || null);
  const erc20StakingManager = useERC20TokenStakingManager(stakingManagerAddress || null);

  // Preflight check: read on-chain state for the nodeID to block re-registration
  const preflight = useValidatorPreflight({
    nodeID: nodeID || undefined,
    stakingManagerAddress: stakingManagerAddress || null,
    validatorManagerAddress: stakingManagerAddress || null,
    walletAddress: walletEVMAddress || undefined,
    stakingManagerType: tokenType === 'erc20' ? 'erc20' : 'native',
  });

  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [delegationFeeBips, setDelegationFeeBips] = useState<string>('100');
  const [minStakeDuration, setMinStakeDuration] = useState<string>('86400');
  const [rewardRecipient, setRewardRecipient] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [validationID, setValidationID] = useState<string | null>(null);
  const [contractSettings, setContractSettings] = useState<ContractSettings | null>(null);
  // Resolved ERC20 token address — read from the staking manager contract
  const [resolvedErc20Address, setResolvedErc20Address] = useState<string>(erc20TokenAddress || '');

  const erc20Token = useERC20Token(resolvedErc20Address || null, ExampleERC20.abi);

  const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
  const isNative = tokenType === 'native';

  // Default reward recipient to connected wallet
  useEffect(() => {
    if (walletEVMAddress && !rewardRecipient) {
      setRewardRecipient(walletEVMAddress);
    }
  }, [walletEVMAddress, rewardRecipient]);

  // Fetch contract settings + resolve ERC20 token address from the staking manager
  useEffect(() => {
    const fetchSettings = async () => {
      if (!chainPublicClient || !stakingManagerAddress) return;
      try {
        // For ERC20, read the actual token address the staking manager uses
        if (!isNative) {
          try {
            const tokenAddr = await chainPublicClient.readContract({
              address: stakingManagerAddress as `0x${string}`,
              abi: ERC20TokenStakingManager.abi,
              functionName: 'erc20',
            });
            if (tokenAddr) setResolvedErc20Address(tokenAddr as string);
          } catch {
            // Fallback to prop if erc20() read fails
          }
        }

        const settings = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getStakingManagerSettings',
        })) as {
          minimumStakeAmount: bigint;
          maximumStakeAmount: bigint;
          minimumStakeDuration: bigint;
          minimumDelegationFeeBips: number;
        };

        const parsed: ContractSettings = {
          minimumStakeAmount: formatEther(settings.minimumStakeAmount),
          maximumStakeAmount: formatEther(settings.maximumStakeAmount),
          minimumStakeDuration: String(settings.minimumStakeDuration),
          minimumDelegationFeeBips: Number(settings.minimumDelegationFeeBips),
        };
        setContractSettings(parsed);

        // Pre-fill with contract minimums
        if (!stakeAmount) setStakeAmount(parsed.minimumStakeAmount);
        if (!delegationFeeBips || delegationFeeBips === '100') {
          setDelegationFeeBips(String(parsed.minimumDelegationFeeBips));
        }
        if (!minStakeDuration || minStakeDuration === '86400') {
          setMinStakeDuration(parsed.minimumStakeDuration);
        }
      } catch (err: any) {
        console.error('Failed to fetch contract settings:', err);
      }
    };

    fetchSettings();
  }, [chainPublicClient, stakingManagerAddress, contractAbi]); // stakeAmount/delegationFeeBips/minStakeDuration intentionally excluded — only pre-fill on first load

  const handleApproveERC20 = async () => {
    if (!resolvedErc20Address || !walletClient || !chainPublicClient || !viemChain) return;
    setIsApproving(true);
    setErrorState(null);
    try {
      // useERC20Token.approve() calls parseEther internally — pass human-readable amount
      const hash = await erc20Token.approve(stakingManagerAddress as `0x${string}`, stakeAmount);
      await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    } catch (err: any) {
      setErrorState(`Failed to approve tokens: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsApproving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Real-time input validation against contract constraints
  // ---------------------------------------------------------------------------

  const getStakeError = useMemo(() => {
    return (): string | null => {
      if (!stakeAmount || !contractSettings) return null;
      try {
        const amountWei = parseEther(stakeAmount);
        const minWei = parseEther(contractSettings.minimumStakeAmount);
        const maxWei = parseEther(contractSettings.maximumStakeAmount);
        if (amountWei < minWei) return `Below minimum: ${contractSettings.minimumStakeAmount}`;
        if (amountWei > maxWei) return `Above maximum: ${contractSettings.maximumStakeAmount}`;
      } catch {
        return 'Invalid amount';
      }
      return null;
    };
  }, [stakeAmount, contractSettings]);

  const getDelegationFeeError = useMemo(() => {
    return (): string | null => {
      if (!delegationFeeBips || !contractSettings) return null;
      const fee = parseInt(delegationFeeBips);
      if (isNaN(fee)) return 'Invalid number';
      if (fee < contractSettings.minimumDelegationFeeBips)
        return `Below minimum: ${contractSettings.minimumDelegationFeeBips} bips`;
      if (fee > 10000) return 'Cannot exceed 10000 bips (100%)';
      return null;
    };
  }, [delegationFeeBips, contractSettings]);

  const getDurationError = useMemo(() => {
    return (): string | null => {
      if (!minStakeDuration || !contractSettings) return null;
      const dur = parseInt(minStakeDuration);
      if (isNaN(dur)) return 'Invalid number';
      if (dur < parseInt(contractSettings.minimumStakeDuration))
        return `Below minimum: ${contractSettings.minimumStakeDuration}s`;
      return null;
    };
  }, [minStakeDuration, contractSettings]);

  const stakeError = getStakeError();
  const delegationFeeError = getDelegationFeeError();
  const durationError = getDurationError();
  const hasValidationErrors = !!(stakeError || delegationFeeError || durationError);

  // Determine if registration is blocked by preflight checks
  const isPreflightBlocked = !!nodeID && !preflight.isLoading && preflight.checks.register.status === 'not_met';

  const handleInitiateRegistration = async () => {
    setErrorState(null);
    setTxHash(null);
    setValidationID(null);

    if (!walletClient || !chainPublicClient || !viemChain) {
      setErrorState('Wallet or chain not connected.');
      return;
    }
    if (!nodeID || !blsPublicKey) {
      setErrorState('Node ID and BLS Public Key are required.');
      return;
    }
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setErrorState('Valid stake amount is required.');
      return;
    }
    if (!stakingManagerAddress) {
      setErrorState('Staking Manager address is required.');
      return;
    }

    setIsProcessing(true);
    try {
      const amountWei = parseEther(stakeAmount);
      const feeBips = parseInt(delegationFeeBips);
      const duration = parseInt(minStakeDuration);

      const remainingOwnerAddresses = remainingBalanceOwnerProp?.addresses?.length
        ? remainingBalanceOwnerProp.addresses
        : pChainAddress
          ? [pChainAddress]
          : [];
      const disableOwnerAddresses = disableOwnerProp?.addresses?.length
        ? disableOwnerProp.addresses
        : pChainAddress
          ? [pChainAddress]
          : [];

      if (remainingOwnerAddresses.length === 0) {
        throw new Error('Remaining Balance Owner is required. Add P-Chain addresses in validator details.');
      }
      if (disableOwnerAddresses.length === 0) {
        throw new Error('Disable Owner is required. Add P-Chain addresses in validator details.');
      }

      const remainingBalanceOwnerStruct = {
        threshold: remainingBalanceOwnerProp?.threshold || 1,
        addresses: remainingOwnerAddresses.map((addr) => parsePChainAddress(addr)),
      };
      const disableOwnerStruct = {
        threshold: disableOwnerProp?.threshold || 1,
        addresses: disableOwnerAddresses.map((addr) => parsePChainAddress(addr)),
      };

      const recipient = (rewardRecipient || walletEVMAddress) as `0x${string}`;
      const nodeIDBytes = parseNodeID(nodeID);

      let hash: string;
      if (isNative) {
        hash = await nativeStakingManager.initiateValidatorRegistration(
          nodeIDBytes as `0x${string}`,
          blsPublicKey as `0x${string}`,
          remainingBalanceOwnerStruct,
          disableOwnerStruct,
          feeBips,
          BigInt(duration),
          recipient,
          amountWei,
        );
      } else {
        hash = await erc20StakingManager.initiateValidatorRegistration(
          nodeIDBytes as `0x${string}`,
          blsPublicKey as `0x${string}`,
          remainingBalanceOwnerStruct,
          disableOwnerStruct,
          feeBips,
          BigInt(duration),
          amountWei,
          recipient,
        );
      }
      setTxHash(hash);

      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      // Extract validationID from logs
      let extractedValidationID: string | null = null;
      try {
        const validationIDTopic = receipt.logs.find((log) => log.topics[0]?.toLowerCase().includes('validation'));
        if (validationIDTopic && validationIDTopic.topics[1]) {
          extractedValidationID = validationIDTopic.topics[1];
          setValidationID(extractedValidationID);
        }
      } catch {
        // Non-critical
      }

      onSuccess({
        txHash: hash,
        validationID: extractedValidationID || '',
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorState(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Preflight checklist — shown when the nodeID is entered and registration is blocked */}
      {nodeID && !preflight.isLoading && preflight.checks.register.status !== 'met' && (
        <ValidatorPreflightChecklist preflight={preflight} currentFlow="register" />
      )}

      {/* Gate the form when the node is already registered */}
      <LockedContent
        isUnlocked={!nodeID || (!preflight.isLoading && preflight.checks.register.status === 'met')}
        lockedMessage="This node is already registered. See the status above for next steps."
      >
        {/* Contract parameters with presets */}
        <div className="space-y-3">
          <Input
            label="Stake Amount"
            value={stakeAmount}
            onChange={setStakeAmount}
            type="number"
            min="0"
            step="0.01"
            placeholder={contractSettings?.minimumStakeAmount || '1000'}
            disabled={isProcessing || isApproving}
            error={stakeError}
            helperText={
              !stakeError && contractSettings
                ? `Min: ${contractSettings.minimumStakeAmount} — Max: ${contractSettings.maximumStakeAmount}`
                : !stakeError
                  ? 'Amount of tokens to stake'
                  : undefined
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Delegation Fee (Basis Points)"
              value={delegationFeeBips}
              onChange={setDelegationFeeBips}
              type="number"
              min="0"
              max="10000"
              disabled={isProcessing || isApproving}
              error={delegationFeeError}
              helperText={
                !delegationFeeError && contractSettings
                  ? `Min: ${contractSettings.minimumDelegationFeeBips} bips (${contractSettings.minimumDelegationFeeBips / 100}%)`
                  : !delegationFeeError
                    ? '100 = 1%, 10000 = 100%'
                    : undefined
              }
            />
            <Input
              label="Min Stake Duration (seconds)"
              value={minStakeDuration}
              onChange={setMinStakeDuration}
              type="number"
              min="0"
              disabled={isProcessing || isApproving}
              error={durationError}
              helperText={
                !durationError && contractSettings
                  ? `Min: ${contractSettings.minimumStakeDuration}s`
                  : !durationError
                    ? '86400 = 1 day'
                    : undefined
              }
            />
          </div>

          <Input
            label="Reward Recipient"
            value={rewardRecipient}
            onChange={setRewardRecipient}
            placeholder="0x..."
            disabled={isProcessing || isApproving}
            helperText="EVM address that receives staking rewards. Defaults to connected wallet."
          />
        </div>

        {/* ERC20: approve then register in sequence */}
        {!isNative && resolvedErc20Address ? (
          <div className="flex gap-2">
            <Button
              onClick={handleApproveERC20}
              disabled={isApproving || isProcessing || !stakeAmount || hasValidationErrors}
              loading={isApproving}
              variant="secondary"
            >
              1. Approve Tokens
            </Button>
            <Button
              onClick={handleInitiateRegistration}
              disabled={
                isProcessing ||
                isApproving ||
                !stakeAmount ||
                !!txHash ||
                hasValidationErrors ||
                isPreflightBlocked ||
                preflight.isLoading
              }
              loading={isProcessing}
              variant="primary"
            >
              2. Register Validator
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleInitiateRegistration}
            disabled={
              isProcessing || isApproving || !stakeAmount || !!txHash || hasValidationErrors || isPreflightBlocked
            }
            loading={isProcessing}
            variant="primary"
          >
            Initiate Validator Registration
          </Button>
        )}
      </LockedContent>

      {txHash && validationID && <Success label="Validation ID" value={validationID} />}
    </div>
  );
};

export default InitiateValidatorRegistration;
