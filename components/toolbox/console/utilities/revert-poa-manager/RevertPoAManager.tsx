"use client";

import { useState } from "react";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { Input } from "@/components/toolbox/components/Input";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { MultisigOption } from "@/components/toolbox/components/MultisigOption";
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId";
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails";

const metadata: ConsoleToolMetadata = {
    title: "Revert PoA Manager",
    description: "Revert ValidatorManager ownership from PoAManager to a new owner",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function RevertPoAManager({ onSuccess }: BaseConsoleToolProps) {
    // Subnet selection
    const [subnetId, setSubnetId] = useState<string>("");
    
    // Get ValidatorManager details from the selected subnet
    const {
        validatorManagerAddress,
        contractOwner: poaManagerAddress,
        error: validatorManagerError,
        isLoading: isLoadingValidatorManager,
        ownershipError,
        isLoadingOwnership,
        ownerType,
        isDetectingOwnerType
    } = useValidatorManagerDetails({ subnetId });
    
    // Transfer details
    const [newOwnerAddress, setNewOwnerAddress] = useState<string>("");
    const [transferSuccess, setTransferSuccess] = useState(false);

    const handleTransferSuccess = async (message: string) => {
        setTransferSuccess(true);
        onSuccess?.();
    };

    const handleTransferError = (error: string) => {
        console.error('Transfer failed:', error);
    };

    const canTransfer = !!validatorManagerAddress && !!poaManagerAddress && !!newOwnerAddress && poaManagerAddress?.toLowerCase() !== newOwnerAddress?.toLowerCase() && ownerType === 'PoAManager';

    return (
        <>
            <Steps>
                <Step>
                    <h2 className="text-lg font-semibold">Select L1</h2>
                    <p className="text-sm text-gray-500">
                        Select the L1 whose ValidatorManager you want to revert from PoAManager control. This will transfer ownership to a new address via the PoAManager contract.
                    </p>

                    <SelectSubnetId
                        value={subnetId}
                        onChange={setSubnetId}
                        error={validatorManagerError}
                        label="Select L1"
                        helperText="Choose the L1 with the PoAManager you want to revert"
                    />

                    {isLoadingValidatorManager && (
                        <p className="text-sm text-gray-500">Loading ValidatorManager details...</p>
                    )}

                    {validatorManagerAddress && (
                        <>
                            <Input
                                label="ValidatorManager Address"
                                value={validatorManagerAddress}
                                disabled
                                placeholder="ValidatorManager address will be shown here"
                            />
                            
                            {isLoadingOwnership || isDetectingOwnerType ? (
                                <p className="text-sm text-gray-500">Loading current owner...</p>
                            ) : (
                                <>
                                    <Input
                                        label={`Current Owner${ownerType ? ` (${ownerType})` : ''}`}
                                        value={poaManagerAddress || ""}
                                        disabled
                                        placeholder="Owner address will be shown here"
                                        error={ownershipError || undefined}
                                    />
                                    {ownerType === 'PoAManager' && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            The PoAManager is the current owner of the ValidatorManager. We will call transferValidatorManagerOwnership() on the PoAManager.
                                        </p>
                                    )}
                                    {ownerType === 'EOA' && (
                                        <p className="text-xs text-yellow-600 mt-1">
                                            ⚠️ The ValidatorManager is owned by an EOA, not a PoAManager. This tool is for reverting from PoAManager control.
                                        </p>
                                    )}
                                    {ownerType === 'StakingManager' && (
                                        <p className="text-xs text-yellow-600 mt-1">
                                            ⚠️ The ValidatorManager is owned by a StakingManager contract. This tool is specifically for PoAManager contracts.
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </Step>
                {ownerType === 'PoAManager' && (
                    <Step>
                        <h2 className="text-lg font-semibold">Revert to New Owner</h2>
                        <p className="text-sm text-gray-500">
                            Enter the new owner address for the ValidatorManager contract. This calls <code>transferValidatorManagerOwnership(newOwner)</code> on the PoAManager to revert control.
                        </p>

                        <EVMAddressInput
                            label="New Owner Address"
                            value={newOwnerAddress}
                            onChange={(value: string) => setNewOwnerAddress(value)}
                            placeholder="Enter new owner address for ValidatorManager"
                        />

                        {validatorManagerAddress && poaManagerAddress && (
                            <MultisigOption
                                validatorManagerAddress={validatorManagerAddress}
                                functionName="transferValidatorManagerOwnership"
                                args={[newOwnerAddress as `0x${string}`]}
                                onSuccess={handleTransferSuccess}
                                onError={handleTransferError}
                                disabled={!canTransfer}
                            >
                                <></>
                            </MultisigOption>
                        )}

                    </Step>
                )}
            </Steps>

            {poaManagerAddress?.toLowerCase() === newOwnerAddress?.toLowerCase() && newOwnerAddress && (
                <p className="mt-4 text-yellow-600">The new owner address is the same as the current owner</p>
            )}

            {transferSuccess && (
                <p className="mt-4 text-green-600">PoAManager revert initiated successfully!</p>
            )}
        </>
    );
}

export default withConsoleToolMetadata(RevertPoAManager, metadata);

