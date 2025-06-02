"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import versions from "../../versions.json";
import { Container } from "../../components/Container";
import { Input } from "../../components/Input";
import { getBlockchainInfo } from "../../coreViem/utils/glacier";
import { getSubnetVMInfo, STANDARD_SUBNET_EVM_VM_ID, type SubnetVMAnalysis } from "../../coreViem/methods/getSubnetVMInfo";
import InputChainId from "../../components/InputChainId";
import { Checkbox } from "../../components/Checkbox";

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { AddChainModal } from "../../components/ConnectWallet/AddChainModal";
import { useL1ListStore } from "../../stores/l1ListStore";
import { Button } from "../../components/Button";
import { RadioGroup } from "../../components/RadioGroup";
import { Success } from "../../components/Success";


const debugConfigBase64 = (chainId: string) => {
    const debugConfig = {
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
    }

    // First encode the inner config object
    const debugConfigEncoded = btoa(JSON.stringify(debugConfig));

    const configMap: Record<string, { Config: string, Upgrade: any }> = {}
    configMap[chainId] = { Config: debugConfigEncoded, Upgrade: null }

    console.log('configMap', configMap);

    return btoa(JSON.stringify(configMap))
}

const generateVMAliasesSetup = (vmAnalysis: SubnetVMAnalysis) => {
    if (!vmAnalysis.hasNonStandardVMs || Object.keys(vmAnalysis.vmAliases).length === 0) {
        return null;
    }

    // Create JSON format for VM aliases: { "vmId": ["alias"] }
    const vmAliasesJson: Record<string, string[]> = {};
    Object.entries(vmAnalysis.vmAliases).forEach(([vmId, alias]) => {
        vmAliasesJson[vmId] = [alias];
    });

    return `mkdir -p ~/.avalanchego/configs/vms

cat > ~/.avalanchego/configs/vms/aliases.json <<EOF
${JSON.stringify(vmAliasesJson, null, 2)}
EOF`;
};

const generateDockerCommand = (subnets: string[], isRPC: boolean, networkID: number, debugChainId?: string, vmAnalysis?: SubnetVMAnalysis, chainId?: string) => {
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

    if (debugChainId) {
        env.AVAGO_CHAIN_CONFIG_CONTENT = debugConfigBase64(debugChainId);
    }

    // Add VM ID if there are non-standard VMs and we have chain analysis
    if (vmAnalysis?.hasNonStandardVMs && chainId) {
        // Find the VM ID for the specific chain we're targeting
        const targetChain = vmAnalysis.chains.find(chain => chain.blockchainId === chainId);
        if (targetChain && !targetChain.isStandardVM) {
            env.VM_ID = targetChain.vmId;
        }
    }

    const chunks = [
        "docker run -it -d",
        `--name avago`,
        `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
        `-v ~/.avalanchego:/root/.avalanchego`,
        ...Object.entries(env).map(([key, value]) => `-e ${key}=${value}`),
        `avaplatform/subnet-evm:${versions['avaplatform/subnet-evm']}`
    ];
    return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
}

const nipify = (domain: string) => {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(domain)) {
        domain = `${domain}.sslip.io`;
    }
    return domain;
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

const checkNodeCommand = (chainID: string, domain: string, isDebugTrace: boolean) => {
    domain = nipify(domain);
    if (domain.startsWith("127.0.0.1")) {
        domain = "http://" + domain;
    } else {
        domain = "https://" + domain;
    }

    if (!isDebugTrace) {
        return `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"eth_chainId", "params":[], "id":1 
}' -H 'content-type:application/json;' \\
${domain}/ext/bc/${chainID}/rpc`
    } else {
        return `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"debug_traceBlockByNumber", "params":["latest", {}], "id":1 
}' -H 'content-type:application/json;' \\
${domain}/ext/bc/${chainID}/rpc`
    }
}

const dockerInstallInstructions: Record<string, string> = {
    'Ubuntu/Debian': `sudo apt-get update && \\
    sudo apt-get install -y docker.io && \\
    sudo usermod -aG docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
    'Amazon Linux 2023+': `sudo yum update -y && \\
    sudo yum install -y docker && \\
    sudo service docker start && \\
    sudo usermod -a -G docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
    'Fedora': `sudo dnf update -y && \\
    sudo dnf -y install docker && \\
    sudo systemctl start docker && \\
    sudo usermod -a -G docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
} as const;

type OS = keyof typeof dockerInstallInstructions;

export default function AvalanchegoDocker() {
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [isRPC, setIsRPC] = useState<boolean>(true);
    const [rpcCommand, setRpcCommand] = useState("");
    const [nodeRunningMode, setNodeRunningMode] = useState("server");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [isAddChainModalOpen, setIsAddChainModalOpen] = useState<boolean>(false);
    const [chainAddedToWallet, setChainAddedToWallet] = useState<string | null>(null);
    const [vmAnalysis, setVmAnalysis] = useState<SubnetVMAnalysis | null>(null);
    const [isAnalyzingVMs, setIsAnalyzingVMs] = useState<boolean>(false);
    const [vmAnalysisError, setVmAnalysisError] = useState<string | null>(null);

    const { avalancheNetworkID, coreWalletClient } = useWalletStore();
    const { addL1 } = useL1ListStore()();

    useEffect(() => {
        try {
            setRpcCommand(generateDockerCommand([subnetId], isRPC, avalancheNetworkID, enableDebugTrace ? chainId : undefined, vmAnalysis || undefined, chainId));
        } catch (error) {
            setRpcCommand((error as Error).message);
        }
    }, [subnetId, isRPC, avalancheNetworkID, enableDebugTrace, chainId, vmAnalysis]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);


    useEffect(() => {
        setSubnetIdError(null);
        setSubnetId("");
        setVmAnalysis(null);
        setVmAnalysisError(null);
        if (!chainId) return

        getBlockchainInfo(chainId).then((chainInfo) => {
            setSubnetId(chainInfo.subnetId);

            // Analyze VM compatibility for the subnet
            if (coreWalletClient && chainInfo.subnetId) {
                setIsAnalyzingVMs(true);
                setVmAnalysisError(null);

                getSubnetVMInfo(coreWalletClient, chainInfo.subnetId)
                    .then((analysis) => {
                        setVmAnalysis(analysis);
                        console.log('VM Analysis:', analysis);
                    })
                    .catch((error) => {
                        console.error('Failed to analyze VM compatibility:', error);
                        setVmAnalysisError(error.message);
                    })
                    .finally(() => {
                        setIsAnalyzingVMs(false);
                    });
            }
        }).catch((error) => {
            setSubnetIdError((error as Error).message);
        });
    }, [chainId, coreWalletClient]);

    const handleReset = () => {
        setChainId("");
        setSubnetId("");
        setIsRPC(true);
        setChainAddedToWallet(null);
        setRpcCommand("");
        setNodeRunningMode("server");
        setDomain("");
        setEnableDebugTrace(false);
        setSubnetIdError(null);
        setIsAddChainModalOpen(false);
        setVmAnalysis(null);
        setVmAnalysisError(null);
        setIsAnalyzingVMs(false);
    };


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
                        <h3 className="text-xl font-bold mb-4">Docker Installation</h3>
                        <p>Make sure you have Docker installed on your system. You can use the following commands to install it:</p>

                        <Tabs items={Object.keys(dockerInstallInstructions)}>
                            {Object.keys(dockerInstallInstructions).map((os) => (
                                <Tab
                                    key={os}
                                    value={os as OS}
                                >
                                    <DynamicCodeBlock lang="bash" code={dockerInstallInstructions[os]} />
                                </Tab>
                            ))}
                        </Tabs>


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
                            hidePrimaryNetwork={true}
                        />

                        <Input
                            label="Subnet ID"
                            value={subnetId}
                            disabled={true}
                            error={subnetIdError}
                        />

                        {/* VM Analysis Feedback */}
                        {isAnalyzingVMs && (
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                    <span className="text-sm text-blue-800 dark:text-blue-200">Analyzing VM compatibility...</span>
                                </div>
                            </div>
                        )}

                        {vmAnalysisError && (
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    <strong>VM Analysis Error:</strong> {vmAnalysisError}
                                </p>
                            </div>
                        )}

                        {vmAnalysis && vmAnalysis.chains.length > 0 && (
                            <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">VM Configuration Analysis</h4>

                                {vmAnalysis.hasNonStandardVMs ? (
                                    <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            ⚠️ <strong>Custom VM Detected:</strong> This subnet contains chains with non-standard Virtual Machines.
                                            You'll need to set up VM aliases before starting your node.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                                        <p className="text-sm text-green-800 dark:text-green-200">
                                            ✅ <strong>Standard VM:</strong> All chains use the standard Subnet-EVM.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    {vmAnalysis.chains.map((chain) => (
                                        <div key={chain.blockchainId} className="text-xs text-zinc-600 dark:text-zinc-400">
                                            <span className="font-mono">{chain.blockchainName || 'Unknown'}</span>
                                            {!chain.isStandardVM && (
                                                <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                                                    (Custom VM: {chain.vmId.slice(0, 12)}...)
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {vmAnalysis.hasNonStandardVMs && Object.keys(vmAnalysis.vmAliases).length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-600">
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">VM Aliases:</p>
                                        {Object.entries(vmAnalysis.vmAliases).map(([vmId, alias]) => (
                                            <div key={vmId} className="text-xs font-mono text-zinc-500 dark:text-zinc-500">
                                                {alias} → {vmId.slice(0, 12)}...
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Step>

                    {subnetId && (
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
                            {vmAnalysis?.hasNonStandardVMs && Object.keys(vmAnalysis.vmAliases).length > 0 && (
                                <Step>
                                    <h3 className="text-xl font-bold mb-4">Set Up VM Alias Mapping</h3>
                                    <p>This L1 uses custom Virtual Machines that require alias mapping. Run the following commands to set up the VM aliases before starting your node:</p>

                                    <DynamicCodeBlock lang="bash" code={generateVMAliasesSetup(vmAnalysis) || ""} />

                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-sm text-blue-800 dark:text-blue-200">
                                            <strong>Note:</strong> This creates an aliases.json file that maps custom VM IDs to shorter names,
                                            allowing AvalancheGo to properly handle the custom Virtual Machines used by this L1.
                                        </p>
                                    </div>
                                </Step>
                            )}
                            <Step>
                                <h3 className="text-xl font-bold">Start AvalancheGo Node</h3>
                                <p>Run the following Docker command to start your node:</p>

                                <DynamicCodeBlock lang="bash" code={rpcCommand} />

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

                                <p> During the bootstrapping process the following command will return a <code>404 page not found</code> error.</p>

                                <DynamicCodeBlock lang="bash" code={checkNodeCommand(chainId, "127.0.0.1:9650", false)} />

                                <p> Once it the bootstrapping is complete it will return a response like <code>{'{"jsonrpc":"2.0","id":1,"result":"..."}'}</code>.</p>
                            </Step>
                            {chainId && enableDebugTrace && (
                                <Step>
                                    <h3 className="text-xl font-bold mb-4">Test Debug & Trace</h3>
                                    <div className="space-y-4">
                                        <DynamicCodeBlock lang="bash" code={checkNodeCommand(chainId, "127.0.0.1:9650", true)} />
                                        <div className="mt-4">Make sure you make at least one transaction on your chain, or it will error "genesis is untracable".</div>
                                    </div>
                                </Step>
                            )}
                            {isRPC && (
                                <>
                                    {nodeRunningMode === "server" && (
                                        <>
                                            <Step>
                                                <h3 className="text-xl font-bold mb-4">Set Up Reverse Proxy</h3>
                                                <p>To connect your wallet you need to be able to connect to the RPC via https. For testing purposes you can set up a reverse Proxy to achieve this.</p>

                                                <p>You can use the following command to check your IP:</p>

                                                <DynamicCodeBlock lang="bash" code="curl checkip.amazonaws.com" />

                                                <p>Paste the IP of your node below:</p>

                                                <Input
                                                    label="Domain or IPv4 address for reverse proxy (optional)"
                                                    value={domain}
                                                    onChange={(newValue) => setDomain(newValue.trim())}
                                                    placeholder="example.com  or 1.2.3.4"
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

                                                    <DynamicCodeBlock lang="bash" code={checkNodeCommand(chainId, domain, false)} />
                                                </Step>
                                            </>
                                            )}
                                        </>)}
                                    {(nodeRunningMode === "localhost" || domain) && (<Step>
                                        <h3 className="text-xl font-bold mb-4">Add to Wallet</h3>
                                        <p>Add your L1 to your Wallet if all checks above passed</p>

                                        <Button onClick={() => setIsAddChainModalOpen(true)} className="mt-4 w-48">Add to Wallet</Button>
                                        {isAddChainModalOpen && <AddChainModal
                                            onClose={() => setIsAddChainModalOpen(false)}
                                            onAddChain={(chain) => {
                                                addL1(chain);
                                                setChainAddedToWallet(chain.name);
                                            }}
                                            allowLookup={false}
                                            fixedRPCUrl={nodeRunningMode === "server" ? `https://${nipify(domain)}/ext/bc/${chainId}/rpc` : `http://localhost:9650/ext/bc/${chainId}/rpc`}
                                        />}
                                    </Step>)}
                                </>
                            )}
                        </>)}


                </Steps>

                {chainAddedToWallet && (<>
                    <Success label="Chain added to Wallet" value={chainAddedToWallet} />
                    <Button onClick={handleReset} className="mt-4 w-full">Reset</Button>
                </>)}

            </Container >
        </>
    );
};
