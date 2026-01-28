import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { hexToBytes } from 'viem';
import { packWarpIntoAccessList } from '@/components/tools/common/utils/packWarp';
import { useUptimeProof } from '@/components/toolbox/hooks/useUptimeProof';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface InitiateDelegatorRemovalProps {
    delegationID: string;
    stakingManagerAddress: string;
    rpcUrl: string;
    signingSubnetId: string;
    tokenType: TokenType;
    onSuccess: (data: { txHash: string }) => void;
    onError: (message: string) => void;
}

const InitiateDelegatorRemoval: React.FC<InitiateDelegatorRemovalProps> = ({
    delegationID,
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
    const [delegationInfo, setDelegationInfo] = useState<{
        owner: string;
        validationID: string;
        weight: string;
    } | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    // Fetch delegation info when component mounts or delegationID changes
    useEffect(() => {
        const fetchDelegationInfo = async () => {
            if (!publicClient || !stakingManagerAddress || !delegationID) {
                setDelegationInfo(null);
                return;
            }

            try {
                const info = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getDelegator',
                    args: [delegationID as `0x${string}`],
                }) as any;

                setDelegationInfo({
                    owner: info.owner,
                    validationID: info.validationID,
                    weight: info.weight?.toString() || '0',
                });
            } catch (err) {
                console.error('Failed to fetch delegation info:', err);
                setDelegationInfo(null);
            }
        };

        fetchDelegationInfo();
    }, [publicClient, stakingManagerAddress, delegationID, contractAbi]);

    const handleInitiateRemoval = async () => {
        setErrorState(null);
        setTxHash(null);
        setUptimeSeconds(null);

        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        if (!delegationID || delegationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            setErrorState("Valid delegation ID is required.");
            onError("Valid delegation ID is required.");
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
                if (!delegationInfo?.validationID) {
                    throw new Error('Cannot create uptime proof: delegation validation ID not found');
                }

                try {
                    const uptimeProofResult = await createAndSignUptimeProof(
                        delegationInfo.validationID,
                        rpcUrl,
                        signingSubnetId
                    );

                    setUptimeSeconds(uptimeProofResult.uptimeSeconds);
                    console.log(`[InitiateDelegatorRemoval] Using uptime proof: ${uptimeProofResult.uptimeSeconds} seconds`);

                    // Pack the signed warp message into access list
                    const signedWarpBytes = hexToBytes(`0x${uptimeProofResult.signedWarpMessage}`);
                    accessList = packWarpIntoAccessList(signedWarpBytes);
                } catch (uptimeErr) {
                    const message = uptimeErr instanceof Error ? uptimeErr.message : String(uptimeErr);
                    throw new Error(`Failed to create uptime proof: ${message}`);
                }
            }

            // Call initiateDelegatorRemoval
            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "initiateDelegatorRemoval",
                args: [
                    delegationID as `0x${string}`,
                    includeUptimeProof,
                    msgIndex
                ],
                ...(accessList.length > 0 ? { accessList } : {}),
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Initiate Delegator Removal'
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
            } else if (message.includes('InvalidDelegationID')) {
                message = 'Invalid delegation ID. The delegation may not exist or is not active.';
            } else if (message.includes('MinStakeDurationNotPassed')) {
                message = 'Minimum stake duration has not passed yet. Please wait before removing this delegation.';
            } else if (message.includes('Unauthorized')) {
                message = 'You are not authorized to remove this delegation. Only the delegator owner or validator owner can remove delegations.';
            } else if (message.includes('InvalidWarpMessage')) {
                message = 'Invalid uptime proof. Please try again without uptime proof or check validator status.';
            }

            setErrorState(`Failed to initiate delegator removal: ${message}`);
            onError(`Failed to initiate delegator removal: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            {delegationInfo && (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Delegation Information ({tokenLabel} Staking)
                    </h3>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                        <p><strong>Owner:</strong> <code className="text-xs">{delegationInfo.owner}</code></p>
                        <p><strong>Validation ID:</strong> <code className="text-xs">{delegationInfo.validationID}</code></p>
                        <p><strong>Weight:</strong> {delegationInfo.weight}</p>
                    </div>
                </div>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Removal Parameters
                </h3>

                <div className="space-y-3">
                    <Input
                        label="Delegation ID"
                        value={delegationID}
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
                            disabled={isProcessing || !delegationInfo}
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
                                Uptime proof will be fetched for the validator you delegated to.
                                This may increase your delegation rewards based on the validator's uptime.
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

            <Alert variant="warning">
                <p className="text-sm">
                    <strong>Important:</strong> Only the delegation owner or validator owner can initiate removal.
                    Validator owners can only remove delegations after the minimum stake duration has passed.
                </p>
            </Alert>

            <Button
                onClick={handleInitiateRemoval}
                disabled={
                    isProcessing ||
                    isLoadingUptimeProof ||
                    !delegationID ||
                    !!txHash ||
                    !delegationInfo
                }
                loading={isProcessing || isLoadingUptimeProof}
            >
                {isLoadingUptimeProof
                    ? 'Creating Uptime Proof...'
                    : (isProcessing ? 'Processing...' : 'Initiate Delegator Removal')}
            </Button>

            {txHash && (
                <Success
                    label="Transaction Hash"
                    value={txHash}
                />
            )}

            <Alert variant="info">
                <p className="text-sm">
                    <strong>Next Step:</strong> After initiating removal, you'll need to complete the removal process
                    to finalize the delegation removal and receive your staked tokens plus rewards (minus fees).
                </p>
            </Alert>
        </div>
    );
};

export default InitiateDelegatorRemoval;
