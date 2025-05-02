"use client";

import { useWalletStore } from "../../lib/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import versions from "../../versions.json";
import { CodeHighlighter } from "../../components/CodeHighlighter";
import { Container } from "../components/Container";
import { Input } from "../../components/Input";
import { Tabs } from "../../components/Tabs";
import { getBlockchainInfo } from "../../coreViem/utils/glacier";
import InputChainId from "../components/SelectChainId";
import { Checkbox } from "../../components/Checkbox";

const generateDockerCommand = (subnets: string[], isRPC: boolean, networkID: number) => {
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

    const chunks = [
        "docker run -it -d",
        `--name avago`,
        `-p ${isRPC ? "" : "127.0.0.1: "}9650:9650 -p 9651:9651`,
        `-v ~/.avalanchego:/root/.avalanchego`,
        ...Object.entries(env).map(([key, value]) => `-e ${key}=${value}`),
        `avaplatform/subnet-evm:${versions['avaplatform/subnet-evm']}`
    ];
    return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
}

const nipify = (domain: string) => {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(domain)) {
        domain = `${domain}.nip.io`;
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

const enableDebugNTraceCommand = (chainId: string) => `sudo mkdir -p $HOME/.avalanchego/configs/chains/${chainId}; 
sudo chown -R $USER:$USER $HOME/.avalanchego/configs/chains/;

sudo echo '{
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
}' > $HOME/.avalanchego/configs/chains/${chainId}/config.json`

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
    const { avalancheNetworkID } = useWalletStore();

    const [isRPC, setIsRPC] = useState<boolean>(true);
    const [rpcCommand, setRpcCommand] = useState("");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [activeOS, setActiveOS] = useState<OS>("Ubuntu/Debian");
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);

    useEffect(() => {
        try {
            setRpcCommand(generateDockerCommand([subnetId], isRPC, avalancheNetworkID));
        } catch (error) {
            setRpcCommand((error as Error).message);
        }
    }, [subnetId, isRPC, avalancheNetworkID]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);


    useEffect(() => {
        setSubnetIdError(null);
        setSubnetId("");
        if (!chainId) return

        getBlockchainInfo(chainId).then((chainInfo) => {
            setSubnetId(chainInfo.subnetId);
        }).catch((error) => {
            setSubnetIdError((error as Error).message);
        });
    }, [chainId]);

    return (
        <>
            <Container
                title="Docker Installation"
                description="We will retrieve the binary images of AvalancheGo from the Docker Hub."
            >
                <p>Make sure you have Docker installed on your system. You can use the following commands to install it:</p>
                <Tabs
                    tabs={Object.keys(dockerInstallInstructions)}
                    activeTab={activeOS}
                    setActiveTab={setActiveOS}
                    children={(activeTab) => {
                        return <CodeHighlighter lang="bash" code={dockerInstallInstructions[activeTab]} />
                    }}
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
                </p>``
            </Container>
            <Container
                title="Node Setup with Docker"
                description="This will start a Docker container running an RPC or validator node that tracks your L1."
            >
                <p>Enter the options for your node below to generate the Docker command to run the node:</p>
                <InputChainId
                    value={chainId}
                    onChange={setChainId}
                />

                <Input
                    label="Subnet ID"
                    value={subnetId}
                    disabled={true}
                    error={subnetIdError}
                />

                {subnetId && (
                    <>
                        <Checkbox
                            label={`Expose RPC API`}
                            checked={isRPC}
                            onChange={setIsRPC}
                        />
                        <p className="text-sm mb-2">It is ok to expose RPC on a testnet validator. For mainnet nodes, we recommend running separate validator and RPC nodes.</p>

                        {isRPC && <Checkbox
                            label="Enable Debug & Trace"
                            checked={enableDebugTrace}
                            onChange={setEnableDebugTrace}
                        />}

                        {chainId && enableDebugTrace && isRPC && (
                            <div className="mt-4">
                                <h3 className="text-md font-medium mb-2">Debug & Trace Setup Command:</h3>
                                <p className="text-sm mb-2">Run this before starting the node.</p>
                                <CodeHighlighter
                                    code={enableDebugNTraceCommand(chainId)}
                                    lang="bash"
                                />
                            </div>
                        )}

                        <div className="mt-4">
                            <CodeHighlighter
                                code={rpcCommand}
                                lang="bash"
                            />
                        </div>

                        {isRPC && <Input
                            label="Domain or IPv4 address for reverse proxy (optional)"
                            value={domain}
                            onChange={setDomain}
                            placeholder="example.com  or 1.2.3.4"
                            helperText="`curl checkip.amazonaws.com` to get your public IP address. Make sure 443 is open on your firewall."
                        />}

                        {domain && isRPC && (
                            <div className="mt-4">
                                <h3 className="text-md font-medium mb-2">Reverse Proxy Command:</h3>
                                <CodeHighlighter
                                    code={reverseProxyCommand(domain)}
                                    lang="bash"
                                />
                            </div>
                        )}

                        {chainId && (
                            <div className="mt-4">
                                <h3 className="text-md font-medium mb-2">Check Node Command:</h3>
                                <CodeHighlighter
                                    code={checkNodeCommand(chainId, domain || ("127.0.0.1:9650"), false)}
                                    lang="bash"
                                />
                            </div>
                        )}

                        {chainId && isRPC && enableDebugTrace && (
                            <div className="mt-4">
                                <h3 className="text-md font-medium mb-2">Check that debug & trace is working:</h3>
                                <CodeHighlighter
                                    code={checkNodeCommand(chainId, domain || ("127.0.0.1:9650"), true)}
                                    lang="bash"
                                />
                            </div>
                        )}

                        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                            <h3 className="text-md font-medium mb-2">Running Multiple Nodes on the same machine:</h3>
                            <p>To run multiple validator nodes on the same machine, ensure each node has:</p>
                            <ul className="list-disc pl-5 mt-1">
                                <li>Unique container name (change <code>--name</code> parameter)</li>
                                <li>Different ports (modify <code>AVAGO_HTTP_PORT</code> and <code>AVAGO_STAKING_PORT</code>)</li>
                                <li>Separate data directories (change the local volume path <code>~/.avalanchego</code> to a unique directory)</li>
                            </ul>
                            <p className="mt-1">Example for second node: Use ports 9652/9653 (HTTP/staking), container name "avago2", and data directory "~/.avalanchego2"</p>
                        </div>
                    </>)}
            </Container>
        </>
    );
};
