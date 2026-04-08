import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { GetRegistrationJustification } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp';
import { hexToBytes, bytesToHex, encodeFunctionData, Abi } from 'viem';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { packL1ValidatorRegistration } from '@/components/toolbox/coreViem/utils/convertWarp';
import { getValidationIdHex } from '@/components/toolbox/coreViem/hooks/getValidationID';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useValidatorManager, usePoAManager, useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { fetchRegisterL1ValidatorData } from './fetchRegisterL1ValidatorData';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

export type ManagerType = 'PoA' | 'PoS-Native' | 'PoS-ERC20';
export type OwnerType = 'PoAManager' | 'StakingManager' | 'EOA' | null;

export interface CompletePChainRegistrationProps {
    subnetIdL1: string;
    pChainTxId?: string;
    validationID?: string;
    signingSubnetId?: string;
    onSuccess: (data: { txHash: string; message: string }) => void;
    onError: (message: string) => void;
    
    // Manager configuration
    managerType: ManagerType;
    managerAddress: string;
    
    // For PoA: ownership and multisig
    ownershipState?: 'contract' | 'currentWallet' | 'differentEOA' | 'loading' | 'error';
    contractOwner?: string | null;
    isLoadingOwnership?: boolean;
    ownerType?: OwnerType;
}

/**
 * Shared component for completing validator registration on the EVM side.
 * Used by:
 * - PoA validator registration (permissioned L1s)
 * - PoS validator registration (permissionless L1s - native + ERC20)
 */
const CompletePChainRegistration: React.FC<CompletePChainRegistrationProps> = ({
    subnetIdL1,
    pChainTxId,
    validationID,
    signingSubnetId,
    onSuccess,
    onError,
    managerType,
    managerAddress,
    ownershipState,
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
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [registrationComplete, setRegistrationComplete] = useState(false);
    const [pChainSignature, setPChainSignature] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<{
        subnetID: string;
        nodeID: string;
        blsPublicKey: string;
        expiry: bigint;
        weight: bigint;
        validationId?: string;
    } | null>(null);
    const [castAccessList, setCastAccessList] = useState<any[] | null>(null);

    // Determine contract configuration based on manager type
    const isPoA = managerType === 'PoA';
    const isPoS = managerType === 'PoS-Native' || managerType === 'PoS-ERC20';
    const useMultisig = ownerType === 'PoAManager';
    const useStakingManager = ownerType === 'StakingManager';

    // Initialize hooks for all possible manager types
    const validatorManager = useValidatorManager(
        (isPoA && !useMultisig && !useStakingManager) ? managerAddress : null
    );
    const poaManager = usePoAManager(
        (isPoA && useMultisig && contractOwner) ? contractOwner : null
    );
    const nativeStakingManager = useNativeTokenStakingManager(
        (managerType === 'PoS-Native' || (isPoA && useStakingManager && contractOwner)) ? (isPoS ? managerAddress : contractOwner || null) : null
    );
    const erc20StakingManager = useERC20TokenStakingManager(
        managerType === 'PoS-ERC20' ? managerAddress : null
    );

    const tokenLabel = managerType === 'PoS-Native' ? 'Native Token' : managerType === 'PoS-ERC20' ? 'ERC20 Token' : 'PoA';

    // Initialize state with prop value when it becomes available
    useEffect(() => {
        if (pChainTxId && !pChainTxIdState) {
            setPChainTxIdState(pChainTxId);
        }
    }, [pChainTxId, pChainTxIdState]);

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
        
        // PoA-specific ownership checks
        if (isPoA) {
            if (ownershipState === 'differentEOA' && !useMultisig && !useStakingManager) {
                setErrorState("You are not the contract owner. Please contact the contract owner.");
                onError("You are not the contract owner. Please contact the contract owner.");
                return false;
            }
            if (useMultisig && !contractOwner?.trim()) {
                setErrorState("PoAManager address could not be fetched.");
                onError("PoAManager address could not be fetched.");
                return false;
            }
            if (useStakingManager && !contractOwner?.trim()) {
                setErrorState("StakingManager address could not be fetched.");
                onError("StakingManager address could not be fetched.");
                return false;
            }
        }
        
        return true;
    };

    const handleCompleteRegistration = async () => {
        setErrorState(null);
        setTxHash(null);
        setRegistrationComplete(false);
        setPChainSignature(null);
        setExtractedData(null);

        if (!validateInputs()) return;

        setIsProcessing(true);
        try {
            // Step 1: Extract RegisterL1ValidatorMessage from P-Chain transaction
            const registrationMessageData = await fetchRegisterL1ValidatorData(pChainTxIdState, isTestnet);

            setExtractedData({
                subnetID: registrationMessageData.subnetID,
                nodeID: registrationMessageData.nodeID,
                blsPublicKey: registrationMessageData.blsPublicKey,
                expiry: registrationMessageData.expiry,
                weight: registrationMessageData.weight
            });

            // Step 2: Get the underlying ValidatorManager address for validation ID query
            let validationIdQueryAddress = managerAddress;
            
            if (isPoS || useStakingManager) {
                try {
                    const queryAddress = isPoS ? managerAddress : contractOwner;
                    const settings = await chainPublicClient!.readContract({
                        address: queryAddress as `0x${string}`,
                        abi: managerType === 'PoS-ERC20' ? ERC20TokenStakingManager.abi : NativeTokenStakingManager.abi,
                        functionName: 'getStakingManagerSettings',
                    }) as any;
                    
                    validationIdQueryAddress = settings.manager;
                } catch (err) {
                    // Failed to get ValidatorManager from settings, use manager address as fallback
                }
            }

            // Step 3: Get validation ID from contract using nodeID
            const validationId = await getValidationIdHex(
                chainPublicClient!,
                validationIdQueryAddress as `0x${string}`,
                registrationMessageData.nodeID
            );

            if (validationId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                throw new Error("No validation ID found for this node. The validator may not have been registered on the L1 yet.");
            }

            setExtractedData(prev => prev ? { ...prev, validationId } : null);

            // Step 4: Create L1ValidatorRegistrationMessage (P-Chain response)
            const validationIDBytes = hexToBytes(validationId);
            const l1ValidatorRegistrationMessage = packL1ValidatorRegistration(
                validationIDBytes,
                true,
                avalancheNetworkID,
                "11111111111111111111111111111111LpoYY"
            );

            // Step 5: Get justification for the validation
            const justification = await GetRegistrationJustification(
                validationId,
                subnetIdL1,
                chainPublicClient!
            );

            if (!justification) {
                throw new Error("No justification logs found for this validation ID. The registration transaction may not have been mined yet.");
            }

            // Step 6: Aggregate P-Chain signature
            const aggregateSignaturePromise = aggregateSignature({
                message: bytesToHex(l1ValidatorRegistrationMessage),
                justification: bytesToHex(justification),
            });
            
            notify({
                type: 'local',
                name: 'Aggregate Signatures'
            }, aggregateSignaturePromise);
            
            const signature = await aggregateSignaturePromise;
            setPChainSignature(signature.signedMessage);

            // Step 7: Complete the validator registration on EVM
            const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
            const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);
            setCastAccessList(accessList);

            // Non-Core wallet: stop here and show cast command
            if (!isCoreWallet) {
                return;
            }

            // Call appropriate hook based on manager type
            let hash: string;
            if (isPoA) {
                if (useMultisig) {
                    hash = await poaManager.completeValidatorRegistration(0, accessList);
                } else if (useStakingManager) {
                    hash = await nativeStakingManager.completeValidatorRegistration(0, accessList);
                } else {
                    hash = await validatorManager.completeValidatorRegistration(0, accessList);
                }
            } else {
                // PoS
                hash = managerType === 'PoS-Native'
                    ? await nativeStakingManager.completeValidatorRegistration(0, accessList)
                    : await erc20StakingManager.completeValidatorRegistration(0, accessList);
            }

            setTxHash(hash);

            const receipt = await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            setRegistrationComplete(true);
            const successMsg = 'Validator registration completed successfully!';
            onSuccess({ txHash: hash, message: successMsg });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('InvalidValidationID')) {
                message = 'Invalid validation ID. The validator may not have been registered on the P-Chain yet.';
            } else if (message.includes('InvalidWarpMessage')) {
                message = 'Invalid warp message. Ensure the P-Chain transaction was successful and wait for confirmation.';
            } else if (message.includes('ValidatorAlreadyRegistered')) {
                message = 'This validator has already been registered.';
            } else if (message.includes('not found') && message.includes('P-Chain')) {
                message = 'P-Chain transaction not found. Please verify the transaction ID and wait a few minutes.';
            }

            setErrorState(`Failed to complete validator registration: ${message}`);
            onError(`Failed to complete validator registration: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Determine the target contract address for cast command
    const castTargetAddress = (() => {
        if (isPoA) {
            if (useMultisig && contractOwner) return contractOwner;
            if (useStakingManager && contractOwner) return contractOwner;
            return managerAddress;
        }
        return managerAddress;
    })();

    function generateCastCommand(): string {
        if (!pChainSignature || !castAccessList) return '';
        const rpcUrl = viemChain?.rpcUrls?.default?.http?.[0] || '<L1_RPC_URL>';
        const addr = castTargetAddress || '<CONTRACT_ADDRESS>';

        const calldata = encodeFunctionData({
            abi: ValidatorManagerABI.abi as Abi,
            functionName: 'completeValidatorRegistration',
            args: [0],
        });

        const accessListJson = JSON.stringify(castAccessList);

        return [
            `cast send ${addr} \\`,
            `  ${calldata} \\`,
            `  --access-list '${accessListJson}' \\`,
            `  --gas-limit 2000000 \\`,
            `  --rpc-url ${rpcUrl} \\`,
            `  --private-key $PRIVATE_KEY`,
        ].join('\n');
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
        isLoadingOwnership ||
        (isPoA && ownershipState === 'differentEOA' && !useMultisig && !useStakingManager) ||
        (!isCoreWallet && !!pChainSignature);

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Complete Registration ({tokenLabel})
                </h3>

                <div className="space-y-3">
                    {validationID && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <p><strong>Validation ID:</strong> {validationID}</p>
                        </div>
                    )}

                    <Input
                        label="P-Chain Transaction ID"
                        value={pChainTxIdState}
                        onChange={setPChainTxIdState}
                        placeholder="Enter the P-Chain transaction ID from the previous step"
                        disabled={isProcessing}
                        helperText="The transaction ID from the P-Chain validator registration"
                    />
                </div>
            </div>

            {extractedData && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Extracted Registration Data
                    </h4>
                    <div className="space-y-1 text-xs font-mono">
                        <p><span className="text-blue-600 dark:text-blue-400">Node ID:</span> {extractedData.nodeID}</p>
                        <p><span className="text-blue-600 dark:text-blue-400">Weight:</span> {extractedData.weight.toString()}</p>
                        {extractedData.validationId && (
                            <p><span className="text-blue-600 dark:text-blue-400">Validation ID:</span> {extractedData.validationId}</p>
                        )}
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

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ensure the P-Chain registration is confirmed before proceeding. The warp message will be aggregated and submitted to complete registration.
            </p>

            <Button
                onClick={handleCompleteRegistration}
                disabled={isButtonDisabled}
                loading={isProcessing}
            >
                {isLoadingOwnership ? 'Checking ownership...' : (isProcessing ? 'Processing...' : (isCoreWallet ? 'Complete Validator Registration' : 'Aggregate Signatures'))}
            </Button>

            {!isCoreWallet && pChainSignature && !txHash && (
                <div className="space-y-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Signatures aggregated. Run this command to complete the validator registration:
                        </p>
                    </div>
                    <DynamicCodeBlock lang="bash" code={generateCastCommand()} />
                </div>
            )}

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {registrationComplete && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                <strong>Success!</strong> Your validator is now registered and active on the L1.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CompletePChainRegistration;
