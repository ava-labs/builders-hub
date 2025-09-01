import { useState } from 'react';
import ValidatorMessagesABI from "../../../../contracts/icm-contracts/compiled/ValidatorMessages.json";
import { useL1LauncherStore, useViemChainStore } from '../../L1LauncherStore';
import { useWalletStore } from '../../../lib/walletStore';
import { Success } from '../../../components/Success';
import { useErrorBoundary } from 'react-error-boundary';
import { Button } from '../../../components/Button';

export function ValidatorMessagesDeployer() {
    const { setValidatorMessagesAddress, validatorMessagesAddress } = useL1LauncherStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const chain = useViemChainStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const { showBoundary } = useErrorBoundary()

    const deployContract = async () => {
        if (!window.avalanche) {
            throw new Error('No ethereum wallet found');
        }

        setIsDeploying(true);
        try {
            const [address] = await coreWalletClient.requestAddresses();

            const hash = await coreWalletClient.deployContract({
                abi: ValidatorMessagesABI.abi,
                bytecode: ValidatorMessagesABI.bytecode.object as `0x${string}`,
                account: address,
                chain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.contractAddress) {
                throw new Error('No contract address in receipt');
            }
            setValidatorMessagesAddress(receipt.contractAddress);
        } catch (err) {
            showBoundary(err);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div>
            <h3 className="text-lg font-medium mb-4 dark:text-gray-200">ValidatorMessages Contract</h3>

            <Success label="ValidatorMessages contract deployed successfully" value={validatorMessagesAddress} />

            {!validatorMessagesAddress && <Button onClick={deployContract} disabled={isDeploying}>Deploy ValidatorMessages</Button>}
        </div>
    );
}
