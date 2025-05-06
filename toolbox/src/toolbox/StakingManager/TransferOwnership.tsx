"use client";

import { useToolboxStore, useViemChainStore } from "../toolboxStore";
import { useWalletStore } from "../../lib/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { ResultField } from "../components/ResultField";
import ValidatorManagerABI from "../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { TransactionReceipt } from "viem";

export default function TransferOwnership() {
    const { showBoundary } = useErrorBoundary();
    const { stakingManagerAddress, validatorManagerAddress, setStakingManagerAddress, setValidatorManagerAddress } = useToolboxStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isTransferring, setIsTransferring] = useState(false);
    const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
    const viemChain = useViemChainStore();

    async function handleDeploy() {
        setIsTransferring(true);
        try {
            const hash = await coreWalletClient.writeContract({
                to: validatorManagerAddress,
                abi: ValidatorManagerABI.abi,
                functionName: 'transferOwnership',
                args: [stakingManagerAddress],
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


    return (

        <Container
            title="Transfer Validator Manager Ownership"
            description="This will transfer the ownership of the Validator Manager to the Staking Manager."
        >
            <div className="space-y-4">
                <EVMAddressInput
                    label="Validator Manager Address"
                    value={validatorManagerAddress}
                    onChange={setValidatorManagerAddress}
                    disabled={isTransferring}
                    showError={true}
                />
                <EVMAddressInput
                    label="Staking Manager Address"
                    value={stakingManagerAddress}
                    onChange={setStakingManagerAddress}
                    disabled={isTransferring}
                    showError={true}
                />
                <Button
                    variant="primary"
                    onClick={handleDeploy}
                    loading={isTransferring}
                    disabled={isTransferring || !validatorManagerAddress || !stakingManagerAddress}
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

    );
};

