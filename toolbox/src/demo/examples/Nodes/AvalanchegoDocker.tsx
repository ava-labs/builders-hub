"use client";

import { useExampleStore } from "../../utils/store";
import { Input, Select } from "../../ui";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import versions from "../../../versions.json";
import { CodeHighlighter } from "../../ui/CodeHighlighter";
const generateDockerCommand = (subnets: string[], isRPC: boolean, networkID: number) => {
    const httpPort = isRPC ? "8080" : "9650";
    const stakingPort = isRPC ? "9653" : "9651";

    const env: Record<string, string> = {
        AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK: "true",
        AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns",
        AVAGO_HTTP_HOST: "0.0.0.0",
    };

    subnets = subnets.filter(subnet => subnet !== "");
    if (subnets.length !== 0) {
        env.AVAGO_TRACK_SUBNETS = subnets.join(",");
    }

    if (httpPort !== "9650") {
        env.AVAGO_HTTP_PORT = httpPort;
    }

    if (stakingPort !== "9651") {
        env.AVAGO_STAKING_PORT = stakingPort;
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

    const localFolder = isRPC ? "~/.avalanchego_rpc" : "~/.avalanchego";
    const containerName = isRPC ? "rpc" : "avago";
    const chunks = [
        "docker run -it -d",
        `--name ${containerName}`,
        `-p ${isRPC ? "0.0.0.0" : "127.0.0.1"}:${httpPort}:${httpPort} -p ${stakingPort}:${stakingPort}`,
        `-v ${localFolder}:/root/.avalanchego`,
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
  caddy reverse-proxy --from ${domain} --to localhost:8080`
}

const enableDebugNTraceCommand = (chainId: string) => `sudo mkdir -p $HOME/.avalanchego_rpc/configs/chains/${chainId}; 
sudo chown -R $USER:$USER $HOME/.avalanchego_rpc/configs/chains/;

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
}' > $HOME/.avalanchego_rpc/configs/chains/${chainId}/config.json`

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


export default function AvalanchegoDocker() {
    const { subnetID, setSubnetID, networkID, setNetworkID, chainID, setChainID, setEvmChainRpcUrl } = useExampleStore();
    const [isRPC, setIsRPC] = useState<"true" | "false">("false");
    const [rpcCommand, setRpcCommand] = useState("");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<"true" | "false">("false");

    useEffect(() => {
        try {
            setRpcCommand(generateDockerCommand([subnetID], isRPC === "true", networkID));
        } catch (error) {
            setRpcCommand((error as Error).message);
        }
    }, [subnetID, isRPC, networkID]);


    useEffect(() => {
        if (domain && chainID && isRPC === "true") {
            setEvmChainRpcUrl("https://" + nipify(domain) + "/ext/bc/" + chainID + "/rpc");
        }
    }, [domain, chainID, isRPC]);

    useEffect(() => {
        if (isRPC === "false") {
            setDomain("");
        }
    }, [isRPC]);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold ">Avalanchego in Docker</h2>
            <div className="space-y-4">
                <div className="mb-4">
                    This command will start a Docker container running an RPC or validator node that tracks your subnet.
                </div>

                <Input
                    label="Subnet ID"
                    value={subnetID}
                    onChange={setSubnetID}
                    placeholder="Create a subnet to generate a subnet ID"
                />

                <Select
                    label="Select Network"
                    value={networkID}
                    onChange={(value) => setNetworkID(Number(value))}
                    options={[
                        { value: networkIDs.FujiID, label: "Fuji" },
                        { value: networkIDs.MainnetID, label: "Mainnet" },
                    ]}
                />

                <Select
                    label="Node Type"
                    value={isRPC}
                    onChange={(value) => setIsRPC(value as "true" | "false")}
                    options={[
                        { value: "false", label: "Validator Node" },
                        { value: "true", label: "RPC Node" },
                    ]}
                />

                {isRPC === "true" && (
                    <>
                        <Select
                            label="Enable Debug & Trace"
                            value={enableDebugTrace}
                            onChange={(value) => setEnableDebugTrace(value as "true" | "false")}
                            options={[
                                { value: "false", label: "Disabled" },
                                { value: "true", label: "Enabled" },
                            ]}
                        />

                        {enableDebugTrace === "true" && (
                            <Input
                                label="Chain ID"
                                value={chainID}
                                onChange={setChainID}
                                placeholder="Enter Chain ID"
                            />
                        )}
                    </>
                )}

                {isRPC === "true" && (
                    <Input
                        label="Domain or IPv4 address for reverse proxy (optional)"
                        value={domain}
                        onChange={setDomain}
                        placeholder="example.com  or 1.2.3.4"
                        notes="`curl checkip.amazonaws.com` to get your public IP address. Make sure 443 is open on your firewall."
                    />
                )}
                {chainID && enableDebugTrace === "true" && isRPC === "true" && (
                    <div className="mt-4">
                        <h3 className="text-md font-medium mb-2">Debug & Trace Setup Command:</h3>
                        <p className="text-sm mb-2">Note: Run this before starting the node.</p>
                        <CodeHighlighter
                            code={enableDebugNTraceCommand(chainID)}
                            lang="bash"
                        />
                    </div>
                )}

                <div className="mt-4">
                    <h3 className="text-md font-medium mb-2">Node Command:</h3>
                    <CodeHighlighter
                        code={rpcCommand}
                        lang="bash"
                    />
                </div>

                {domain && isRPC === "true" && (
                    <div className="mt-4">
                        <h3 className="text-md font-medium mb-2">Reverse Proxy Command:</h3>
                        <CodeHighlighter
                            code={reverseProxyCommand(domain)}
                            lang="bash"
                        />
                    </div>
                )}

                {chainID && (
                    <div className="mt-4">
                        <h3 className="text-md font-medium mb-2">Check Node Command:</h3>
                        <CodeHighlighter
                            code={checkNodeCommand(chainID, domain || ("127.0.0.1:" + (isRPC === "true" ? "8080" : "9650")), false)}
                            lang="bash"
                        />
                    </div>
                )}

                {chainID && isRPC === "true" && enableDebugTrace === "true" && (
                    <div className="mt-4">
                        <h3 className="text-md font-medium mb-2">Check that debug & trace is working:</h3>
                        <CodeHighlighter
                            code={checkNodeCommand(chainID, domain || ("127.0.0.1:" + (isRPC === "true" ? "8080" : "9650")), true)}
                            lang="bash"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
