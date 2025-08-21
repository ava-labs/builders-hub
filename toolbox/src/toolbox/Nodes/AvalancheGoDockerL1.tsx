"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Container } from "../../components/Container";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import InputSubnetId from "../../components/InputSubnetId";
import BlockchainDetailsDisplay from "../../components/BlockchainDetailsDisplay";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Button } from "../../components/Button";
import { Success } from "../../components/Success";
import { DockerInstallation } from "../../components/DockerInstallation";
import { NodeBootstrapCheck } from "../../components/NodeBootstrapCheck";
import { ReverseProxySetup } from "../../components/ReverseProxySetup";
import { AddToWalletStep } from "../../components/AddToWalletStep";
import { ConfigureNodeType } from "../../components/ConfigureNodeType";
import { SUBNET_EVM_VM_ID, generateDockerCommand } from "./config";

export default function AvalanchegoDocker() {
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [nodeType, setNodeType] = useState<"validator" | "public-rpc">("validator");
    const [rpcCommand, setRpcCommand] = useState("");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [chainAddedToWallet, setChainAddedToWallet] = useState<string | null>(null);
    const [nodeIsReady, setNodeIsReady] = useState<boolean>(false);
    const [selectedRPCBlockchainId, setSelectedRPCBlockchainId] = useState<string>("");

    const { avalancheNetworkID } = useWalletStore();

    const isRPC = nodeType === "public-rpc";

    useEffect(() => {
        try {
            const vmId = blockchainInfo?.vmId || SUBNET_EVM_VM_ID;
            setRpcCommand(generateDockerCommand(
                [subnetId],
                isRPC,
                avalancheNetworkID,
                chainId,
                vmId,
                enableDebugTrace,
                pruningEnabled,
                false // isPrimaryNetwork = false
            ));
        } catch (error) {
            setRpcCommand((error as Error).message);
        }
    }, [subnetId, isRPC, avalancheNetworkID, enableDebugTrace, chainId, pruningEnabled, blockchainInfo]);

    useEffect(() => {
        if (nodeType === "validator") {
            setDomain("");
            setEnableDebugTrace(false);
            setPruningEnabled(true);
        }
    }, [nodeType]);

    useEffect(() => {
        setSubnetIdError(null);
        setChainId("");
        setSubnet(null);
        setBlockchainInfo(null);
        if (!subnetId) return;

        // Use AbortController to cancel previous requests
        const abortController = new AbortController();

        setIsLoading(true);

        const loadSubnetData = async () => {
            try {
                const subnetInfo = await getSubnetInfo(subnetId, abortController.signal);

                // Check if this request was cancelled
                if (abortController.signal.aborted) return;

                setSubnet(subnetInfo);

                // Always get blockchain info for the first blockchain (for Docker command generation)
                if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
                    const blockchainId = subnetInfo.blockchains[0].blockchainId;
                    setChainId(blockchainId);
                    setSelectedRPCBlockchainId(blockchainId); // Auto-select first blockchain for RPC

                    try {
                        const chainInfo = await getBlockchainInfo(blockchainId, abortController.signal);

                        // Check if this request was cancelled
                        if (abortController.signal.aborted) return;

                        setBlockchainInfo(chainInfo);
                    } catch (error) {
                        if (!abortController.signal.aborted) {
                            setSubnetIdError((error as Error).message);
                        }
                    }
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    setSubnetIdError((error as Error).message);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadSubnetData();

        // Cleanup function to abort the request if component unmounts or subnetId changes
        return () => {
            abortController.abort();
        };
    }, [subnetId]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);

    const handleReset = () => {
        setChainId("");
        setSubnetId("");
        setSubnet(null);
        setBlockchainInfo(null);
        setNodeType("validator");
        setChainAddedToWallet(null);
        setRpcCommand("");
        setDomain("");
        setEnableDebugTrace(false);
        setPruningEnabled(true);
        setSubnetIdError(null);
        setNodeIsReady(false);
        setSelectedRPCBlockchainId("");
    };

    // Check if this blockchain uses a custom VM
    const isCustomVM = blockchainInfo && blockchainInfo.vmId !== SUBNET_EVM_VM_ID;

    return (
        <>
            <Container
                title="Node Setup with Docker"
                description="This will start a Docker container running an RPC or validator node that tracks your L1."
            >
                <Steps>
                    <Step>
                        <h3 className="text-xl font-bold mb-4">Set up Instance</h3>
                        <p>Set up a linux server with any cloud provider, like AWS, GCP, Azure, or Digital Ocean. Low specs (e.g. 2 vCPUs, 4GB RAM,  20GB storage) are sufficient for basic tests. For more extensive test and production L1s use a larger instance with appropriate resources (e.g. 8 vCPUs, 16GB RAM, 1 TB storage).</p>

                        <p>If you do not have access to a server, you can also run a node for educational purposes locally. Simply select the "RPC Node (Local)" option in the next step.</p>

                    </Step>
                    <Step>
                        <DockerInstallation
                            includeCompose={false}
                        />

                        <p className="mt-4">
                            If you do not want to use Docker, you can follow the instructions{" "}
                            <a
                                href="https://github.com/ava-labs/avalanchego?tab=readme-ov-file#installation"
                                target="_blank"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                rel="noreferrer"
                            >
                                here
                            </a>
                            .
                        </p>
                    </Step>

                    <Step>
                        <h3 className="text-xl font-bold mb-4">Select L1</h3>
                        <p>Enter the Avalanche Subnet ID of the L1 you want to run a node for.</p>

                        <InputSubnetId
                            value={subnetId}
                            onChange={setSubnetId}
                            error={subnetIdError}
                        />

                        {/* Show subnet details if available */}
                        {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
                            <div className="space-y-4">
                                {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string; createBlockTimestamp: number; createBlockNumber: string; vmId: string; subnetId: string; evmChainId: number }) => (
                                    <BlockchainDetailsDisplay
                                        key={blockchain.blockchainId}
                                        blockchain={{
                                            ...blockchain,
                                            isTestnet: avalancheNetworkID === networkIDs.FujiID
                                        }}
                                        isLoading={isLoading}
                                        customTitle={`${blockchain.blockchainName} Blockchain Details`}
                                    />
                                ))}
                            </div>
                        )}
                    </Step>

                    {subnetId && blockchainInfo && (
                        <>
                            <Step>
                                <ConfigureNodeType
                                    nodeType={nodeType}
                                    setNodeType={setNodeType}
                                    isRPC={isRPC}
                                    enableDebugTrace={enableDebugTrace}
                                    setEnableDebugTrace={setEnableDebugTrace}
                                    pruningEnabled={pruningEnabled}
                                    setPruningEnabled={setPruningEnabled}
                                >
                                    {/* Blockchain selection for multiple blockchains */}
                                    {nodeType === "public-rpc" && subnet && subnet.blockchains && subnet.blockchains.length > 1 && (
                                        <div className="mt-6">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Select Blockchain for RPC Endpoint
                                            </label>
                                            <select
                                                value={selectedRPCBlockchainId}
                                                onChange={(e) => setSelectedRPCBlockchainId(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            >
                                                {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string }) => (
                                                    <option key={blockchain.blockchainId} value={blockchain.blockchainId}>
                                                        {blockchain.blockchainName} ({blockchain.blockchainId})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                This blockchain will be used for the RPC endpoint URL generation.
                                            </p>
                                        </div>
                                    )}
                                </ConfigureNodeType>
                            </Step>

                            <Step>
                                <h3 className="text-xl font-bold">Start AvalancheGo Node</h3>
                                <p>Run the following Docker command to start your node:</p>

                                <DynamicCodeBlock lang="bash" code={rpcCommand} />

                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    For advanced node configuration options, see the{" "}
                                    <a
                                        href="https://build.avax.network/docs/nodes/configure/configs-flags"
                                        target="_blank"
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                        rel="noreferrer"
                                    >
                                        AvalancheGo configuration flags documentation
                                    </a>.
                                </p>

                                {isCustomVM && (
                                    <Accordions type="single" className="mt-4">
                                        <Accordion title="Custom VM Configuration">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                This blockchain uses a non-standard Virtual Machine ID. The Docker command automatically includes the <code>AVAGO_VM_ALIASES_FILE_CONTENT</code> environment variable with base64 encoded VM aliases configuration.
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                                <strong>VM ID:</strong> {blockchainInfo.vmId}<br />
                                                <strong>Aliases to:</strong> {SUBNET_EVM_VM_ID}
                                            </p>
                                        </Accordion>
                                    </Accordions>
                                )}

                                <Accordions type="single" className="mt-8">
                                    <Accordion title="Running Multiple Nodes on the same machine">
                                        <p>To run multiple validator nodes on the same machine, ensure each node has:</p>
                                        <ul className="list-disc pl-5 mt-1">
                                            <li>Unique container name (change <code>--name</code> parameter)</li>
                                            <li>Different ports (modify <code>AVAGO_HTTP_PORT</code> and <code>AVAGO_STAKING_PORT</code>)</li>
                                            <li>Separate data directories (change the local volume path <code>~/.avalanchego</code> to a unique directory)</li>
                                        </ul>
                                        <p className="mt-1">Example for second node: Use ports 9652/9653 (HTTP/staking), container name "avago2", and data directory "~/.avalanchego2"</p>
                                    </Accordion>
                                </Accordions>
                            </Step>


                            {/* Conditional steps based on nodeType */}
                            {nodeType === "public-rpc" && (
                                <Step>
                                    <ReverseProxySetup
                                        domain={domain}
                                        setDomain={setDomain}
                                        chainId={selectedRPCBlockchainId}
                                        showHealthCheck={true}
                                    />
                                </Step>
                            )}
                            {((nodeType === "public-rpc" && !!domain)) && (
                                <Step>
                                    <AddToWalletStep
                                        chainId={selectedRPCBlockchainId || chainId}
                                        domain={domain}
                                        nodeRunningMode={nodeType === 'public-rpc' ? 'server' : 'localhost'}
                                        onChainAdded={setChainAddedToWallet}
                                    />
                                </Step>
                            )}

                            {nodeType === "validator" && (
                                <Step>
                                    <h3 className="text-xl font-bold">Wait for the Node to Bootstrap</h3>
                                    <p>Your node will now bootstrap and sync the P-Chain and your L1. This process should take a <strong>few minutes</strong>. You can follow the process by checking the logs with the following command:</p>

                                    <DynamicCodeBlock lang="bash" code="docker logs -f avago" />

                                    <Accordions type="single" className="mt-8">
                                        <Accordion title="Understanding the Logs">
                                            <p>The bootstrapping has three phases:</p>

                                            <ul className="list-disc pl-5 mt-1">
                                                <li>
                                                    <strong>Fetching the blocks of the P-Chain:</strong>
                                                    The node fetches all the P-Chain blocks. The <code>eta</code> field is giving the estimated remaining time for the fetching process.
                                                    <DynamicCodeBlock lang="bash" code='[05-04|17:14:13.793] INFO <P Chain> bootstrap/bootstrapper.go:615 fetching blocks {"numFetchedBlocks": 10099, "numTotalBlocks": 23657, "eta": "37s"}' />
                                                </li>
                                                <li>
                                                    <strong>Executing the blocks of the P-Chain:</strong>
                                                    The node will sync the P-Chain and your L1.
                                                    <DynamicCodeBlock lang="bash" code='[05-04|17:14:45.641] INFO <P Chain> bootstrap/storage.go:244 executing blocks {"numExecuted": 9311, "numToExecute": 23657, "eta": "15s"}' />
                                                </li>
                                            </ul>
                                            <p>After the P-Chain is fetched and executed the process is repeated for the tracked Subnet.</p>
                                        </Accordion>
                                    </Accordions>

                                    <NodeBootstrapCheck
                                        chainId={chainId}
                                        domain={domain || "127.0.0.1:9650"}
                                        isDebugTrace={enableDebugTrace}
                                        onBootstrapCheckChange={(checked: boolean) => setNodeIsReady(checked)}
                                    />
                                </Step>
                            )}

                            {/* Show success message when node is ready for validator mode */}
                            {nodeIsReady && nodeType === "validator" && (
                                <Step>
                                    <h3 className="text-xl font-bold mb-4">Node Setup Complete</h3>
                                    <p>Your AvalancheGo node is now fully bootstrapped and ready to be used as a validator node.</p>

                                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                                    Node is ready for validation
                                                </p>
                                                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                                    Your node has successfully synced with the network and is ready to be added as a validator.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </Step>
                            )}
                        </>)}


                </Steps>

                {chainAddedToWallet && (
                    <>
                        <Success label="Node Setup Complete" value={chainAddedToWallet} />
                        <Button onClick={handleReset} className="mt-4 w-full">Reset</Button>
                    </>
                )}

            </Container >
        </>
    );
};
