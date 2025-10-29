import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import nativeTokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import { parseEther, formatEther } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

interface InitiateNativeDelegationProps {
  subnetId: string;
  stakingManagerAddress: string;
  validationID: string;
  onSuccess: (data: { delegationID: string; txHash: string }) => void;
  onError: (message: string) => void;
}

const InitiateNativeDelegation: React.FC<InitiateNativeDelegationProps> = ({
  subnetId,
  stakingManagerAddress,
  validationID,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  
  const [delegationAmount, setDelegationAmount] = useState('');
  const [rewardRecipient, setRewardRecipient] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [delegationID, setDelegationID] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [existingDelegations, setExistingDelegations] = useState<string[]>([]);

  // Set default reward recipient to connected wallet
  useEffect(() => {
    if (walletEVMAddress && !rewardRecipient) {
      setRewardRecipient(walletEVMAddress);
    }
  }, [walletEVMAddress]);

  // Check for existing delegations when validation ID or wallet changes
  useEffect(() => {
    const checkExistingDelegations = async () => {
      if (!publicClient || !stakingManagerAddress || !validationID || !walletEVMAddress) {
        setExistingDelegations([]);
        return;
      }

      setIsLoadingExisting(true);
      try {
        // Query InitiatedDelegatorRegistration events for this validator and delegator
        const logs = await publicClient.getLogs({
          address: stakingManagerAddress as `0x${string}`,
          event: {
            type: 'event',
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
          },
          args: {
            validationID: validationID as `0x${string}`,
            delegatorAddress: walletEVMAddress as `0x${string}`,
          },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        const delegationIDs = logs.map(log => log.topics[1] as string).filter(Boolean);
        setExistingDelegations(delegationIDs);
      } catch (err) {
        console.error('Error checking existing delegations:', err);
        setExistingDelegations([]);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    checkExistingDelegations();
  }, [publicClient, stakingManagerAddress, validationID, walletEVMAddress]);

  const handleResendDelegation = async (delegationIdToResend: string) => {
    setErrorState(null);
    setTxHash(null);

    if (!coreWalletClient || !publicClient || !viemChain) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      return;
    }

    if (!stakingManagerAddress) {
      setErrorState("Staking Manager address is required.");
      return;
    }

    setIsProcessing(true);
    try {
      // Call resendUpdateDelegator to re-emit the warp message
      const writePromise = coreWalletClient.writeContract({
        address: stakingManagerAddress as `0x${string}`,
        abi: nativeTokenStakingManagerAbi.abi,
        functionName: "resendUpdateDelegator",
        args: [delegationIdToResend as `0x${string}`],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      notify({
        type: 'call',
        name: 'Resend Delegator Update'
      }, writePromise, viemChain ?? undefined);

      const hash = await writePromise;
      setTxHash(hash);
      setDelegationID(delegationIdToResend);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      onSuccess({
        delegationID: delegationIdToResend,
        txHash: hash,
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorState(`Failed to resend delegation: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInitiateDelegation = async () => {
    setErrorState(null);
    setTxHash(null);
    setDelegationID(null);

    if (!coreWalletClient || !publicClient || !viemChain) {
      setErrorState("Wallet or chain configuration is not properly initialized.");
      onError("Wallet or chain configuration is not properly initialized.");
      return;
    }

    if (!stakingManagerAddress) {
      setErrorState("Staking Manager address is required.");
      onError("Staking Manager address is required.");
      return;
    }

    if (!validationID || validationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setErrorState("Valid validation ID is required.");
      onError("Valid validation ID is required.");
      return;
    }

    if (!delegationAmount || parseFloat(delegationAmount) <= 0) {
      setErrorState("Delegation amount must be greater than 0.");
      onError("Delegation amount must be greater than 0.");
      return;
    }

    if (!rewardRecipient || !rewardRecipient.startsWith('0x')) {
      setErrorState("Valid reward recipient address is required.");
      onError("Valid reward recipient address is required.");
      return;
    }

    setIsProcessing(true);
    try {
      const delegationAmountWei = parseEther(delegationAmount);

      // Read minimum stake amount from contract
      const minStakeAmount = await publicClient.readContract({
        address: stakingManagerAddress as `0x${string}`,
        abi: nativeTokenStakingManagerAbi.abi,
        functionName: "getStakingManagerSettings",
      }) as any;

      if (delegationAmountWei < minStakeAmount.minimumStakeAmount) {
        const minFormatted = formatEther(minStakeAmount.minimumStakeAmount);
        throw new Error(`Delegation amount must be at least ${minFormatted} tokens`);
      }

      // Call initiateDelegatorRegistration
      const writePromise = coreWalletClient.writeContract({
        address: stakingManagerAddress as `0x${string}`,
        abi: nativeTokenStakingManagerAbi.abi,
        functionName: "initiateDelegatorRegistration",
        args: [validationID as `0x${string}`, rewardRecipient as `0x${string}`],
        value: delegationAmountWei,
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      notify({
        type: 'call',
        name: 'Initiate Delegator Registration'
      }, writePromise, viemChain ?? undefined);

      const hash = await writePromise;
      setTxHash(hash);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      // Extract delegationID from logs
      const initiateDelegatorRegistrationTopic = "0x77499a5603260ef2b34698d88b31f7b1acf28c7b134ad4e3fa636501e6064d77";
      const delegationLog = receipt.logs.find((log) => 
        log.topics[0]?.toLowerCase() === initiateDelegatorRegistrationTopic.toLowerCase()
      );

      if (!delegationLog || !delegationLog.topics[1]) {
        throw new Error("Failed to extract delegation ID from transaction receipt");
      }

      const extractedDelegationID = delegationLog.topics[1];
      setDelegationID(extractedDelegationID);

      onSuccess({
        delegationID: extractedDelegationID,
        txHash: hash,
      });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);
      
      // Provide more helpful error messages
      if (message.includes('Unable to calculate gas limit')) {
        message = 'Transaction would fail. Possible reasons:\n' +
                  '- The validation ID is not a valid PoS validator\n' +
                  '- The validator has reached maximum delegation capacity\n' +
                  '- The validator minimum stake duration has not been met\n' +
                  'Please verify the validation ID and try again.';
      } else if (message.includes('InvalidValidationStatus')) {
        message = 'This validator is not accepting delegations. The validator may not be active or registered yet.';
      } else if (message.includes('InvalidDelegationID')) {
        message = 'Invalid validation ID provided. Please check the validation ID and try again.';
      } else if (message.includes('MaxWeightExceeded')) {
        message = 'This delegation would exceed the maximum allowed weight for this validator.';
      }
      
      setErrorState(`Failed to initiate delegation: ${message}`);
      onError(`Failed to initiate delegation: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {isLoadingExisting && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Checking for existing delegations...
        </div>
      )}

      {existingDelegations.length > 0 && !txHash && (
        <Alert variant="warning">
          <div>
            <p className="font-semibold mb-2">Found {existingDelegations.length} existing delegation(s) to this validator:</p>
            <div className="space-y-2">
              {existingDelegations.map((delId, index) => (
                <div key={delId} className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
                  <code className="text-xs">{delId}</code>
                  <Button
                    onClick={() => handleResendDelegation(delId)}
                    disabled={isProcessing}
                    size="sm"
                  >
                    Resend Warp Message
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Alert>
      )}

      {!txHash && (
        <>
          <Input
            label="Validation ID"
            value={validationID}
            onChange={() => {}} // Read-only, set by parent
            placeholder="Validation ID of the validator to delegate to"
            disabled={true}
          />

          <Input
            label="Delegation Amount (native tokens)"
            value={delegationAmount}
            onChange={setDelegationAmount}
            placeholder="Enter amount to delegate (e.g., 100)"
            type="number"
            step="0.000000001"
            disabled={isProcessing}
          />

          <Input
            label="Reward Recipient Address"
            value={rewardRecipient}
            onChange={setRewardRecipient}
            placeholder="Address to receive delegation rewards"
            disabled={isProcessing}
          />

          <Button
            onClick={handleInitiateDelegation}
            disabled={
              isProcessing || 
              !delegationAmount || 
              !rewardRecipient ||
              !validationID
            }
          >
            {isProcessing ? 'Processing...' : 'Initiate New Delegation'}
          </Button>
        </>
      )}

      {txHash && (
        <>
          <Success
            label="Transaction Hash"
            value={txHash}
          />

          {delegationID && (
            <Success
              label="Delegation ID"
              value={delegationID}
            />
          )}
        </>
      )}
    </div>
  );
};

export default InitiateNativeDelegation;

