import { useState } from 'react';
import { useL1LauncherStore, useViemChainStore } from '../../L1LauncherStore';
import { keccak256 } from 'viem';
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { useWalletStore } from '../../../lib/walletStore';
import { Success } from '../../../components/Success';
import { useErrorBoundary } from 'react-error-boundary';
import { Button } from '../../../components/Button';

export function ValidatorManagerDeployer() {
    const {
        setValidatorManagerAddress,
        validatorMessagesAddress,
        validatorManagerAddress,
    } = useL1LauncherStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const chain = useViemChainStore();

    const getLinkedBytecode = () => {
        if (!validatorMessagesAddress) {
            throw new Error('ValidatorMessages address not set');
        }

        const libraryPath = `${Object.keys(ValidatorManagerABI.bytecode.linkReferences)[0]}:${Object.keys(Object.values(ValidatorManagerABI.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = ValidatorManagerABI.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };

    const deployContract = async () => {
        if (!window.avalanche) {
            throw new Error('No ethereum wallet found');
        }

        if (!validatorMessagesAddress) {
            throw new Error('ValidatorMessages must be deployed first');
        }

        setIsDeploying(true);
        try {
            const hash = await coreWalletClient.deployContract({
                abi: ValidatorManagerABI.abi,
                bytecode: getLinkedBytecode(),
                args: [0], // Initial threshold
                chain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }

            setValidatorManagerAddress(receipt.contractAddress);
        } catch (err) {
            showBoundary(err);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div>
            <h3 className="text-lg font-medium mb-4 dark:text-gray-200">ValidatorManager Contract</h3>
            <Success label="ValidatorManager contract deployed successfully" value={validatorManagerAddress} />
            {!validatorManagerAddress && <Button onClick={deployContract} disabled={isDeploying || !validatorMessagesAddress}>Deploy ValidatorManager</Button>}
        </div>
    );
}

function calculateLibraryHash(libraryPath: string) {
    // Calculate keccak256 of the fully qualified library name
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    // Take first 34 characters (17 bytes)
    return hash.slice(0, 34);
} 
