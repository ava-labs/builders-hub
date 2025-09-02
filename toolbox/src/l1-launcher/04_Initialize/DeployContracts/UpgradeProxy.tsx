
import { useEffect, useState } from 'react';
import { useL1LauncherStore, useViemChainStore } from '../../L1LauncherStore';
import { useWalletStore } from '../../../lib/walletStore';
import ProxyAdmin from "../../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json"
import { PROXY_ADMIN_ADDRESS, PROXY_ADDRESS } from "../../../components/genesis/genGenesis"
import { useErrorBoundary } from 'react-error-boundary';
import { Button } from '../../../components/Button';
import { Success } from '../../../components/Success';


export function UpgradeProxyForm({ onUpgradeComplete }: { onUpgradeComplete?: (success: boolean) => void }) {
    const { evmChainId, chainId, validatorManagerAddress } = useL1LauncherStore();
    const { showBoundary } = useErrorBoundary();
    const { publicClient, coreWalletClient } = useWalletStore();
    const chain = useViemChainStore();

    const [isUpgrading, setIsUpgrading] = useState(false);
    const [currentImplementation, setCurrentImplementation] = useState<string | null>(null);

    useEffect(() => {
        async function checkCurrentImplementation() {
            try {
                const implementation = await publicClient.readContract({
                    address: PROXY_ADMIN_ADDRESS,
                    abi: ProxyAdmin.abi,
                    functionName: 'getProxyImplementation',
                    args: [PROXY_ADDRESS],
                });

                setCurrentImplementation(implementation as string);
                if (implementation && validatorManagerAddress &&
                    (implementation as string).toLowerCase() === validatorManagerAddress.toLowerCase()) {
                    onUpgradeComplete?.(true);
                } else {
                    onUpgradeComplete?.(false);
                }
            } catch (err) {
                setCurrentImplementation(null);
            }
        }

        checkCurrentImplementation();
    }, [evmChainId, chainId, validatorManagerAddress, onUpgradeComplete]);

    const handleUpgrade = async () => {
        try {
            if (!validatorManagerAddress) {
                throw new Error('PoA Validator Manager address not set');
            }

            if (!window.avalanche) {
                throw new Error('No ethereum provider found');
            }

            setIsUpgrading(true);

            const hash = await coreWalletClient.writeContract({
                address: PROXY_ADMIN_ADDRESS,
                abi: ProxyAdmin.abi,
                functionName: 'upgrade',
                args: [PROXY_ADDRESS, validatorManagerAddress as `0x${string}`],
                chain: chain,
            });

            await publicClient.waitForTransactionReceipt({ hash });
            setCurrentImplementation(validatorManagerAddress);
            onUpgradeComplete?.(true);
        } catch (err) {
            showBoundary(err);
        } finally {
            setIsUpgrading(false);
        }
    };


    return (
        <div className="mt-6">
            <h2 className="text-xl font-medium mb-4 dark:text-gray-200">Upgrade Proxy Implementation</h2>

            <div className="space-y-4">

                {validatorManagerAddress?.toLowerCase() === currentImplementation?.toLowerCase() &&
                    <Success label={`Proxy implementation is pointing to the correct implementation`} value={currentImplementation} />
                }

                {validatorManagerAddress?.toLowerCase() !== currentImplementation?.toLowerCase() &&
                    <div>
                        Proxy is currently pointing to: {currentImplementation}
                    </div>
                }

                <Button
                    onClick={handleUpgrade}
                    disabled={
                        isUpgrading ||
                        !validatorManagerAddress ||
                        (currentImplementation?.toLowerCase() ===
                            validatorManagerAddress?.toLowerCase())
                    }
                >
                    {isUpgrading ? 'Upgrading...' : 'Upgrade to PoA Validator Manager'}
                </Button>
            </div>
        </div>
    );
}
