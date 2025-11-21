import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { bytesToHex, hexToBytes } from 'viem';
import nativeTokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import { GetRegistrationJustification } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification';
import { packL1ValidatorWeightMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

interface CompleteDelegatorRegistrationProps {
    subnetIdL1: string;
    delegationID: string;
    pChainTxId: string;
    stakingManagerAddress: string;
    signingSubnetId: string;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

const CompleteDelegatorRegistration: React.FC<CompleteDelegatorRegistrationProps> = ({
    subnetIdL1,
    delegationID,
    pChainTxId,
    stakingManagerAddress,
    signingSubnetId,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, publicClient, avalancheNetworkID, walletEVMAddress } = useWalletStore();
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const { notify } = useConsoleNotifications();
    const viemChain = useViemChainStore();

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [transactionHash, setTransactionHash] = useState<string | null>(null);

    const handleCompleteDelegation = async () => {
        setErrorState(null);
        setSuccessMessage(null);

        if (!pChainTxId.trim()) {
            setErrorState("P-Chain transaction ID is required.");
            onError("P-Chain transaction ID is required.");
            return;
        }

        if (!delegationID || delegationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            setErrorState("Valid delegation ID is required.");
            onError("Valid delegation ID is required.");
            return;
        }

        if (!subnetIdL1) {
            setErrorState("L1 Subnet ID is required. Please select a subnet first.");
            onError("L1 Subnet ID is required. Please select a subnet first.");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager address is not set. Check L1 Subnet selection.");
            onError("Staking Manager address is not set. Check L1 Subnet selection.");
            return;
        }

        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        setIsProcessing(true);
        try {
            // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
            const weightMessageData = await coreWalletClient.extractL1ValidatorWeightMessage({
                txId: pChainTxId
            });

            // Step 2: Get justification for the validation (using the extracted validation ID)
            const justification = await GetRegistrationJustification(
                weightMessageData.validationID,
                subnetIdL1,
                publicClient
            );

            if (!justification) {
                throw new Error("No justification logs found for this validation ID");
            }

            // Step 3: Create P-Chain warp signature using the extracted weight message data
            const warpValidationID = hexToBytes(weightMessageData.validationID as `0x${string}`);
            const warpNonce = weightMessageData.nonce;
            const warpWeight = weightMessageData.weight;

            const weightMessage = packL1ValidatorWeightMessage(
                {
                    validationID: warpValidationID,
                    nonce: warpNonce,
                    weight: warpWeight,
                },
                avalancheNetworkID,
                "11111111111111111111111111111111LpoYY" // always use P-Chain ID
            );

            const aggregateSignaturePromise = aggregateSignature({
                message: bytesToHex(weightMessage),
                justification: bytesToHex(justification),
                signingSubnetId: signingSubnetId || subnetIdL1,
                quorumPercentage: 67,
            });
            notify({
                type: 'local',
                name: 'Aggregate Signatures'
            }, aggregateSignaturePromise);
            const signature = await aggregateSignaturePromise;

            // Step 4: Complete the delegator registration on EVM
            const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
            const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: nativeTokenStakingManagerAbi.abi,
                functionName: "completeDelegatorRegistration",
                args: [delegationID as `0x${string}`, 0], // delegationID and messageIndex (0)
                accessList,
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Complete Delegator Registration'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            const finalReceipt = await publicClient.waitForTransactionReceipt({ hash });
            if (finalReceipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${finalReceipt.status}`);
            }

            setTransactionHash(hash);
            const successMsg = `Delegator registration completed successfully.`;
            setSuccessMessage(successMsg);
            onSuccess(successMsg);
        } catch (err: any) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorState(`Failed to complete delegator registration: ${message}`);
            onError(`Failed to complete delegator registration: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Don't render if no subnet is selected
    if (!subnetIdL1) {
        return (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Please select an L1 subnet first.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p><strong>Delegation ID:</strong> {delegationID}</p>
                <p><strong>P-Chain Tx ID:</strong> {pChainTxId}</p>
            </div>

            <Button
                onClick={handleCompleteDelegation}
                disabled={isProcessing || !!successMessage || !pChainTxId || !delegationID}
            >
                {isProcessing ? 'Processing...' : 'Sign & Complete Delegator Registration'}
            </Button>

            {transactionHash && (
                <Success
                    label="Transaction Hash"
                    value={transactionHash}
                />
            )}
        </div>
    );
};

export default CompleteDelegatorRegistration;