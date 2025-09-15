"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Container } from "@/components/toolbox/components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { DockerInstallation } from "@/components/toolbox/components/DockerInstallation";
import { NodeBootstrapCheck } from "@/components/toolbox/components/NodeBootstrapCheck";
import { ReverseProxySetup } from "@/components/toolbox/components/ReverseProxySetup";
import { ConfigureNodeType } from "@/components/toolbox/components/ConfigureNodeType";
import { C_CHAIN_ID, generateDockerCommand } from "@/components/toolbox/console/layer-1/create/config";

export default function AvalancheGoDockerPrimaryNetwork() {
    const [nodeType, setNodeType] = useState<"validator" | "public-rpc">("validator");
    const [rpcCommand, setRpcCommand] = useState("");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [nodeIsReady, setNodeIsReady] = useState<boolean>(false);

    const { avalancheNetworkID } = useWalletStore();

    const isRPC = nodeType === "public-rpc";

    useEffect(() => {
        try {
            setRpcCommand(generateDockerCommand(
                [], // No subnets for Primary Network
                isRPC,
                avalancheNetworkID,
                C_CHAIN_ID,
                "", // No custom VM ID for Primary Network
                enableDebugTrace,
                pruningEnabled,
                true // isPrimaryNetwork = true
            ));
        } catch (error) {
            setRpcCommand((error as Error).message);
        }
    }, [isRPC, avalancheNetworkID, enableDebugTrace, pruningEnabled]);

    useEffect(() => {
        if (nodeType === "validator") {
            setDomain("");
            setEnableDebugTrace(false);
            setPruningEnabled(true);
        }
    }, [nodeType]);

    return (
        <>
            <Container
                title="Primary Network Node Setup with Docker"
                description="Set up a Docker container running a validator or RPC node for the Avalanche Primary Network (P-Chain, X-Chain, and C-Chain)."
            >
                <Steps>
                    <Step>
                        <h3 className="text-xl font-bold mb-4">Set up Instance</h3>
                        <p>Set up a linux server with any cloud provider, like AWS, GCP, Azure, or Digital Ocean. For Primary Network nodes, we recommend:</p>
                        <ul className="list-disc pl-5 mt-2 mb-4">
                            <li><strong>Minimum specs:</strong> 8 vCPUs, 16GB RAM, 1TB storage</li>
                            <li><strong>Recommended specs:</strong> 16 vCPUs, 32GB RAM, 2TB NVMe SSD</li>
                        </ul>

                        <p>If you do not have access to a server, you can also run a node for educational purposes locally. Simply select the "RPC Node (Local)" option in the next step.</p>
                    </Step>

                    <Step>
                        <DockerInstallation includeCompose={false} />

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
                        <ConfigureNodeType
                            nodeType={nodeType}
                            setNodeType={setNodeType}
                            isRPC={isRPC}
                            enableDebugTrace={enableDebugTrace}
                            setEnableDebugTrace={setEnableDebugTrace}
                            pruningEnabled={pruningEnabled}
                            setPruningEnabled={setPruningEnabled}
                        />
                    </Step>

                    <Step>
                        <h3 className="text-xl font-bold">Start AvalancheGo Node</h3>
                        <p>Run the following Docker command to start your Primary Network node:</p>

                        <DynamicCodeBlock lang="bash" code={rpcCommand} />

                        <Accordions type="single" className="mt-8">
                            <Accordion title="Running Multiple Nodes on the same machine">
                                <p>To run multiple validator nodes on the same machine, ensure each node has:</p>
                                <ul className="list-disc pl-5 mt-1">
                                    <li>Unique container name (change <code>--name</code> parameter)</li>
                                    <li>Different ports (modify <code>-p</code> parameters)</li>
                                    <li>Separate data directories (change the local volume path <code>~/.avalanchego</code> to a unique directory)</li>
                                </ul>
                                <p className="mt-1">Example for second node: Use ports 9652/9653, container name "avago2", and data directory "~/.avalanchego2"</p>
                            </Accordion>
                        </Accordions>
                    </Step>

                    {/* Conditional steps based on node type */}
                    {nodeType === "public-rpc" && (
                        <Step>
                            <ReverseProxySetup
                                domain={domain}
                                setDomain={setDomain}
                                chainId={C_CHAIN_ID}
                                showHealthCheck={true}
                            />
                        </Step>
                    )}



                    {nodeType === "validator" && (
                        <Step>
                            <h3 className="text-xl font-bold">Wait for the Node to Bootstrap</h3>
                            <p>Your node will now bootstrap and sync the Primary Network (P-Chain, X-Chain, and C-Chain). This process can take <strong>several hours to days</strong> depending on your hardware and network connection.</p>

                            <p className="mt-4">You can follow the process by checking the logs with the following command:</p>

                            <DynamicCodeBlock lang="bash" code="docker logs -f avago" />

                            <Accordions type="single" className="mt-8">
                                <Accordion title="Understanding the Logs">
                                    <p>The bootstrapping process involves syncing all three chains:</p>

                                    <ul className="list-disc pl-5 mt-1">
                                        <li>
                                            <strong>P-Chain (Platform Chain):</strong> Handles platform operations and staking
                                            <DynamicCodeBlock lang="bash" code='[05-04|17:14:13.793] INFO <P Chain> bootstrap/bootstrapper.go:615 fetching blocks {"numFetchedBlocks": 10099, "numTotalBlocks": 23657, "eta": "37s"}' />
                                        </li>
                                        <li>
                                            <strong>X-Chain (Exchange Chain):</strong> Handles asset creation and exchange
                                            <DynamicCodeBlock lang="bash" code='[05-04|17:14:45.641] INFO <X Chain> bootstrap/storage.go:244 executing blocks {"numExecuted": 9311, "numToExecute": 23657, "eta": "15s"}' />
                                        </li>
                                        <li>
                                            <strong>C-Chain (Contract Chain):</strong> EVM-compatible smart contract chain
                                            <DynamicCodeBlock lang="bash" code='[05-04|17:15:12.123] INFO <C Chain> chain/chain_state_manager.go:325 syncing {"current": 1234567, "target": 2345678}' />
                                        </li>
                                    </ul>
                                </Accordion>
                            </Accordions>

                            <NodeBootstrapCheck
                                chainId={C_CHAIN_ID}
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
                            <p>Your AvalancheGo Primary Network node is now fully bootstrapped and ready to be used as a validator node.</p>

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
                                            Your node has successfully synced with the Primary Network and is ready to be added as a validator.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Step>
                    )}
                </Steps>


            </Container>
        </>
    );
}
