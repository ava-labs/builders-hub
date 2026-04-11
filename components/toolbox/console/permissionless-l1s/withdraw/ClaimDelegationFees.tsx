import React, { useState } from 'react';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useWalletClient } from 'wagmi';

type TokenType = 'native' | 'erc20';

interface ClaimDelegationFeesProps {
    validationID: string;
    stakingManagerAddress: string;
    tokenType: TokenType;
    onSuccess: (data: { txHash: string; message: string }) => void;
    onError: (message: string) => void;
}

const ClaimDelegationFees: React.FC<ClaimDelegationFeesProps> = ({
    validationID,
    stakingManagerAddress,
    tokenType,
    onSuccess,
    onError,
}) => {
    const chainPublicClient = useChainPublicClient();
    const { data: walletClient } = useWalletClient();
    const viemChain = useViemChainStore();

    const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
    const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    const handleClaimFees = async () => {
        setErrorState(null);
        setTxHash(null);

        if (!walletClient || !chainPublicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        if (!validationID || validationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            setErrorState("Valid validation ID is required.");
            onError("Valid validation ID is required.");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager address is required.");
            onError("Staking Manager address is required.");
            return;
        }

        setIsProcessing(true);
        try {
            // Use hook to claim delegation fees
            const hash = tokenType === 'native'
                ? await nativeStakingManager.claimDelegationFees(validationID as `0x${string}`)
                : await erc20StakingManager.claimDelegationFees(validationID as `0x${string}`);

            setTxHash(hash);

            // Wait for confirmation
            const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            const successMsg = 'Delegation fees claimed successfully.';

            onSuccess({
                txHash: hash,
                message: successMsg
            });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            // Provide more helpful error messages
            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('InvalidValidationID')) {
                message = 'Invalid validation ID. The validator may not exist.';
            } else if (message.includes('NoFeesToClaim') || message.includes('NothingToClaim')) {
                message = 'No delegation fees available to claim for this validator.';
            } else if (message.includes('Unauthorized') || message.includes('OnlyValidator')) {
                message = 'Only the validator owner can claim delegation fees.';
            }

            setErrorState(`Failed to claim delegation fees: ${message}`);
            onError(`Failed to claim delegation fees: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Claim Fees ({tokenLabel} Staking)
                </h3>

                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p><strong>Validation ID:</strong> {validationID}</p>
                </div>
            </div>

            <Alert variant="info">
                <p className="text-sm">
                    <strong>About Delegation Fees:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Delegation fees are set when you register as a validator (delegation fee basis points)</li>
                    <li>Fees are deducted from delegator rewards when delegations are removed</li>
                    <li>Accumulated fees can be claimed separately from validator rewards</li>
                    <li>Only the validator owner can claim these fees</li>
                </ul>
            </Alert>

            <Button
                onClick={handleClaimFees}
                disabled={isProcessing || !!txHash}
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Claim Delegation Fees'}
            </Button>

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                        <p className="text-sm text-green-800 dark:text-green-200">
                            <strong>Success!</strong> Delegation fees have been claimed and transferred to your address.
                        </p>
                    </div>
                </>
            )}

            <Alert variant="warning">
                <p className="text-sm">
                    <strong>Note:</strong> Delegation fees are separate from validator rewards.
                    Make sure to also complete validator removal to claim your validator rewards.
                </p>
            </Alert>
        </div>
    );
};

export default ClaimDelegationFees;
