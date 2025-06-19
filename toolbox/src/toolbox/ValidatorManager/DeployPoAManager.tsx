"use client";

import { useToolboxStore, useViemChainStore } from "../../stores/toolboxStore";
import { useWalletStore } from "../../stores/walletStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import PoAManagerABI from "../../../contracts/icm-contracts/compiled/PoAManager.json";
import { Container } from "../../components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Success } from "../../components/Success";
import { EVMAddressInput } from "../../components/EVMAddressInput";

import SelectSubnetId from "../../components/SelectSubnetId";
import { useValidatorManagerDetails } from "../hooks/useValidatorManagerDetails";
import { ValidatorManagerDetails } from "../../components/ValidatorManagerDetails";
import { useCreateChainStore } from "../../stores/createChainStore";
import SelectSafeWallet, { SafeSelection } from "../../components/SelectSafeWallet";

export default function DeployPoAManager() {
    const { showBoundary } = useErrorBoundary();
    const { 
        poaManagerAddress,
        setPoaManagerAddress
    } = useToolboxStore();
    const { walletEVMAddress, coreWalletClient, publicClient } = useWalletStore();
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [isDeploying, setIsDeploying] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [poaOwnerAddress, setPoaOwnerAddress] = useState("");
    const [validatorManagerAddr, setValidatorManagerAddr] = useState("");
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [safeSelection, setSafeSelection] = useState<SafeSelection>({ 
        safeAddress: '', 
        threshold: 0, 
        owners: [] 
    });
    const [useSafeWallet, setUseSafeWallet] = useState(true);
    const viemChain = useViemChainStore();

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

    useEffect(() => {
        if (walletEVMAddress && !poaOwnerAddress) {
            setPoaOwnerAddress(walletEVMAddress);
        }
    }, [walletEVMAddress, poaOwnerAddress]);

    useEffect(() => {
        if (validatorManagerAddress && !validatorManagerAddr) {
            setValidatorManagerAddr(validatorManagerAddress);
        }
    }, [validatorManagerAddress, validatorManagerAddr]);

    useEffect(() => {
        if (useSafeWallet && safeSelection.safeAddress) {
            setPoaOwnerAddress(safeSelection.safeAddress);
        } else if (!useSafeWallet && walletEVMAddress && !poaOwnerAddress) {
            setPoaOwnerAddress(walletEVMAddress);
        }
    }, [useSafeWallet, safeSelection.safeAddress, walletEVMAddress, poaOwnerAddress]);

    useEffect(() => {
        if (poaManagerAddress) {
            checkIfInitialized();
        }
    }, [poaManagerAddress]);

    async function deployPoAManager() {
        if (!poaOwnerAddress || !validatorManagerAddr) {
            throw new Error("Owner address and validator manager address are required");
        }

        setIsDeploying(true);
        setPoaManagerAddress("");
        try {
            if (!viemChain) throw new Error("Viem chain not found");
            await coreWalletClient.addChain({ chain: viemChain });
            await coreWalletClient.switchChain({ id: viemChain!.id });

            const hash = await coreWalletClient.deployContract({
                abi: PoAManagerABI.abi,
                bytecode: PoAManagerABI.bytecode.object as `0x${string}`,
                args: [poaOwnerAddress as `0x${string}`, validatorManagerAddr as `0x${string}`],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setPoaManagerAddress(receipt.contractAddress);
            setIsInitialized(true); // Contract is initialized upon deployment
        } catch (error) {
            showBoundary(error);
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
            console.log('Contract owner:', owner, 'isInitialized:', Boolean(isOwnerSet));
        } catch (error) {
            console.error('Error checking initialization:', error);
            showBoundary(error);
        } finally {
            setIsChecking(false);
        }
    }

    return (
        <Container
            title="Deploy PoA Manager"
            description="Deploy and initialize the PoAManager contract to manage Proof of Authority validators."
        >
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

                <Steps>
                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Configure and Deploy PoA Manager</h3>
                            <div className="text-sm">
                                Deploy the <code>PoAManager</code> contract with the specified owner and validator manager addresses. 
                                The contract will be initialized automatically during deployment.
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-3">
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={useSafeWallet}
                                                onChange={(e) => setUseSafeWallet(e.target.checked)}
                                                disabled={isDeploying}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Use Ash Wallet
                                            </span>
                                        </label>
                                    </div>

                                    {useSafeWallet ? (
                                        <SelectSafeWallet
                                            value={safeSelection.safeAddress}
                                            onChange={setSafeSelection}
                                            error={null}
                                        />
                                    ) : (
                                        <Input
                                            label="Owner Address"
                                            value={poaOwnerAddress}
                                            onChange={setPoaOwnerAddress}
                                            disabled={isDeploying}
                                            placeholder="Enter owner address"
                                            button={<Button
                                                onClick={() => setPoaOwnerAddress(walletEVMAddress)}
                                                stickLeft
                                            >
                                                Fill from Wallet
                                            </Button>}
                                        />
                                    )}

                                    {useSafeWallet && safeSelection.safeAddress && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                            <strong>Safe Details:</strong> {safeSelection.threshold}/{safeSelection.owners.length} multisig
                                            <br />
                                            <strong>Owners:</strong> {safeSelection.owners.length > 0 ? safeSelection.owners.join(', ') : 'Loading...'}
                                        </div>
                                    )}
                                </div>

                                <Input
                                    label="Validator Manager Address"
                                    value={validatorManagerAddr}
                                    onChange={() => {}} // No-op since it's read-only
                                    disabled={true}
                                    placeholder="Auto-filled from selected subnet"
                                />

                                <Button
                                    variant="primary"
                                    onClick={deployPoAManager}
                                    loading={isDeploying}
                                    disabled={isDeploying || !poaOwnerAddress || !validatorManagerAddr}
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
                        </div>
                    </Step>

                    <Step>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold">Verify Deployment</h3>
                            <div className="text-sm">
                                Verify that the PoA Manager was deployed and initialized correctly.
                            </div>

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
                                            value={`Owner: ${poaOwnerAddress}`}
                                        />
                                    </div>
                                )}

                                {isInitialized === false && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                                        Contract not properly initialized or deployed
                                    </div>
                                )}
                            </div>
                        </div>
                    </Step>
                </Steps>
            </div>
        </Container>
    );
}
