"use client";

import { useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { ResultField } from "../../components/ResultField";
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { Container } from "../../components/Container";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import SelectSubnetId from "../../components/SelectSubnetId";
import { useValidatorManagerDetails } from "../hooks/useValidatorManagerDetails";
import { ValidatorManagerDetails } from "../../components/ValidatorManagerDetails";
import { TransactionReceipt } from "viem";
import { AlertCircle, Info } from "lucide-react";
import { CheckWalletRequirements } from "@/components/CheckWalletRequirements"
import { WalletRequirementsConfigKey } from "../../hooks/useWalletRequirements";

export default function TransferOwnership() {
    const { showBoundary } = useErrorBoundary();
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const [isTransferring, setIsTransferring] = useState(false);
    const [selectedSubnetId, setSelectedSubnetId] = useState<string>('');
    const [newOwnerAddress, setNewOwnerAddress] = useState<string>('');
    const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
    const [isNewOwnerContract, setIsNewOwnerContract] = useState(false);
    const [isCheckingNewOwner, setIsCheckingNewOwner] = useState(false);
    const viemChain = useViemChainStore();

    const validatorManagerData = useValidatorManagerDetails({ subnetId: selectedSubnetId });
    const {
        validatorManagerAddress,
        error: validatorManagerError,
        isLoading: isLoadingValidatorManager,
        contractOwner,
        isLoadingOwnership,
        isOwnerContract
    } = validatorManagerData;

    // Ownership check
    const isCurrentUserOwner = contractOwner && walletEVMAddress &&
        contractOwner.toLowerCase() === walletEVMAddress.toLowerCase();

    // Only show error if user is definitely not the owner
    const showOwnershipError = !isLoadingOwnership &&
        contractOwner &&
        walletEVMAddress &&
        !isCurrentUserOwner &&
        !isOwnerContract;

    // Check if new owner address is a contract
    useEffect(() => {
        const checkNewOwnerType = async () => {
            if (!newOwnerAddress.trim() || !publicClient) {
                setIsNewOwnerContract(false);
                setIsCheckingNewOwner(false);
                return;
            }

            // Basic address validation
            if (!newOwnerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                setIsNewOwnerContract(false);
                setIsCheckingNewOwner(false);
                return;
            }

            setIsCheckingNewOwner(true);
            try {
                const bytecode = await publicClient.getBytecode({
                    address: newOwnerAddress as `0x${string}`
                });
                const isContract = !!bytecode && bytecode !== '0x';
                setIsNewOwnerContract(isContract);
            } catch (e) {
                console.warn("Could not check if new owner is a contract:", e);
                setIsNewOwnerContract(false);
            } finally {
                setIsCheckingNewOwner(false);
            }
        };

        const timeoutId = setTimeout(checkNewOwnerType, 500); // Debounce
        return () => clearTimeout(timeoutId);
    }, [newOwnerAddress, publicClient]);

    async function handleTransferOwnership() {
        setIsTransferring(true);
        try {
            const hash = await coreWalletClient.writeContract({
                to: validatorManagerAddress,
                abi: ValidatorManagerABI.abi,
                functionName: 'transferOwnership',
                args: [newOwnerAddress],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.status || receipt.status !== 'success') {
                throw new Error('Transfer failed');
            }

            setReceipt(receipt);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsTransferring(false);
        }
    }

    const canTransfer = !isTransferring &&
        !isLoadingValidatorManager &&
        validatorManagerAddress &&
        newOwnerAddress.trim() &&
        !validatorManagerError &&
        (isCurrentUserOwner || isOwnerContract || isLoadingOwnership); // Allow contract owners and loading states

    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.EVMChainBalance,
        ]}>
        <Container
            title="Transfer Validator Manager Ownership"
            description="This will transfer the ownership of the Validator Manager to a new address, which could be an EOA, StakingManager or PoAManager."
        >
            <div className="space-y-4">
                <SelectSubnetId
                    value={selectedSubnetId}
                    onChange={setSelectedSubnetId}
                    onlyNotConverted={false}
                    hidePrimaryNetwork={true}
                    error={validatorManagerError}
                />

                <ValidatorManagerDetails
                    validatorManagerAddress={validatorManagerData.validatorManagerAddress}
                    blockchainId={validatorManagerData.blockchainId}
                    subnetId={selectedSubnetId}
                    isLoading={validatorManagerData.isLoading}
                    signingSubnetId={validatorManagerData.signingSubnetId}
                    contractTotalWeight={validatorManagerData.contractTotalWeight}
                    l1WeightError={validatorManagerData.l1WeightError}
                    isLoadingL1Weight={validatorManagerData.isLoadingL1Weight}
                    contractOwner={validatorManagerData.contractOwner}
                    ownershipError={validatorManagerData.ownershipError}
                    isLoadingOwnership={validatorManagerData.isLoadingOwnership}
                    isOwnerContract={validatorManagerData.isOwnerContract}
                    ownerType={validatorManagerData.ownerType}
                    isDetectingOwnerType={validatorManagerData.isDetectingOwnerType}
                    isExpanded={isDetailsExpanded}
                    onToggleExpanded={() => setIsDetailsExpanded(!isDetailsExpanded)}
                />

                {/* Minimal ownership error display */}
                {showOwnershipError && (
                    <div className="p-3 rounded-lg border bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200 flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm">You are not the owner of this Validator Manager. Only the current owner can transfer ownership.</p>
                        </div>
                    </div>
                )}

                <EVMAddressInput
                    label="New Owner Address"
                    value={newOwnerAddress}
                    onChange={setNewOwnerAddress}
                    disabled={isTransferring}
                />

                {/* Contract owner warning */}
                {isNewOwnerContract && !isCheckingNewOwner && (
                    <div className="p-3 rounded-lg border-l-4 border-l-amber-400 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:border-l-amber-400">
                        <div className="flex items-start gap-3">
                            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                                    Contract Address Detected
                                </h4>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                                    The new owner address is a contract. Please ensure this contract is either a <strong>PoAManager</strong> or <strong>StakingManager</strong> that follows the ACP-99 standard.
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    This action is irreversible unless ValidatorManager is deployed behind proxy
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <Button
                    variant="primary"
                    onClick={handleTransferOwnership}
                    loading={isTransferring}
                    disabled={!canTransfer}
                >
                    Transfer Ownership
                </Button>
            </div>
            {receipt && (
                <ResultField
                    label="Transaction Hash"
                    value={receipt.transactionHash}
                    showCheck={!!receipt.transactionHash}
                />
            )}
        </Container>
        </CheckWalletRequirements>
    );
};

