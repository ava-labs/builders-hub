"use client";

import { Checkbox } from "./Checkbox";

type NodeType = "validator" | "public-rpc";

interface ConfigureNodeTypeProps {
    nodeType: NodeType;
    setNodeType: (type: NodeType) => void;
    isRPC: boolean;
    enableDebugTrace: boolean;
    setEnableDebugTrace: (enabled: boolean) => void;
    pruningEnabled: boolean;
    setPruningEnabled: (enabled: boolean) => void;
    children?: React.ReactNode;
}

export const ConfigureNodeType: React.FC<ConfigureNodeTypeProps> = ({
    nodeType,
    setNodeType,
    isRPC,
    enableDebugTrace,
    setEnableDebugTrace,
    pruningEnabled,
    setPruningEnabled,
    children
}) => {
    return (
        <>
            <h3 className="text-xl font-bold mb-4">Configure Node Type</h3>
            <p className="mb-4">What type of node do you want to run?</p>

            <div className="space-y-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                        type="radio"
                        name="nodeType"
                        value="validator"
                        checked={nodeType === "validator"}
                        onChange={() => setNodeType("validator")}
                        className="mt-1"
                    />
                    <div>
                        <div className="font-medium">Validator Node</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Participates in consensus. RPC endpoint is not exposed externally.
                        </div>
                    </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                        type="radio"
                        name="nodeType"
                        value="public-rpc"
                        checked={nodeType === "public-rpc"}
                        onChange={() => setNodeType("public-rpc")}
                        className="mt-1"
                    />
                    <div>
                        <div className="font-medium">Public RPC Node</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Exposes RPC endpoint publicly via HTTPS. Suitable for production dApps and requires a server.
                        </div>
                    </div>
                </label>
            </div>

            {isRPC && (
                <div className="mt-6 space-y-4 border-t pt-4">
                    <h4 className="font-medium">RPC Options</h4>
                    
                    <Checkbox
                        label="Enable Debug & Trace APIs"
                        checked={enableDebugTrace}
                        onChange={setEnableDebugTrace}
                    />

                    <Checkbox
                        label="Enable Archive Mode (disable pruning)"
                        checked={!pruningEnabled}
                        onChange={(checked: boolean) => setPruningEnabled(!checked)}
                    />
                </div>
            )}
            
            {/* Port configuration for validator node */}
            {nodeType === 'validator' && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium mb-2">Required Ports</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Make sure the following port is open on your server:
                    </p>
                    <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                        <li><strong>9651</strong> - Node-to-node communication</li>
                    </ul>
                </div>
            )}
            
            {/* Port configuration for public RPC node */}
            {nodeType === 'public-rpc' && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium mb-2">Required Ports</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Make sure the following ports are open on your server:
                    </p>
                    <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                        <li><strong>443</strong> - HTTPS for public RPC access</li>
                        <li><strong>9650</strong> - RPC endpoint</li>
                        <li><strong>9651</strong> - Node-to-node communication</li>
                    </ul>
                </div>
            )}
            {children}
        </>
    );
}; 