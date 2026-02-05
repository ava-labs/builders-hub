import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { formatEther } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

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
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [claimableAmount, setClaimableAmount] = useState<bigint | null>(null);
    const [isCheckingFees, setIsCheckingFees] = useState(false);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    // Check claimable fees when component mounts or validationID changes
    useEffect(() => {
        const checkClaimableFees = async () => {
            if (!publicClient || !stakingManagerAddress || !validationID) {
                setClaimableAmount(null);
                return;
            }

            setIsCheckingFees(true);
            try {
                const amount = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'valueToClaim',
                    args: [validationID as `0x${string}`],
                }) as bigint;

                setClaimableAmount(amount);
            } catch (err) {
                console.warn('Could not fetch claimable fees:', err);
                setClaimableAmount(null);
            } finally {
                setIsCheckingFees(false);
            }
        };

        checkClaimableFees();
    }, [publicClient, stakingManagerAddress, validationID, contractAbi]);

    const handleClaimFees = async () => {
        setErrorState(null);
        setTxHash(null);

        if (!coreWalletClient || !publicClient || !viemChain) {
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
            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "claimDelegationFees",
                args: [validationID as `0x${string}`],
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Claim Delegation Fees'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            // Try to extract claimed amount from logs
            let claimedAmount: bigint | null = null;
            try {
                const feeClaimTopic = receipt.logs.find(log =>
                    log.topics[0]?.toLowerCase().includes('fee') ||
                    log.topics[0]?.toLowerCase().includes('claim')
                );

                if (feeClaimTopic && feeClaimTopic.data) {
                    claimedAmount = claimableAmount;
                }
            } catch (err) {
                console.warn('Could not extract claimed amount from logs:', err);
            }

            const successMsg = claimedAmount
                ? `Successfully claimed ${formatEther(claimedAmount)} delegation fees.`
                : 'Delegation fees claimed successfully.';

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

            {isCheckingFees ? (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        Checking claimable delegation fees...
                    </p>
                </div>
            ) : claimableAmount !== null ? (
                <div className={`p-3 rounded-md ${claimableAmount > 0n
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-yellow-50 dark:bg-yellow-900/20'
                    }`}>
                    <p className={`text-sm ${claimableAmount > 0n
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                        }`}>
                        <strong>Claimable Fees:</strong> {formatEther(claimableAmount)} tokens
                    </p>
                    {claimableAmount === 0n && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            No fees available to claim yet. Fees accumulate when delegators remove their delegations.
                        </p>
                    )}
                </div>
            ) : null}

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
                disabled={
                    isProcessing ||
                    isCheckingFees ||
                    !!txHash ||
                    claimableAmount === 0n
                }
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
