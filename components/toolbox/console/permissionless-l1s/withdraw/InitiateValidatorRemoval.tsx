import React, { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { decodeErrorResult } from 'viem';
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
    tokenType,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const [messageIndex, setMessageIndex] = useState<string>('0');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    const handleInitiateRemoval = async () => {
        setErrorState(null);
        setTxHash(null);

        if (!coreWalletClient || !publicClient || !viemChain) {
            const msg = "Wallet or chain configuration is not properly initialized.";
            setErrorState(msg);
            onError(msg);
            return;
        }

        if (!validationID || validationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            const msg = "Valid validation ID is required.";
            setErrorState(msg);
            onError(msg);
            return;
        }

        if (!stakingManagerAddress) {
            const msg = "Staking Manager address is required.";
            setErrorState(msg);
            onError(msg);
            return;
        }

        const msgIndex = parseInt(messageIndex);
        if (isNaN(msgIndex) || msgIndex < 0) {
            const msg = "Message index must be a non-negative number.";
            setErrorState(msg);
            onError(msg);
            return;
        }

        setIsProcessing(true);
        try {
            // Pre-check validator state
            try {
                const stakingValidatorInfo = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getStakingValidator',
                    args: [validationID as `0x${string}`]
                }) as { owner: string; delegationFeeBips: number; minStakeDuration: bigint; uptimeSeconds: bigint };

                const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
                const isGenesisValidator = stakingValidatorInfo.owner === ZERO_ADDRESS;

                // For non-genesis validators, check ownership
                if (!isGenesisValidator && stakingValidatorInfo.owner.toLowerCase() !== walletEVMAddress?.toLowerCase()) {
                    throw new Error(`You are not the owner of this validator. Owner: ${stakingValidatorInfo.owner}`);
                }

                // Get ValidatorManager address to check validator status
                const settings = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getStakingManagerSettings',
                }) as { manager: string; minimumStakeDuration: bigint };

                const ValidatorManagerAbi = [
                    {
                        type: 'function',
                        name: 'getValidator',
                        inputs: [{ name: 'validationID', type: 'bytes32' }],
                        outputs: [{
                            type: 'tuple',
                            components: [
                                { name: 'status', type: 'uint8' },
                                { name: 'nodeID', type: 'bytes' },
                                { name: 'startingWeight', type: 'uint64' },
                                { name: 'weight', type: 'uint64' },
                                { name: 'startTime', type: 'uint64' },
                                { name: 'endedAt', type: 'uint64' }
                            ]
                        }],
                        stateMutability: 'view'
                    }
                ];

                const validatorInfo = await publicClient.readContract({
                    address: settings.manager as `0x${string}`,
                    abi: ValidatorManagerAbi,
                    functionName: 'getValidator',
                    args: [validationID as `0x${string}`]
                }) as { status: number; startingWeight: bigint; weight: bigint; startTime: bigint };

                const statusNames: Record<number, string> = {
                    0: 'Unknown', 1: 'Pending', 2: 'Active', 3: 'Removing', 4: 'Completed'
                };
                
                if (Number(validatorInfo.status) !== 2) {
                    throw new Error(`Validator is not active. Current status: ${statusNames[validatorInfo.status] || validatorInfo.status}. Only active validators can be removed.`);
                }

                // Note: We no longer block on weight > startingWeight check here.
                // This check was causing false positives due to state sync issues between 
                // delegation completion and validator weight updates.
                // The contract itself will enforce proper delegation removal.

                // Check minimum stake duration for PoS validators
                if (!isGenesisValidator && stakingValidatorInfo.minStakeDuration > 0n) {
                    const currentTime = BigInt(Math.floor(Date.now() / 1000));
                    const endTime = validatorInfo.startTime + stakingValidatorInfo.minStakeDuration;
                    
                    if (currentTime < endTime) {
                        const remaining = endTime - currentTime;
                        const hours = Number(remaining) / 3600;
                        throw new Error(`Minimum stake duration has not passed. Time remaining: ${hours.toFixed(1)} hours.`);
                    }
                }
            } catch (preCheckErr) {
                if (preCheckErr instanceof Error && (
                    preCheckErr.message.includes('not the owner') ||
                    preCheckErr.message.includes('stake duration') ||
                    preCheckErr.message.includes('not active') ||
                    preCheckErr.message.includes('active delegations')
                )) {
                    throw preCheckErr;
                }
            }

            // Always use force removal (no uptime proof)
            const txConfig: any = {
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "forceInitiateValidatorRemoval",
                args: [
                    validationID as `0x${string}`,
                    false, // includeUptimeProof - always false
                    msgIndex
                ],
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            };

            // Try gas estimation
            try {
                const gasEstimate = await publicClient.estimateContractGas(txConfig);
                txConfig.gas = (gasEstimate * 120n) / 100n;
            } catch (gasError: any) {
                // Try to decode the error
                const errorData = gasError?.cause?.data || gasError?.data;
                if (errorData) {
                    try {
                        const decoded = decodeErrorResult({
                            abi: contractAbi,
                            data: errorData
                        });
                        
                        if (decoded.errorName === 'MinStakeDurationNotPassed') {
                            throw new Error('Minimum stake duration has not passed.');
                        } else if (decoded.errorName === 'InvalidValidatorStatus') {
                            throw new Error('Validator is not in a valid state for removal.');
                        } else if (decoded.errorName === 'UnauthorizedOwner') {
                            throw new Error('You are not authorized to remove this validator.');
                        } else if (decoded.errorName === 'ValidatorNotPoS') {
                            throw new Error('This is a genesis/PoA validator and cannot be removed through the StakingManager.');
                        } else {
                            throw new Error(`Contract error: ${decoded.errorName}`);
                        }
                    } catch (decodeErr: any) {
                        if (decodeErr.message?.includes('Contract error') ||
                            decodeErr.message?.includes('Minimum stake') ||
                            decodeErr.message?.includes('not authorized') ||
                            decodeErr.message?.includes('genesis/PoA')) {
                            throw decodeErr;
                        }
                    }
                }
                
                throw new Error(`Gas estimation failed: ${gasError?.message || 'Unknown error'}`);
            }

            // Send transaction
            const writePromise = coreWalletClient.writeContract(txConfig);

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

            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
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
                        onChange={() => { }}
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
                        helperText="Index of the warp message (usually 0)"
                    />
                </div>
            </div>

            <Alert variant="info">
                <p className="text-sm">
                    <strong>Requirements:</strong> You must be the validator owner. All delegations must be removed first. 
                    The minimum stake duration must have passed.
                </p>
            </Alert>

            <Button
                onClick={handleInitiateRemoval}
                disabled={isProcessing || !validationID || !!txHash}
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Initiate Validator Removal'}
            </Button>

            {txHash && (
                <Success
                    label="Transaction Hash"
                    value={txHash}
                />
            )}
        </div>
    );
};

export default InitiateValidatorRemoval;
