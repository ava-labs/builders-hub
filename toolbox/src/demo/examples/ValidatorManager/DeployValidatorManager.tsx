"use client";

import { useExampleStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../ui";
import { Success } from "../../ui/Success";
import { createWalletClient, custom, createPublicClient, keccak256 } from 'viem';
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json";

function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

export default function DeployValidatorManager() {
    const { showBoundary } = useErrorBoundary();
    const { validatorMessagesLibAddress, walletChainId, validatorManagerAddress, setValidatorManagerAddress } = useExampleStore();
    const [isDeploying, setIsDeploying] = useState(false);

    const getLinkedBytecode = () => {
        if (!validatorMessagesLibAddress) {
            throw new Error('ValidatorMessages library must be deployed first');
        }

        const libraryPath = `${Object.keys(ValidatorManagerABI.bytecode.linkReferences)[0]}:${Object.keys(Object.values(ValidatorManagerABI.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = ValidatorManagerABI.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesLibAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };

    async function handleDeploy() {
        setIsDeploying(true);
        setValidatorManagerAddress("");
        try {
            const publicClient = createPublicClient({
                transport: custom(window.avalanche!),
            });

            const walletClient = createWalletClient({
                transport: custom(window.avalanche!),
            });

            const [address] = await walletClient.requestAddresses();

            const hash = await walletClient.deployContract({
                abi: ValidatorManagerABI.abi,
                bytecode: getLinkedBytecode(),
                account: address,
                args: [0], // TODO: Not sure about this. Please check the source https://github.com/ava-labs/icm-contracts/blob/48fe4883914b46ec7e4385dc0edf5c2df31c99f4/contracts/validator-manager/ValidatorManager.sol#L136C21-L136C48
                chain: {
                    id: walletChainId,
                    name: "My L1",
                    rpcUrls: {
                        default: { http: [] },
                    },
                    nativeCurrency: {
                        name: "COIN",
                        symbol: "COIN",
                        decimals: 18,
                    },
                },
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setValidatorManagerAddress(receipt.contractAddress);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsDeploying(false);
        }
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold ">Deploy Validator Manager</h2>
            <div className="space-y-4">
                <div className="mb-4">
                    This will deploy the <code>ValidatorManager</code> contract to the currently connected EVM network <code>{walletChainId}</code>.
                </div>
                <div className="mb-4">
                    The contract requires the <code>ValidatorMessages</code> library at address: <code>{validatorMessagesLibAddress || "Not deployed"}</code>
                </div>
                {knownNetwoks[walletChainId] && (
                    <div className="mb-4">
                        ⚠️ Warning: You are connected to {knownNetwoks[walletChainId]}, not to your L1.
                    </div>
                )}
                <Button
                    type="primary"
                    onClick={handleDeploy}
                    loading={isDeploying}
                    disabled={isDeploying || !validatorMessagesLibAddress}
                >
                    Deploy Contract
                </Button>
            </div>
            <Success
                label="ValidatorManager Address"
                value={validatorManagerAddress}
            />
        </div>
    );
};

const knownNetwoks: Record<number, string> = {
    43114: "Avalanche Mainnet",
    43113: "Avalanche Fuji Testnet",
    43117: "Avalanche Devnet",
};
