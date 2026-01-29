import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp';
import { hexToBytes, bytesToHex } from 'viem';
import validatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import poaManagerAbi from '@/contracts/icm-contracts/compiled/PoAManager.json';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { GetRegistrationJustification } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification';
import { packL1ValidatorWeightMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

export type WeightUpdateType = 'ChangeWeight' | 'Delegation';
export type OwnerType = 'PoAManager' | 'StakingManager' | 'EOA' | null;
export type TokenType = 'native' | 'erc20';

export interface CompletePChainWeightUpdateProps {
    subnetIdL1: string;
    pChainTxId?: string;
    signingSubnetId?: string;
    onSuccess: (data: { txHash: string; message: string }) => void;
    onError: (message: string) => void;
    
    // Weight update type
    updateType: WeightUpdateType;
    managerAddress: string;
    
    // For Delegation: requires delegation ID
    delegationID?: string;
    
    // For Delegation: token type
    tokenType?: TokenType;
    
    // For ChangeWeight: ownership and multisig
    isContractOwner?: boolean | null;
    contractOwner?: string | null;
    isLoadingOwnership?: boolean;
    ownerType?: OwnerType;
}

/**
 * Shared component for completing weight updates on the EVM side.
 * Used by:
 * - ChangeWeight (permissioned L1s) - calls completeValidatorWeightUpdate
 * - Delegation (permissionless L1s) - calls completeDelegatorRegistration
 */
const CompletePChainWeightUpdate: React.FC<CompletePChainWeightUpdateProps> = ({
    subnetIdL1,
    pChainTxId,
    signingSubnetId,
    onSuccess,
    onError,
    updateType,
    managerAddress,
    delegationID,
    tokenType = 'native',
    isContractOwner,
    contractOwner,
    isLoadingOwnership,
    ownerType,
}) => {
    const { coreWalletClient, publicClient, avalancheNetworkID, walletEVMAddress } = useWalletStore();
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const { notify } = useConsoleNotifications();
    const viemChain = useViemChainStore();
    
    const [pChainTxIdState, setPChainTxIdState] = useState(pChainTxId || '');
    const [delegationIDState, setDelegationIDState] = useState(delegationID || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [updateComplete, setUpdateComplete] = useState(false);
    const [pChainSignature, setPChainSignature] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<{
        validationID: string;
        nonce: bigint;
        weight: bigint;
    } | null>(null);

    // Configuration based on update type
    const isDelegation = updateType === 'Delegation';
    const isChangeWeight = updateType === 'ChangeWeight';
    const useMultisig = ownerType === 'PoAManager';
    
    // Select ABI based on update type
    const getContractAbi = () => {
        if (isDelegation) {
            return tokenType === 'native' 
                ? NativeTokenStakingManager.abi 
                : ERC20TokenStakingManager.abi;
        }
        // ChangeWeight
        return useMultisig ? poaManagerAbi.abi : validatorManagerAbi.abi;
    };
    
    // Determine target contract address
    const getTargetAddress = (): string => {
        if (isChangeWeight && useMultisig && contractOwner) {
            return contractOwner;
        }
        return managerAddress;
    };

    const contractAbi = getContractAbi();
    const targetAddress = getTargetAddress();
    const typeLabel = isDelegation 
        ? `Delegation (${tokenType === 'native' ? 'Native Token' : 'ERC20 Token'})` 
        : 'Weight Change';

    // Initialize state with prop values when they become available
    useEffect(() => {
        if (pChainTxId && !pChainTxIdState) {
            setPChainTxIdState(pChainTxId);
        }
    }, [pChainTxId, pChainTxIdState]);

    useEffect(() => {
        if (delegationID && !delegationIDState) {
            setDelegationIDState(delegationID);
        }
    }, [delegationID, delegationIDState]);

    const validateInputs = (): boolean => {
        if (!pChainTxIdState.trim()) {
            setErrorState("P-Chain transaction ID is required.");
            onError("P-Chain transaction ID is required.");
            return false;
        }
        if (!subnetIdL1) {
            setErrorState("L1 Subnet ID is required.");
            onError("L1 Subnet ID is required.");
            return false;
        }
        if (!managerAddress) {
            setErrorState("Manager address is required.");
            onError("Manager address is required.");
            return false;
        }
        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return false;
        }
        
        // Delegation-specific validation
        if (isDelegation && !delegationIDState.trim()) {
            setErrorState("Delegation ID is required.");
            onError("Delegation ID is required.");
            return false;
        }
        
        // ChangeWeight-specific ownership checks
        if (isChangeWeight) {
            if (isContractOwner === false && !useMultisig) {
                setErrorState("You are not the contract owner. Please contact the contract owner.");
                onError("You are not the contract owner. Please contact the contract owner.");
                return false;
            }
            if (useMultisig && !contractOwner?.trim()) {
                setErrorState("PoAManager address could not be fetched.");
                onError("PoAManager address could not be fetched.");
                return false;
            }
        }
        
        return true;
    };

    const handleCompleteWeightUpdate = async () => {
        setErrorState(null);
        setTxHash(null);
        setUpdateComplete(false);
        setPChainSignature(null);
        setExtractedData(null);

        if (!validateInputs()) return;

        setIsProcessing(true);
        try {
            // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
            const weightMessageData = await coreWalletClient!.extractL1ValidatorWeightMessage({
                txId: pChainTxIdState
            });

            setExtractedData({
                validationID: weightMessageData.validationID,
                nonce: weightMessageData.nonce,
                weight: weightMessageData.weight
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
                "11111111111111111111111111111111LpoYY"
            );

            // Step 3: Get justification (only for ChangeWeight, delegation doesn't need it)
            let justification: Uint8Array | undefined;
            if (isChangeWeight) {
                const fetchedJustification = await GetRegistrationJustification(
                    weightMessageData.validationID,
                    subnetIdL1,
                    publicClient!
                );

                if (!fetchedJustification) {
                    throw new Error("No justification logs found for this validation ID");
                }
                justification = fetchedJustification;
            }

            // Step 4: Aggregate P-Chain signature
            const aggregateSignaturePromise = aggregateSignature({
                message: bytesToHex(l1ValidatorWeightMessage),
                ...(justification && { justification: bytesToHex(justification) }),
                signingSubnetId: signingSubnetId || subnetIdL1,
                quorumPercentage: 67,
            });
            
            notify({
                type: 'local',
                name: 'Aggregate Signatures'
            }, aggregateSignaturePromise);
            
            const signature = await aggregateSignaturePromise;
            setPChainSignature(signature.signedMessage);

            // Step 5: Complete the weight update on EVM
            const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
            const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

            // Different function calls based on update type
            const functionName = isDelegation ? "completeDelegatorRegistration" : "completeValidatorWeightUpdate";
            const args = isDelegation 
                ? [delegationIDState as `0x${string}`, 0] // delegationID and messageIndex
                : [0]; // messageIndex only

            const writePromise = coreWalletClient!.writeContract({
                address: targetAddress as `0x${string}`,
                abi: contractAbi,
                functionName,
                args,
                accessList,
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: isDelegation ? 'Complete Delegation' : 'Complete Weight Update'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            const receipt = await publicClient!.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            setUpdateComplete(true);
            const successMsg = isDelegation 
                ? 'Delegation completed successfully! You are now delegating to the validator.'
                : `Validator weight changed to ${weightMessageData.weight.toString()}.`;
            onSuccess({ txHash: hash, message: successMsg });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('InvalidDelegationID')) {
                message = 'Invalid delegation ID. The delegation may not have been initiated yet.';
            } else if (message.includes('InvalidWarpMessage')) {
                message = 'Invalid warp message. Ensure the P-Chain transaction was successful.';
            } else if (message.includes('DelegatorAlreadyRegistered')) {
                message = 'This delegation has already been completed.';
            } else if (message.includes('not found') && message.includes('P-Chain')) {
                message = 'P-Chain transaction not found. Please verify the transaction ID.';
            }

            const errorPrefix = isDelegation ? 'Failed to complete delegation' : 'Failed to complete weight change';
            setErrorState(`${errorPrefix}: ${message}`);
            onError(`${errorPrefix}: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!subnetIdL1) {
        return (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Please select an L1 subnet first.
            </div>
        );
    }

    const isButtonDisabled = isProcessing || 
        !!txHash || 
        !pChainTxIdState.trim() || 
        (isDelegation && !delegationIDState.trim()) ||
        isLoadingOwnership ||
        (isChangeWeight && isContractOwner === false && !useMultisig);

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Complete {typeLabel}
                </h3>

                <div className="space-y-3">
                    {isDelegation && (
                        <Input
                            label="Delegation ID"
                            value={delegationIDState}
                            onChange={setDelegationIDState}
                            placeholder="0x..."
                            disabled={isProcessing}
                            helperText="The delegation ID from the initiation step"
                        />
                    )}

                    <Input
                        label="P-Chain Transaction ID"
                        value={pChainTxIdState}
                        onChange={setPChainTxIdState}
                        placeholder="Enter the P-Chain transaction ID from the previous step"
                        disabled={isProcessing}
                        helperText={`The transaction ID from the P-Chain ${isDelegation ? 'weight update' : 'SetL1ValidatorWeightTx'}`}
                    />
                </div>
            </div>

            {extractedData && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Extracted Weight Update Data
                    </h4>
                    <div className="space-y-1 text-xs font-mono">
                        <p><span className="text-blue-600 dark:text-blue-400">Validation ID:</span> {extractedData.validationID.slice(0, 18)}...</p>
                        <p><span className="text-blue-600 dark:text-blue-400">New Weight:</span> {extractedData.weight.toString()}</p>
                        <p><span className="text-blue-600 dark:text-blue-400">Nonce:</span> {extractedData.nonce.toString()}</p>
                    </div>
                </div>
            )}

            {pChainSignature && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-700 dark:text-green-300">
                        P-Chain signature aggregated successfully
                    </p>
                </div>
            )}

            {isLoadingOwnership && (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Checking contract ownership...
                </div>
            )}

            <Alert variant="info">
                <p className="text-sm">
                    <strong>Before completing {isDelegation ? 'delegation' : 'weight change'}:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Ensure the P-Chain transaction has been confirmed</li>
                    <li>Wait a few minutes for the transaction to propagate</li>
                    <li>The warp message will be aggregated and submitted</li>
                    <li>Once completed, the {isDelegation ? 'delegation' : 'weight change'} will be active</li>
                </ul>
            </Alert>

            <Button
                onClick={handleCompleteWeightUpdate}
                disabled={isButtonDisabled}
                loading={isProcessing}
            >
                {isLoadingOwnership ? 'Checking ownership...' : (isProcessing ? 'Processing...' : `Complete ${isDelegation ? 'Delegation' : 'Weight Change'}`)}
            </Button>

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {updateComplete && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                <strong>Success!</strong> {isDelegation 
                                    ? 'Your delegation is now active. You will earn rewards based on the validator\'s performance.'
                                    : 'The validator weight has been updated successfully.'}
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CompletePChainWeightUpdate;
