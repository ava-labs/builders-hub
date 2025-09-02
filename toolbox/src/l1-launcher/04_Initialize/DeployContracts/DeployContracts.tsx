import { useL1LauncherStore, useViemChainStore } from '../../L1LauncherStore';
import NextPrev from '../../components/NextPrev';
import { useState } from 'react';
import { UpgradeProxyForm } from './UpgradeProxy';
import { ValidatorMessagesDeployer } from './ValidatorMessages';
import { ValidatorManagerDeployer } from './ValidatorManager';
import { RequireChain } from '../../../components/RequireChain';


// Main Component
export default function DeployContracts() {
    const {
        validatorMessagesAddress,
        validatorManagerAddress,
    } = useL1LauncherStore();
    const chain = useViemChainStore();

    const [isProxyUpgraded, setIsProxyUpgraded] = useState(false);

    if (!chain) {
        return <div>Loading...</div>;
    }

    return (
        <RequireChain chain={chain}>
            <h1 className="text-2xl font-medium mb-6 dark:text-gray-200">Deploy Contracts</h1>

            <div className="space-y-6">
                {/* Step 1: Deploy ValidatorMessages */}
                <ValidatorMessagesDeployer />

                {/* Step 2: Deploy ValidatorManager */}
                <ValidatorManagerDeployer />

                {/* Step 3: Upgrade Proxy */}
                <UpgradeProxyForm onUpgradeComplete={setIsProxyUpgraded} />
            </div>

            <div className="mt-6">
                <NextPrev nextEnabled={validatorMessagesAddress !== null &&
                    validatorManagerAddress !== null &&
                    isProxyUpgraded} />
            </div>
        </RequireChain>
    );
}




