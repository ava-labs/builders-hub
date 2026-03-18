"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import PoAManagerABI from "@/contracts/icm-contracts/compiled/PoAManager.json";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from "@/components/toolbox/components/Success";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";

import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId";
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails";
import { ValidatorManagerDetails } from "@/components/toolbox/components/ValidatorManagerDetails";
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import SelectSafeWallet, { SafeSelection } from "@/components/toolbox/components/SelectSafeWallet";

import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Deploy PoA Manager",
    description: "Deploy and initialize the PoAManager contract to manage Proof of Authority validators",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DeployPoAManager({ onSuccess }: BaseConsoleToolProps) {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const {
        poaManagerAddress,
        setPoaManagerAddress
    } = useToolboxStore();
    const { publicClient, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [isDeploying, setIsDeploying] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [verifiedOwner, setVerifiedOwner] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [safeSelection, setSafeSelection] = useState<SafeSelection>({
        safeAddress: '',
        threshold: 0,
        owners: []
    });
    const [safeError, setSafeError] = useState<string | null>(null);

    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();
    const {
        validatorManagerAddress,
        error: validatorManagerError,
        isLoading: isLoadingVMCDetails,
        blockchainId,
        contractOwner,
        isOwnerContract,
        contractTotalWeight,
        l1WeightError,
        signingSubnetId,
        isLoadingOwnership,
        isLoadingL1Weight,
        ownershipError,
        ownerType,
        isDetectingOwnerType
    } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const ownerAddress = safeSelection.safeAddress;

    useEffect(() => {
        if (poaManagerAddress) {
            checkIfInitialized();
        }
    }, [poaManagerAddress]);

    async function deployPoAManager() {
        if (!safeSelection.safeAddress) {
            setSafeError("Select an Ash account (Safe) to deploy");
            return;
        }
        if (!ownerAddress || !validatorManagerAddress) {
            throw new Error("Owner address and validator manager address are required");
        }

        setIsDeploying(true);
        setPoaManagerAddress("");

        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const deployPromise = coreWalletClient.deployContract({
                abi: PoAManagerABI.abi as any,
                bytecode: PoAManagerABI.bytecode.object as `0x${string}`,
                args: [ownerAddress as `0x${string}`, validatorManagerAddress as `0x${string}`],
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });

            notify({
                type: 'deploy',
                name: 'PoAManager'
            }, deployPromise, viemChain);

            const hash = await deployPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setPoaManagerAddress(receipt.contractAddress);
            setIsInitialized(true);
            setVerifiedOwner(ownerAddress);
            onSuccess?.();
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsDeploying(false);
        }
    }

    async function checkIfInitialized() {
        if (!poaManagerAddress) return;

        setIsChecking(true);
        try {
            const owner = await publicClient.readContract({
                address: poaManagerAddress as `0x${string}`,
                abi: PoAManagerABI.abi,
                functionName: 'owner'
            }) as string;

            // Check if owner is set to a non-zero address
            const isOwnerSet = owner && owner !== '0x0000000000000000000000000000000000000000';
            setIsInitialized(Boolean(isOwnerSet));
            setVerifiedOwner(owner);
        } catch (error) {
            console.error('Error checking initialization:', error);
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsChecking(false);
        }
    }

    return (
        <>
                <div className="space-y-4">
                    {/* Subnet Selection */}
                    <div className="space-y-2">
                        <SelectSubnetId
                            value={subnetIdL1}
                            onChange={setSubnetIdL1}
                            hidePrimaryNetwork={true}
                        />

                        {/* Validator Manager Details */}
                        {subnetIdL1 && (
                            <ValidatorManagerDetails
                                validatorManagerAddress={validatorManagerAddress}
                                blockchainId={blockchainId}
                                subnetId={subnetIdL1}
                                isLoading={isLoadingVMCDetails}
                                signingSubnetId={signingSubnetId}
                                contractTotalWeight={contractTotalWeight}
                                l1WeightError={l1WeightError}
                                isLoadingL1Weight={isLoadingL1Weight}
                                contractOwner={contractOwner}
                                ownershipError={ownershipError}
                                isLoadingOwnership={isLoadingOwnership}
                                isOwnerContract={isOwnerContract}
                                ownerType={ownerType}
                                isDetectingOwnerType={isDetectingOwnerType}
                            />
                        )}

                        {validatorManagerError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                                {validatorManagerError}
                            </div>
                        )}
                    </div>

                    {Boolean(subnetIdL1) && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200 text-sm">
                            <strong className="font-semibold">Heads up:</strong> Make sure your Validator Manager is deployed on the same chain as your
                            {" "}
                            <a
                                href="https://wallet.ash.center/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                Ash Wallet
                            </a>
                            {" "}deployment. You can get your L1 indexed to ensure full compatibility. You can proceed with other multisig options, but some console tools may lose compatibility if you do.
                        </div>
                    )}

                    <Steps>
                        <Step>
                            <h2 className="text-lg font-semibold">Configure and Deploy PoA Manager</h2>
                            <p className="text-sm text-gray-500">
                                Deploy the <code>PoAManager</code> contract with the specified owner and validator manager addresses.
                                The contract will be initialized automatically during deployment.
                            </p>
                            {viemChain && (
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                    Current chain: {viemChain.name} (ID: {viemChain.id})
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <SelectSafeWallet
                                        value={safeSelection.safeAddress}
                                        onChange={(sel) => {
                                            setSafeSelection(sel);
                                            if (!sel.safeAddress) {
                                                setSafeError("Select an Ash account (Safe)");
                                            } else {
                                                setSafeError(null);
                                            }
                                        }}
                                        error={safeError}
                                    />

                                    {safeSelection.safeAddress && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                            <strong>Safe Details:</strong> {safeSelection.threshold}/{safeSelection.owners.length} multisig
                                            <br />
                                            <strong>Owners:</strong> {safeSelection.owners.length > 0 ? safeSelection.owners.join(', ') : 'Loading...'}
                                        </div>
                                    )}
                                </div>

                                <Input
                                    label="Validator Manager Address"
                                    value={validatorManagerAddress || ""}
                                    disabled={true}
                                    placeholder="Auto-filled from selected subnet"
                                />

                                <Button
                                    variant="primary"
                                    onClick={deployPoAManager}
                                    loading={isDeploying}
                                    disabled={isDeploying || !ownerAddress || !validatorManagerAddress}
                                >
                                    Deploy PoA Manager
                                </Button>
                            </div>

                            {poaManagerAddress && (
                                <Success
                                    label="PoA Manager Deployed & Initialized"
                                    value={poaManagerAddress}
                                />
                            )}
                        </Step>

                        <Step>
                            <h2 className="text-lg font-semibold">Verify Deployment</h2>
                            <p className="text-sm text-gray-500">
                                Verify that the PoA Manager was deployed and initialized correctly.
                            </p>

                            <div className="space-y-4">
                                <EVMAddressInput
                                    label="PoA Manager Address"
                                    value={poaManagerAddress}
                                    onChange={setPoaManagerAddress}
                                />

                                <Button
                                    variant="secondary"
                                    onClick={checkIfInitialized}
                                    loading={isChecking}
                                    size="sm"
                                >
                                    Verify Contract
                                </Button>

                                {isInitialized === true && (
                                    <div className="space-y-2">
                                        <Success
                                            label="Contract Verified"
                                            value={`Owner: ${verifiedOwner ?? ownerAddress}`}
                                        />
                                    </div>
                                )}

                                {isInitialized === false && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                                        Contract not properly initialized or deployed
                                    </div>
                                )}
                            </div>
                        </Step>
                    </Steps>
                </div>
        </>
    );
}

export default withConsoleToolMetadata(DeployPoAManager, metadata);
