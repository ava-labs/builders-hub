"use client";

import { useToolboxStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { AbiEvent } from 'viem';
import { useEffect, useState } from "react";
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { Button, Input } from "../../ui";
import { RequireChainL1 } from "../../ui/RequireChain";
type ViewData = {
    [key: string]: any;
};

const serializeValue = (value: any): any => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, serializeValue(v)])
        );
    }
    return value;
};

export default function ReadContract() {
    const { showBoundary } = useErrorBoundary();
    const { proxyAddress, setProxyAddress } = useToolboxStore();
    const [viewData, setViewData] = useState<ViewData>({});
    const [isReading, setIsReading] = useState(false);
    const [eventLogs, setEventLogs] = useState<Record<string, any[]>>({});
    const { publicClient } = useWalletStore();

    async function readContractData() {
        if (!proxyAddress) {
            return;
        }
        setIsReading(true);
        setEventLogs({});

        if (!proxyAddress || !window.avalanche) return;

        try {
            // Read all view functions
            const viewFunctions = ValidatorManagerABI.abi.filter(
                (item: any) => item.type === "function" &&
                    (item.stateMutability === "view" || item.stateMutability === "pure")
            );

            const data: ViewData = {};

            for (const func of viewFunctions) {
                if (!func.name) continue;
                if (func.inputs.length > 0) continue;

                try {
                    const result = await publicClient.readContract({
                        address: proxyAddress as `0x${string}`,
                        abi: [func],
                        functionName: func.name,
                    });
                    data[func.name] = serializeValue(result);
                } catch (error) {
                    console.error(`Error reading ${func.name}:`, error);
                    data[func.name] = "Error reading value:\n" + (error as Error)?.message || "Unknown error";
                }
            }

            setViewData(data);

            // Get all events
            const events = ValidatorManagerABI.abi.filter(
                (item: any) => item.type === "event"
            );

            const logs: Record<string, any[]> = {};
            for (const event of events) {
                if (!event.name) continue;
                try {
                    const eventLogs = await publicClient.getLogs({
                        address: proxyAddress as `0x${string}`,
                        event: event as AbiEvent,
                        fromBlock: 0n,
                        toBlock: 'latest'
                    });

                    logs[event.name] = eventLogs.map(log => serializeValue(log));
                } catch (error) {
                    console.error(`Error getting logs for ${event.name}:`, error);
                }
            }
            console.log('Event logs:', logs);
            setEventLogs(logs);

        } catch (error) {
            console.error('Main error:', error);
            showBoundary(error);
        } finally {
            setIsReading(false);
        }
    }

    useEffect(() => {
        readContractData();
    }, [proxyAddress]);

    return (
        <RequireChainL1>
            <div className="space-y-8">
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold ">Read Proxy Contract</h2>
                    <Input
                        label="Proxy Address"
                        value={proxyAddress || ""}
                        placeholder="0x..."
                        onChange={(value) => setProxyAddress(value)}
                        button={
                            <Button
                                type="primary"
                                onClick={readContractData}
                                loading={isReading}
                                className="h-9 rounded-l-none"
                            >
                                Refresh
                            </Button>
                        }
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-500">
                        <thead>
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-b border-gray-500">
                                    Function
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-b border-gray-500">
                                    Value
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(viewData).map(([key, value]) => (
                                <tr key={key} className="hover:bg-gray-50/10">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium border-b border-gray-500">
                                        {key}
                                    </td>
                                    <td className="px-6 py-4 text-sm border-b border-gray-500">
                                        <pre className="whitespace-pre-wrap font-mono rounded border border-gray-500 p-2">
                                            {typeof value === 'string'
                                                ? value
                                                : JSON.stringify(value, null, 2)}
                                        </pre>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {Object.keys(eventLogs).length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Events</h3>
                        <div className="space-y-4">
                            {Object.entries(eventLogs).map(([eventName, logs]) => (
                                <div key={eventName} className="p-4 rounded-lg border border-gray-500">
                                    <h4 className="font-medium mb-2">{eventName}</h4>
                                    <pre className="text-sm overflow-auto">
                                        {JSON.stringify(logs, null, 2)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </RequireChainL1>
    );
};
