import { useState, useEffect } from 'react';
import { AbiEvent } from 'viem';
import { useL1LauncherStore } from '../../L1LauncherStore';
import { Success } from '../../../components/Success';
import { Button } from '../../../components/Button';
import { useErrorBoundary } from 'react-error-boundary';
import { useWalletStore } from '../../../lib/walletStore';
import ValidatorManagerABI from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { PROXY_ADDRESS } from '../../../components/genesis/genGenesis';
import { utils } from '@avalabs/avalanchejs';
import { useViemChainStore } from '../../L1LauncherStore';

export default function ContractInitialize() {
    const [initializedTxID, setInitializedTxID] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [initialCheckHasRun, setInitialCheckHasRun] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const { publicClient, coreWalletClient } = useWalletStore();
    const chain = useViemChainStore();

    const {
        subnetId,
        convertL1SignedWarpMessage
    } = useL1LauncherStore();

    useEffect(() => {
        if (initialCheckHasRun) return;
        setInitialCheckHasRun(true);

        const fetchLogs = async () => {
            try {
                const initializedEventABI = ValidatorManagerABI.abi.find((item: any) => item.type === 'event' && item.name === 'Initialized') as AbiEvent;

                const logs = await publicClient.getLogs({
                    address: PROXY_ADDRESS,
                    event: initializedEventABI,
                    fromBlock: 'earliest',
                    toBlock: 'latest'
                });

                if (logs && logs.length > 0) {
                    setInitializedTxID(logs[0].transactionHash);
                }
            } catch (err) {
                showBoundary(err);
            }
        };

        fetchLogs();
    }, []);

    const onInitialize = async () => {
        setIsLoading(true);

        if (!chain) {
            showBoundary(new Error('Chain not found'));
            return;
        }

        try {
            const [address] = await coreWalletClient.requestAddresses();

            const settings = {
                admin: address,
                subnetID: utils.bufferToHex(utils.base58check.decode(subnetId)),
                churnPeriodSeconds: BigInt(0),
                maximumChurnPercentage: 20
            };

            const { request } = await publicClient.simulateContract({
                address: PROXY_ADDRESS,
                abi: ValidatorManagerABI.abi,
                functionName: 'initialize',
                args: [settings],
                account: address,
                chain: chain
            });

            const hash = await coreWalletClient.writeContract(request);
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                setInitializedTxID(hash);
            } else {
                throw new Error('Transaction failed');
            }
        } catch (err) {
            showBoundary(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pb-2 mb-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium dark:text-white">Call initialize in PoA Validator Manager</h3>
            </div>

            <Success label="Contract initialized successfully" value={initializedTxID || ""} />

            {!initializedTxID && (
                <Button
                    onClick={onInitialize}
                    disabled={isLoading || !convertL1SignedWarpMessage}
                >
                    {isLoading ? 'Initializing...' : 'Call initialize function'}
                </Button>
            )}
        </div>
    );
}
