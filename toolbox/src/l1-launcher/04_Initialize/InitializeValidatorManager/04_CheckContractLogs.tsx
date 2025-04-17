import { useState } from 'react';
import { AbiEvent, Log, decodeEventLog } from 'viem';
import { useWalletStore } from '../../../lib/walletStore';
import ValidatorManagerABI from '../../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import { PROXY_ADDRESS } from '../../../components/genesis/genGenesis';
import { Button } from '../../../components/Button';
import { useErrorBoundary } from 'react-error-boundary';

const serializeBigInt = (obj: any): any => {
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeBigInt);
    }
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)])
        );
    }
    return obj;
};

interface ContractLog {
    eventName: string;
    decodedData: Record<string, any>;
    blockNumber: bigint;
    transactionHash: `0x${string}`;
}

export default function CheckContractLogs({ onSuccess }: { onSuccess: () => void }) {
    const [logs, setLogs] = useState<ContractLog[]>([]);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [hasInitialValidator, setHasInitialValidator] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showBoundary } = useErrorBoundary();
    const { publicClient } = useWalletStore();

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            // Get all events from ABI
            const eventAbis = ValidatorManagerABI.abi.filter(
                (item) => item.type === 'event'
            ) as AbiEvent[];

            // Fetch logs for all events
            const allLogs = await Promise.all(
                eventAbis.map(eventAbi =>
                    publicClient.getLogs({
                        address: PROXY_ADDRESS,
                        event: eventAbi,
                        fromBlock: 'earliest',
                        toBlock: 'latest'
                    })
                )
            );

            // Process and decode all logs
            const processedLogs: ContractLog[] = [];

            allLogs.flat().forEach((log: Log) => {
                try {
                    const decodedLog = decodeEventLog({
                        abi: ValidatorManagerABI.abi,
                        data: log.data,
                        topics: log.topics,
                    });

                    if (decodedLog.eventName && log.blockNumber && log.transactionHash) {
                        processedLogs.push({
                            eventName: decodedLog.eventName,
                            decodedData: decodedLog.args as Record<string, any>,
                            blockNumber: log.blockNumber,
                            transactionHash: log.transactionHash,
                        });
                    }
                } catch (error) {
                    console.error("Error decoding log:", error);
                }
            });

            // Sort logs by block number
            const sortedLogs = [...processedLogs].sort((a, b) =>
                Number(a.blockNumber) - Number(b.blockNumber)
            );

            console.log("Processed logs:", sortedLogs);
            setLogs(sortedLogs);

            // Check for specific events
            const initialized = sortedLogs.some(log => log.eventName === 'Initialized');
            const initialValidator = sortedLogs.some(log => log.eventName === 'RegisteredInitialValidator');

            console.log("Events found:", { initialized, initialValidator });
            setHasInitialized(initialized);
            setHasInitialValidator(initialValidator);

            // Call onSuccess if both events are found
            if (initialized && initialValidator) {
                onSuccess();
            }
        } catch (err) {
            console.error("Error in fetchLogs:", err);
            showBoundary(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pb-2 mb-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium dark:text-white">Contract Events</h3>
            </div>

            <div className="space-y-2 mb-6">
                <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full mr-3 flex items-center justify-center
                        ${hasInitialized ? 'bg-green-500' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {hasInitialized && (
                            <span className="text-white text-sm">✓</span>
                        )}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">ValidatorManager emitted Initialized event</span>
                </div>

                <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full mr-3 flex items-center justify-center
                        ${hasInitialValidator ? 'bg-green-500' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {hasInitialValidator && (
                            <span className="text-white text-sm">✓</span>
                        )}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">ValidatorManager emitted RegisteredInitialValidator event</span>
                </div>
            </div>

            <Button
                onClick={fetchLogs}
                disabled={isLoading}
            >
                {isLoading ? 'Loading...' : 'Fetch Contract Logs'}
            </Button>

            {logs.length > 0 && (
                <div className="mt-4 space-y-3">
                    {logs.map((log, index) => (
                        <div key={`${log.transactionHash}-${index}`}
                            className="rounded border border-gray-100 dark:border-gray-700">
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                <div className="font-medium text-blue-600 dark:text-blue-400">
                                    {log.eventName}
                                </div>
                                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Block: {log.blockNumber.toString()}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    Tx: {log.transactionHash}
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-800">
                                <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(serializeBigInt(log.decodedData), null, 2)}
                                </pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
