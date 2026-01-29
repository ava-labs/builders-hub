import React, { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { hexToBytes, bytesToHex } from 'viem';
import { packWarpIntoAccessList } from '@/components/tools/common/utils/packWarp';
import { useUptimeProof } from '@/components/toolbox/hooks/useUptimeProof';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface InitiateValidatorRemovalProps {
    validationID: string;
    stakingManagerAddress: string;
    rpcUrl: string;
    signingSubnetId: string;
    tokenType: TokenType;
    onSuccess: (data: { txHash: string }) => void;
    onError: (message: string) => void;
}

const InitiateValidatorRemoval: React.FC<InitiateValidatorRemovalProps> = ({
    validationID,
    stakingManagerAddress,
    rpcUrl,
    signingSubnetId,
    tokenType,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();
    const { createAndSignUptimeProof, isLoading: isLoadingUptimeProof } = useUptimeProof();

    const [includeUptimeProof, setIncludeUptimeProof] = useState(false);
    const [messageIndex, setMessageIndex] = useState<string>('0');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [uptimeSeconds, setUptimeSeconds] = useState<bigint | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    const handleInitiateRemoval = async () => {
        setErrorState(null);
        setTxHash(null);
        setUptimeSeconds(null);

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

        const msgIndex = parseInt(messageIndex);
        if (isNaN(msgIndex) || msgIndex < 0) {
            setErrorState("Message index must be a non-negative number.");
            onError("Message index must be a non-negative number.");
            return;
        }

        setIsProcessing(true);
        try {
            let accessList: any[] = [];

            // If uptime proof is requested, create and sign it
            if (includeUptimeProof) {
                try {
                    const uptimeProofResult = await createAndSignUptimeProof(
                        validationID,
                        rpcUrl,
                        signingSubnetId
                    );

                    setUptimeSeconds(uptimeProofResult.uptimeSeconds);
                    console.log(`[InitiateValidatorRemoval] Using uptime proof: ${uptimeProofResult.uptimeSeconds} seconds`);

                    // Pack the signed warp message into access list
                    const signedWarpBytes = hexToBytes(`0x${uptimeProofResult.signedWarpMessage}`);
                    accessList = packWarpIntoAccessList(signedWarpBytes);
                } catch (uptimeErr) {
                    const message = uptimeErr instanceof Error ? uptimeErr.message : String(uptimeErr);
                    throw new Error(`Failed to create uptime proof: ${message}`);
                }
            }

            // Call initiateValidatorRemoval
            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "initiateValidatorRemoval",
                args: [
                    validationID as `0x${string}`,
                    includeUptimeProof,
                    msgIndex
                ],
                ...(accessList.length > 0 ? { accessList } : {}),
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Initiate Validator Removal'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            onSuccess({ txHash: hash });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            // Provide more helpful error messages
            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('InvalidValidationID')) {
                message = 'Invalid validation ID. The validator may not exist or is not active.';
            } else if (message.includes('MinStakeDurationNotPassed')) {
                message = 'Minimum stake duration has not passed yet. Please wait before removing this validator.';
            } else if (message.includes('InvalidWarpMessage')) {
                message = 'Invalid uptime proof. Please try again without uptime proof or check validator status.';
            }

            setErrorState(`Failed to initiate validator removal: ${message}`);
            onError(`Failed to initiate validator removal: ${message}`);
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
                    Removal Parameters ({tokenLabel} Staking)
                </h3>

                <div className="space-y-3">
                    <Input
                        label="Validation ID"
                        value={validationID}
                        onChange={() => { }} // Read-only, set by parent
                        disabled={true}
                    />

                    <Input
                        label="Message Index"
                        value={messageIndex}
                        onChange={setMessageIndex}
                        type="number"
                        min="0"
                        placeholder="0"
                        disabled={isProcessing}
                        helperText="Index of the warp message to use (usually 0)"
                    />

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="includeUptimeProof"
                            checked={includeUptimeProof}
                            onChange={(e) => setIncludeUptimeProof(e.target.checked)}
                            disabled={isProcessing}
                            className="rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <label
                            htmlFor="includeUptimeProof"
                            className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                            Include uptime proof (may increase rewards)
                        </label>
                    </div>

                    {includeUptimeProof && (
                        <Alert variant="info">
                            <p className="text-sm">
                                Uptime proof will be fetched from the validators RPC endpoint and signed.
                                This may take a few moments and will attempt different quorum percentages if needed.
                            </p>
                        </Alert>
                    )}
                </div>
            </div>

            {uptimeSeconds !== null && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>Uptime Proof Created:</strong> {uptimeSeconds.toString()} seconds
                    </p>
                </div>
            )}

            <Button
                onClick={handleInitiateRemoval}
                disabled={
                    isProcessing ||
                    isLoadingUptimeProof ||
                    !validationID ||
                    !!txHash
                }
                loading={isProcessing || isLoadingUptimeProof}
            >
                {isLoadingUptimeProof
                    ? 'Creating Uptime Proof...'
                    : (isProcessing ? 'Processing...' : 'Initiate Validator Removal')}
            </Button>

            {txHash && (
                <Success
                    label="Transaction Hash"
                    value={txHash}
                />
            )}

            <Alert variant="warning">
                <p className="text-sm">
                    <strong>Note:</strong> After initiating removal, you'll need to complete the removal process
                    to finalize the validator removal and receive rewards.
                </p>
            </Alert>
        </div>
    );
};

export default InitiateValidatorRemoval;
