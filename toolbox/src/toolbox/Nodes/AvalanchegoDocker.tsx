"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import versions from "../../versions.json";
import { Container } from "../../components/Container";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import InputChainId from "../../components/InputChainId";
import InputSubnetId from "../../components/InputSubnetId";
import { Checkbox } from "../../components/Checkbox";
import BlockchainDetailsDisplay from "../../components/BlockchainDetailsDisplay";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { AddChainModal } from "../../components/ConnectWallet/AddChainModal";
import { useL1ListStore } from "../../stores/l1ListStore";
import { Button } from "../../components/Button";
import { RadioGroup } from "../../components/RadioGroup";
import { Success } from "../../components/Success";
import { nipify, HostInput } from "../../components/HostInput";
import { DockerInstallation } from "../../components/DockerInstallation";
import { NodeReadinessValidator } from "../../components/NodeReadinessValidator";
import { HealthCheckButton } from "../../components/HealthCheckButton";

// Standard subnet-evm VM ID
export const SUBNET_EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy";

export const nodeConfigBase64 = (chainId: string, debugEnabled: boolean, pruningEnabled: boolean) => {
    const vmConfig = debugEnabled ? {
        "pruning-enabled": pruningEnabled,
        "log-level": "debug",
        "warp-api-enabled": true,
        "eth-apis": [
            "eth",
            "eth-filter",
            "net",
            "admin",
            "web3",
            "internal-eth",
            "internal-blockchain",
            "internal-transaction",
            "internal-debug",
            "internal-account",
            "internal-personal",
            "debug",
            "debug-tracer",
            "debug-file-tracer",
            "debug-handler"
        ]
    } : {
        "pruning-enabled": pruningEnabled,
    }

    // First encode the inner config object
    const vmConfigEncoded = btoa(JSON.stringify(vmConfig));

    const configMap: Record<string, { Config: string, Upgrade: any }> = {}
    configMap[chainId] = { Config: vmConfigEncoded, Upgrade: null }

    return btoa(JSON.stringify(configMap))
}

const generateDockerCommand = (subnets: string[], isRPC: boolean, networkID: number, chainId: string, vmId: string, debugEnabled: boolean = false, pruningEnabled: boolean = false) => {
    const env: Record<string, string> = {
        AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK: "true",
        AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns",
        AVAGO_HTTP_HOST: "0.0.0.0",
    };

    subnets = subnets.filter(subnet => subnet !== "");
    if (subnets.length !== 0) {
        env.AVAGO_TRACK_SUBNETS = subnets.join(",");
    }

    if (networkID === networkIDs.FujiID) {
        env.AVAGO_NETWORK_ID = "fuji";
    } else if (networkID === networkIDs.MainnetID) {
        delete env.AVAGO_NETWORK_ID; //default is mainnet
    } else {
        throw new Error(`This tool only supports Fuji (${networkIDs.FujiID}) and Mainnet (${networkIDs.MainnetID}). Network ID ${networkID} is not supported.`);
    }

    if (isRPC) {
        env.AVAGO_HTTP_ALLOWED_HOSTS = "\"*\"";
    }

    env.AVAGO_CHAIN_CONFIG_CONTENT = nodeConfigBase64(chainId, debugEnabled, pruningEnabled);

    // Check if this is a custom VM (not the standard subnet-evm)
    const isCustomVM = vmId !== SUBNET_EVM_VM_ID;

    if (isCustomVM) {
        env.VM_ID = vmId;
    }

    const chunks = [
        "docker run -it -d",
        `--name avago`,
        `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
        `-v ~/.avalanchego:/root/.avalanchego`,
        ...Object.entries(env).map(([key, value]) => `-e ${key}=${value}`),
        `avaplatform/subnet-evm_avalanchego:${versions['avaplatform/subnet-evm_avalanchego']}`
    ];

    // Add vm-aliases-file-content parameter for custom VMs
    if (isCustomVM) {
        chunks.push("/avalanchego/build/avalanchego");
        const vmAliases = {
            [vmId]: [SUBNET_EVM_VM_ID]
        };
        const base64Content = btoa(JSON.stringify(vmAliases, null, 2));
        chunks.push(`--vm-aliases-file-content=${base64Content}`);
    }

    return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
}

const reverseProxyCommand = (domain: string) => {
    domain = nipify(domain);

    return `docker run -d \\
  --name caddy \\
  --network host \\
  -v caddy_data:/data \\
  caddy:2.8-alpine \\
  caddy reverse-proxy --from ${domain} --to localhost:9650`
}

const rpcHealthCheckCommand = (domain: string, chainId: string) => {
    const processedDomain = nipify(domain);

    return `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"eth_chainId", "params":[], "id":1 
}' -H 'content-type:application/json;' \\
https://${processedDomain}/ext/bc/${chainId}/rpc`
}

export default function AvalanchegoDocker() {
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRPC, setIsRPC] = useState<boolean>(true);
    const [rpcCommand, setRpcCommand] = useState("");
    const [nodeRunningMode, setNodeRunningMode] = useState("server");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [isAddChainModalOpen, setIsAddChainModalOpen] = useState<boolean>(false);
    const [chainAddedToWallet, setChainAddedToWallet] = useState<string | null>(null);
    const [nodeIsReady, setNodeIsReady] = useState<boolean>(false);

    const { avalancheNetworkID } = useWalletStore();
    const { addL1 } = useL1ListStore()();

    useEffect(() => {
        try {
            const vmId = blockchainInfo?.vmId || SUBNET_EVM_VM_ID;
            setRpcCommand(generateDockerCommand([subnetId], isRPC, avalancheNetworkID, chainId, vmId, enableDebugTrace, pruningEnabled));
        } catch (error) {
            setRpcCommand((error as Error).message);
        }
    }, [subnetId, isRPC, avalancheNetworkID, enableDebugTrace, chainId, pruningEnabled, blockchainInfo]);

    useEffect(() => {
        setSubnetIdError(null);
        setSubnetId("");
        setSubnet(null);
        setBlockchainInfo(null);
        if (!chainId) return;

        setIsLoading(true);
        getBlockchainInfo(chainId)
            .then(async (chainInfo) => {
                setBlockchainInfo(chainInfo);
                setSubnetId(chainInfo.subnetId);
                try {
                    const subnetInfo = await getSubnetInfo(chainInfo.subnetId);
                    setSubnet(subnetInfo);
                } catch (error) {
                    setSubnetIdError((error as Error).message);
                }
            })
            .catch((error) => {
                setSubnetIdError((error as Error).message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [chainId]);

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
        setIsRPC(true);
        setChainAddedToWallet(null);
        setRpcCommand("");
        setNodeRunningMode("server");
        setDomain("");
        setEnableDebugTrace(false);
        setPruningEnabled(true);
        setSubnetIdError(null);
        setIsAddChainModalOpen(false);
        setNodeIsReady(false);
    };

    // Check if this blockchain uses a custom VM
    const isCustomVM = blockchainInfo && blockchainInfo.vmId !== SUBNET_EVM_VM_ID;

    // Check if there are multiple blockchains on the same subnet
    const hasMultipleBlockchains = subnet && subnet.blockchains && subnet.blockchains.length >= 2;

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

                        <p>If you do not have access to a server, you can also run a node for educational purposes locally. Where are you running your node?</p>

                        <RadioGroup
                            value={nodeRunningMode}
                            className="space-y-2"
                            onChange={(value) => {
                                setNodeRunningMode(value);
                                if (value === "localhost") {
                                    setDomain("");
                                }
                            }}
                            idPrefix={`avago-in-docker-running-mode-`}
                            items={[
                                { value: "server", label: "Server (AWS, GCP, ..,)" },
                                { value: "localhost", label: "On my computer (localhost)" }
                            ]}
                        />
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
                        <p>Enter the Avalanche Blockchain ID (not EVM chain ID) of the L1 you want to run a node for.</p>

                        <InputChainId
                            value={chainId}
                            onChange={setChainId}
                            error={subnetIdError}
                        />
                        <InputSubnetId
                            value={subnetId}
                            onChange={setSubnetId}
                            readOnly={true}
                        />

                        {/* Show subnet details if available */}
                        <BlockchainDetailsDisplay
                            subnet={subnet}
                            isLoading={isLoading}
                        />

                        {/* Warning for multiple blockchains on the same subnet */}
                        {hasMultipleBlockchains && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                                <p className="text-sm">
                                    <strong>Warning:</strong> This subnet has {subnet.blockchains.length} blockchains associated with it. Due to there being multiple chains associated with this subnet, this guide won't be valid for setting up a node for the subnet.
                                </p>
                            </div>
                        )}
                    </Step>

                    {subnetId && blockchainInfo && !hasMultipleBlockchains && (
                        <>
                            <Step>
                                <h3 className="text-xl font-bold mb-4">Configure the Node</h3>
                                <p>Select wether you want to expose the RPC endpoint for the node. This is required to connect a wallet to this node. It is ok to expose RPC on a testnet validator. For mainnet nodes, we recommend running separate validator and RPC nodes.</p>
                                <Checkbox
                                    label={`Expose RPC API`}
                                    checked={isRPC}
                                    onChange={setIsRPC}
                                />

                                {isRPC && <Checkbox
                                    label="Enable Debug & Trace"
                                    checked={enableDebugTrace}
                                    onChange={setEnableDebugTrace}
                                />}

                                {isRPC && <Checkbox
                                    label="Enable Archive Mode (pruning will be disabled)"
                                    checked={!pruningEnabled}
                                    onChange={(checked: boolean) => setPruningEnabled(!checked)}
                                />}
                            </Step>
                            {nodeRunningMode === "server" && (<Step>
                                <h3 className="text-xl font-bold mb-4">Port Configuration</h3>
                                <p>Make sure the following port{isRPC && 's'} are open:</p>
                                <ul>
                                    {isRPC && <>
                                        <li><strong>443</strong> (for the Reverse Proxy)</li>
                                        <li><strong>9650</strong> (for the RPC endpoint)</li>
                                    </>}
                                    <li><strong>9651</strong> (for the node-to-node communication)</li>
                                </ul>
                            </Step>)}

                            <Step>
                                <h3 className="text-xl font-bold">Start AvalancheGo Node</h3>
                                <p>Run the following Docker command to start your node:</p>

                                <DynamicCodeBlock lang="bash" code={rpcCommand} />

                                {isCustomVM && (
                                    <Accordions type="single" className="mt-4">
                                        <Accordion title="Custom VM Configuration">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                This blockchain uses a non-standard Virtual Machine ID. The Docker command automatically includes the <code>--vm-aliases-file-content</code> flag with base64 encoded VM aliases configuration.
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

                                <NodeReadinessValidator
                                    chainId={chainId}
                                    domain={nodeRunningMode === "server" ? domain || "127.0.0.1:9650" : "127.0.0.1:9650"}
                                    isDebugTrace={enableDebugTrace}
                                    onBootstrapCheckChange={(checked) => setNodeIsReady(checked)}
                                />
                            </Step>
                            {nodeIsReady && isRPC && (
                                <>
                                    {nodeRunningMode === "server" && (
                                        <>
                                            <Step>
                                                <h3 className="text-xl font-bold mb-4">Set Up Reverse Proxy</h3>
                                                <p>To connect your wallet you need to be able to connect to the RPC via https. For testing purposes you can set up a reverse Proxy to achieve this.</p>

                                                <p>You can use the following command to check your IP:</p>

                                                <DynamicCodeBlock lang="bash" code="curl checkip.amazonaws.com" />

                                                <p>Paste the IP of your node below:</p>

                                                <HostInput
                                                    label="Domain or IPv4 address for reverse proxy (optional)"
                                                    value={domain}
                                                    onChange={setDomain}
                                                    placeholder="example.com or 1.2.3.4"
                                                />

                                                {domain && (<>
                                                    <p>Run the following command on the machine of your node:</p>
                                                    <DynamicCodeBlock lang="bash" code={reverseProxyCommand(domain)} />
                                                </>)}
                                            </Step>
                                            {domain && (<>
                                                <Step>
                                                    <h3 className="text-xl font-bold mb-4">Check connection via Proxy</h3>
                                                    <p>Do a final check from a machine different then the one that your node is running on.</p>

                                                    <div className="space-y-6">
                                                        <DynamicCodeBlock lang="bash" code={rpcHealthCheckCommand(domain, chainId)} />

                                                        <HealthCheckButton
                                                            chainId={chainId}
                                                            domain={domain}
                                                        />
                                                    </div>
                                                </Step>
                                            </>
                                            )}
                                        </>)}
                                    {(nodeRunningMode === "localhost" || domain) && (<Step>
                                        <h3 className="text-xl font-bold mb-4">Add to Wallet</h3>
                                        <p>Click the button below to add your L1 to your wallet:</p>

                                        <Button
                                            onClick={() => setIsAddChainModalOpen(true)}
                                            className="mt-4 w-48"
                                        >
                                            Add to Wallet
                                        </Button>

                                        {isAddChainModalOpen && <AddChainModal
                                            onClose={() => setIsAddChainModalOpen(false)}
                                            onAddChain={(chain) => {
                                                setChainAddedToWallet(chain.name);
                                                // Try addL1 but catch any errors that might cause resets
                                                try {
                                                    addL1(chain);
                                                } catch (error) {
                                                    console.log("addL1 error (non-blocking):", error);
                                                }
                                            }}
                                            allowLookup={false}
                                            fixedRPCUrl={nodeRunningMode === "server" ? `https://${nipify(domain)}/ext/bc/${chainId}/rpc` : `http://localhost:9650/ext/bc/${chainId}/rpc`}
                                        />}
                                    </Step>)}
                                </>
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
