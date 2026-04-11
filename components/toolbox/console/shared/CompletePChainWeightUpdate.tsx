import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp';
import { hexToBytes, bytesToHex, encodeFunctionData, Abi } from 'viem';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { GetRegistrationJustification } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification';
import { packL1ValidatorWeightMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useValidatorManager, usePoAManager, useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { fetchL1ValidatorWeightData } from './fetchL1ValidatorWeightData';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Check } from 'lucide-react';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { generateCastSendCommand } from '@/components/toolbox/utils/castCommand';

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
    const { avalancheNetworkID, isTestnet } = useWalletStore();
    const walletType = useWalletStore((s) => s.walletType);
    const isCoreWallet = walletType === 'core';
    const chainPublicClient = useChainPublicClient();
    const viemChain = useViemChainStore();
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const { notify } = useConsoleNotifications();
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
    const [castAccessList, setCastAccessList] = useState<any[] | null>(null);

    // Configuration based on update type
    const isDelegation = updateType === 'Delegation';
    const isChangeWeight = updateType === 'ChangeWeight';
    const useMultisig = ownerType === 'PoAManager';

    // Initialize hooks for all possible manager types
    const validatorManager = useValidatorManager(
        (isChangeWeight && !useMultisig) ? managerAddress : null
    );
    const poaManager = usePoAManager(
        (isChangeWeight && useMultisig && contractOwner) ? contractOwner : null
    );
    const nativeStakingManager = useNativeTokenStakingManager(
        (isDelegation && tokenType === 'native') ? managerAddress : null
    );
    const erc20StakingManager = useERC20TokenStakingManager(
        (isDelegation && tokenType === 'erc20') ? managerAddress : null
    );

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
        if (!chainPublicClient) {
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
            const weightMessageData = await fetchL1ValidatorWeightData(pChainTxIdState, isTestnet);

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
                    chainPublicClient!
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
            setCastAccessList(accessList);

            // Non-Core wallet: stop here and show cast command
            if (!isCoreWallet) {
                return;
            }

            // Call appropriate hook based on update type
            let hash: string;
            if (isDelegation) {
                hash = tokenType === 'native'
                    ? await nativeStakingManager.completeDelegatorRegistration(0, delegationIDState as `0x${string}`, accessList)
                    : await erc20StakingManager.completeDelegatorRegistration(0, delegationIDState as `0x${string}`, accessList);
            } else {
                // ChangeWeight
                hash = useMultisig
                    ? await poaManager.completeValidatorWeightUpdate(0, accessList)
                    : await validatorManager.completeValidatorWeightUpdate(0, accessList);
            }

            setTxHash(hash);

            const receipt = await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            setUpdateComplete(true);
            const successMsg = isDelegation
                ? 'Delegation completed successfully! You are now delegating to the validator.'
                : `Validator weight changed to ${weightMessageData.weight.toString()}.`;
            onSuccess({ txHash: hash, message: successMsg });
        } catch (err: any) {
            const message = err instanceof Error ? err.message : String(err);

            const errorPrefix = isDelegation ? 'Failed to complete delegation' : 'Failed to complete weight change';
            setErrorState(`${errorPrefix}: ${message}`);
            onError(`${errorPrefix}: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Determine the target contract address for cast command
    const castTargetAddress = (() => {
        if (isDelegation) return managerAddress;
        if (useMultisig && contractOwner) return contractOwner;
        return managerAddress;
    })();

    function generateCastCommand(): string {
        if (!pChainSignature || !castAccessList) return '';
        const rpcUrl = viemChain?.rpcUrls?.default?.http?.[0] || '<L1_RPC_URL>';
        const addr = castTargetAddress || '<CONTRACT_ADDRESS>';

        const calldata = isDelegation
            ? encodeFunctionData({
                abi: NativeTokenStakingManager.abi as Abi,
                functionName: 'completeDelegatorRegistration',
                args: [delegationIDState as `0x${string}`, 0],
            })
            : encodeFunctionData({
                abi: ValidatorManagerABI.abi as Abi,
                functionName: 'completeValidatorWeightUpdate',
                args: [0],
            });

        return generateCastSendCommand({ address: addr, calldata, accessList: castAccessList, rpcUrl });
    }

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
        (isChangeWeight && isContractOwner === false && !useMultisig) ||
        (!isCoreWallet && !!pChainSignature);

    const step1Complete = !!extractedData;
    const step2Complete = !!txHash;

    return (
        <div className="space-y-3">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            {/* Step 1: Enter P-Chain Transaction */}
            <div className={`p-3 rounded-xl border transition-colors ${
                step1Complete
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                    : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            }`}>
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        step1Complete
                            ? "bg-green-500 text-white"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    }`}>
                        {step1Complete ? <Check className="w-3 h-3" /> : "1"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Enter P-Chain Transaction</h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Provide the P-Chain transaction ID to extract the weight update data
                        </p>
                        <div className="mt-2 space-y-3">
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
                        {step1Complete && extractedData && (
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-mono">
                                    <span className="text-green-600 font-sans font-medium">Validation ID:</span>
                                    <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px]">{extractedData.validationID}</code>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-green-600 dark:text-green-400 font-medium">New Weight:</span>
                                    <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{extractedData.weight.toString()}</code>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-green-600 dark:text-green-400 font-medium">Nonce:</span>
                                    <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{extractedData.nonce.toString()}</code>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 2: Aggregate & Complete */}
            <div className={`p-3 rounded-xl border transition-colors ${
                step2Complete
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                    : step1Complete
                    ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
                    : "bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200/50 dark:border-zinc-800 opacity-50"
            }`}>
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        step2Complete
                            ? "bg-green-500 text-white"
                            : step1Complete
                            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                            : "bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400"
                    }`}>
                        {step2Complete ? <Check className="w-3 h-3" /> : "2"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-medium ${step1Complete ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"}`}>
                            Aggregate & Complete
                        </h3>
                        <p className={`mt-1 text-xs ${step1Complete ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}>
                            Aggregate BLS signatures and submit the EVM transaction to complete the {isDelegation ? 'delegation' : 'weight change'}
                        </p>

                        {pChainSignature && !step2Complete && (
                            <div className="mt-2 flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                <Check className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Signatures aggregated</span>
                            </div>
                        )}

                        {isLoadingOwnership && (
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                Checking contract ownership...
                            </p>
                        )}

                        {step1Complete && !step2Complete && !((!isCoreWallet && pChainSignature)) && (
                            <div className="mt-2">
                                <Button
                                    onClick={handleCompleteWeightUpdate}
                                    disabled={isButtonDisabled}
                                    loading={isProcessing}
                                    className="w-full"
                                >
                                    {isLoadingOwnership ? 'Checking ownership...' : (isProcessing ? 'Processing...' : (isCoreWallet ? `Complete ${isDelegation ? 'Delegation' : 'Weight Change'}` : 'Aggregate Signatures'))}
                                </Button>
                            </div>
                        )}

                        {/* Non-Core wallet: CLI command after aggregation */}
                        {!isCoreWallet && pChainSignature && !txHash && (
                            <div className="mt-2 space-y-3">
                                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                    Run this command to complete the {isDelegation ? 'delegation' : 'weight change'}:
                                </p>
                                <DynamicCodeBlock lang="bash" code={generateCastCommand()} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Success */}
            {txHash && (
                <div className="space-y-2">
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
                </div>
            )}
        </div>
    );
};

export default CompletePChainWeightUpdate;
