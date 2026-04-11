import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { hexToBytes, bytesToHex } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/validator-manager/packWarp';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { packL1ValidatorWeightMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';

type TokenType = 'native' | 'erc20';

interface CompleteDelegatorRemovalProps {
  delegationID: string;
  stakingManagerAddress: string;
  tokenType: TokenType;
  subnetIdL1: string;
  signingSubnetId?: string;
  pChainTxId?: string;
  onSuccess: (data: { txHash: string; message: string }) => void;
  onError: (message: string) => void;
}

const CompleteDelegatorRemoval: React.FC<CompleteDelegatorRemovalProps> = ({
  delegationID,
  stakingManagerAddress,
  tokenType,
  subnetIdL1,
  signingSubnetId,
  pChainTxId: initialPChainTxId,
  onSuccess,
  onError,
}) => {
  const { walletEVMAddress, avalancheNetworkID } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
  const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

  const [pChainTxId, setPChainTxId] = useState<string>(initialPChainTxId || '');
  const [messageIndex, setMessageIndex] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pChainSignature, setPChainSignature] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    validationID: string;
    nonce: bigint;
    weight: bigint;
  } | null>(null);
  const [rewardInfo, setRewardInfo] = useState<{
    stakeReturned: string;
    rewardsDistributed: boolean;
  } | null>(null);

  const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
  const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

  // Update pChainTxId when prop changes
  useEffect(() => {
    if (initialPChainTxId && initialPChainTxId !== pChainTxId) {
      setPChainTxId(initialPChainTxId);
    }
  }, [initialPChainTxId]);

  const handleCompleteRemoval = async () => {
    setErrorState(null);
    setTxHash(null);
    setRewardInfo(null);
    setPChainSignature(null);
    setExtractedData(null);

    if (!walletClient || !chainPublicClient || !viemChain) {
      setErrorState('Wallet or chain configuration is not properly initialized.');
      onError('Wallet or chain configuration is not properly initialized.');
      return;
    }

    if (!delegationID || delegationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setErrorState('Valid delegation ID is required.');
      onError('Valid delegation ID is required.');
      return;
    }

    if (!stakingManagerAddress) {
      setErrorState('Staking Manager address is required.');
      onError('Staking Manager address is required.');
      return;
    }

    if (!pChainTxId.trim()) {
      setErrorState('P-Chain transaction ID is required.');
      onError('P-Chain transaction ID is required.');
      return;
    }

    if (!subnetIdL1) {
      setErrorState('L1 Subnet ID is required.');
      onError('L1 Subnet ID is required.');
      return;
    }

    const msgIndex = parseInt(messageIndex);
    if (isNaN(msgIndex) || msgIndex < 0) {
      setErrorState('Message index must be a non-negative number.');
      onError('Message index must be a non-negative number.');
      return;
    }

    setIsProcessing(true);
    try {
      // Get delegation info before removal to show stake amount
      let delegationWeight = '0';
      try {
        const delegatorInfo = (await chainPublicClient.readContract({
          address: stakingManagerAddress as `0x${string}`,
          abi: contractAbi,
          functionName: 'getDelegatorInfo',
          args: [delegationID as `0x${string}`],
        })) as any;

        delegationWeight = delegatorInfo.weight?.toString() || '0';
      } catch {
        // Continue without delegation weight
      }

      // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
      const coreWalletClient = useWalletStore.getState().coreWalletClient;
      if (!coreWalletClient) {
        throw new Error('This operation requires Core Wallet');
      }
      const weightMessageData = await coreWalletClient.extractL1ValidatorWeightMessage({
        txId: pChainTxId,
      });

      setExtractedData({
        validationID: weightMessageData.validationID,
        nonce: weightMessageData.nonce,
        weight: weightMessageData.weight,
      });

      // Step 2: Create L1ValidatorWeightMessage for completion
      const validationIDBytes = hexToBytes(weightMessageData.validationID as `0x${string}`);
      const l1ValidatorWeightMessage = packL1ValidatorWeightMessage(
        {
          validationID: validationIDBytes,
          nonce: weightMessageData.nonce,
          weight: weightMessageData.weight,
        },
        avalancheNetworkID,
        '11111111111111111111111111111111LpoYY',
      );

      // Step 3: Aggregate P-Chain signature
      const aggregateSignaturePromise = aggregateSignature({
        message: bytesToHex(l1ValidatorWeightMessage),
        signingSubnetId: signingSubnetId || subnetIdL1,
      });

      notify(
        {
          type: 'local',
          name: 'Aggregate P-Chain Signatures',
        },
        aggregateSignaturePromise,
      );

      const signature = await aggregateSignaturePromise;
      setPChainSignature(signature.signedMessage);

      // Step 4: Package warp message into access list
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

      // Step 5: Call completeDelegatorRemoval via hook with warp message
      const hash =
        tokenType === 'native'
          ? await nativeStakingManager.completeDelegatorRemoval(delegationID as `0x${string}`, msgIndex, accessList)
          : await erc20StakingManager.completeDelegatorRemoval(delegationID as `0x${string}`, msgIndex, accessList);

      setTxHash(hash);

      // Wait for confirmation
      const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      // Check for DelegatorRemovalCompleted event
      const hasRemovalEvent = receipt.logs.some(
        (log) =>
          log.topics[0]?.toLowerCase().includes('delegat') &&
          (log.topics[0]?.toLowerCase().includes('removal') || log.topics[0]?.toLowerCase().includes('complete')),
      );

      setRewardInfo({
        stakeReturned: delegationWeight,
        rewardsDistributed: hasRemovalEvent,
      });

      const successMsg = hasRemovalEvent
        ? 'Delegation removal completed and rewards distributed successfully (minus delegation fees).'
        : 'Delegation removal completed successfully.';

      onSuccess({
        txHash: hash,
        message: successMsg,
      });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      // Provide more helpful error messages
      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('InvalidDelegationID')) {
        message = 'Invalid delegation ID. The delegation may not exist or removal was not initiated.';
      } else if (message.includes('DelegatorNotRemovable')) {
        message =
          'Delegator cannot be removed yet. Ensure you have initiated removal and submitted the P-Chain transaction first.';
      } else if (message.includes('InvalidDelegatorStatus')) {
        message =
          'Delegation is not in the correct status for completion. Check if removal was initiated and P-Chain transaction submitted.';
      } else if (message.includes('not found') && message.toLowerCase().includes('p-chain')) {
        message = 'P-Chain transaction not found. Please verify the transaction ID.';
      } else if (message.includes('InvalidWarpMessage')) {
        message = 'Invalid warp message. Ensure the P-Chain transaction was successful.';
      }

      setErrorState(`Failed to complete delegator removal: ${message}`);
      onError(`Failed to complete delegator removal: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isButtonDisabled = isProcessing || !!txHash || !pChainTxId.trim();

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Complete Removal ({tokenLabel} Staking)
        </h3>

        <div className="space-y-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Delegation ID:</strong> {delegationID}
            </p>
          </div>

          <Input
            label="P-Chain Transaction ID"
            value={pChainTxId}
            onChange={setPChainTxId}
            placeholder="Enter the P-Chain transaction ID from the previous step"
            disabled={isProcessing || !!txHash}
            helperText="The transaction ID from the P-Chain weight update step"
          />

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

      {extractedData && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Extracted Weight Update Data</h4>
          <div className="space-y-1 text-xs font-mono">
            <p>
              <span className="text-blue-600 dark:text-blue-400">Validation ID:</span>{' '}
              {extractedData.validationID.slice(0, 18)}...
            </p>
            <p>
              <span className="text-blue-600 dark:text-blue-400">New Weight:</span> {extractedData.weight.toString()}
            </p>
            <p>
              <span className="text-blue-600 dark:text-blue-400">Nonce:</span> {extractedData.nonce.toString()}
            </p>
          </div>
        </div>
      )}

      {pChainSignature && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-700 dark:text-green-300">P-Chain signature aggregated successfully</p>
        </div>
      )}

      <Alert variant="info">
        <p className="text-sm">
          <strong>What happens when you complete removal:</strong>
        </p>
        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
          <li>Extract weight update from P-Chain transaction</li>
          <li>Aggregate signatures from L1 validators (67% quorum)</li>
          <li>Your delegated stake will be returned</li>
          <li>Rewards will be calculated and distributed based on validator uptime</li>
          <li>Delegation fees will be deducted from your rewards</li>
        </ul>
      </Alert>

      <Button onClick={handleCompleteRemoval} disabled={isButtonDisabled} loading={isProcessing}>
        {isProcessing ? 'Processing...' : 'Complete Delegator Removal & Receive Rewards'}
      </Button>

      {txHash && rewardInfo && rewardInfo.rewardsDistributed && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
          <p className="text-sm text-green-800 dark:text-green-200">
            <strong>Success!</strong> Delegation has been removed and rewards have been distributed.
          </p>
          {rewardInfo.stakeReturned !== '0' && (
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">
              <strong>Stake Returned:</strong> {rewardInfo.stakeReturned} (weight units)
            </p>
          )}
        </div>
      )}

      <Alert variant="warning">
        <p className="text-sm">
          <strong>Note:</strong> Delegation fees are deducted from your rewards before distribution. These fees go to
          the validator you delegated to and can be claimed separately by the validator.
        </p>
      </Alert>
    </div>
  );
};

export default CompleteDelegatorRemoval;
