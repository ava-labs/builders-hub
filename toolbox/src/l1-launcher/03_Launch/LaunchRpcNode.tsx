import { useState } from 'react';
import { useL1LauncherStore } from '../L1LauncherStore';
import NextPrev from "../components/NextPrev";
import { Note } from '../../components/Note';
import { CodeHighlighter } from '../../components/CodeHighlighter';
import versions from '../../versions.json';

const dockerCommand = (subnetId: string) => `docker run -it -d \\
  --name rpc \\
  -p 0.0.0.0:8080:8080 -p 9653:9653 \\
  -v ~/.avalanchego_rpc:/root/.avalanchego \\
  -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \\
  -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \\
  -e AVAGO_HTTP_HOST=0.0.0.0 \\
  -e AVAGO_TRACK_SUBNETS=${subnetId} \\
  -e AVAGO_HTTP_PORT=8080 \\
  -e AVAGO_STAKING_PORT=9653 \\
  -e AVAGO_NETWORK_ID=fuji \\
  -e AVAGO_HTTP_ALLOWED_HOSTS="*" \\
  avaplatform/subnet-evm:${versions["avaplatform/subnet-evm"]}`;


export default function LaunchRpcNode() {
    const { subnetId, chainId, evmChainId } = useL1LauncherStore();
    const [isRpcLaunched, setIsRpcLaunched] = useState(false);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-medium mb-4">Launch L1 RPC Node</h1>
                <p>In this step we will launch the RPC nodes using Docker.</p>
            </div>

            <Note>
                <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-100">About RPC Nodes</h3>
                <p className="mb-2">
                    RPC (Remote Procedure Call) nodes allow users to access your blockchain data and send transactions. You have two main options:
                </p>
                <ul className="list-disc ml-6 mb-2">
                    <li className="mb-1">
                        <span className="font-medium">Local access:</span> Running on localhost:8080 without SSL. Simple for quick testing, but only you can access the chain.
                    </li>
                    <li className="mb-1">
                        <span className="font-medium">Public access:</span> Running on a domain with SSL certificates. Required for most wallets to connect.
                    </li>
                </ul>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                    Important: Don't use your validator node as an RPC node. Your RPC node exposes port 8080 for API access.
                </p>
            </Note>


            <div className="space-y-4">
                <h3 className="font-medium">Run this command on your RPC node:</h3>
                <p>
                    This command launches an AvalancheGo node configured as an RPC node. It changes the RPC port to <code>8080</code> and the P2P port to <code>9653</code> to avoid conflicts with your validator node. You can run this on the same machine as one of your validator nodes or even on your local computer for easier access from a wallet.
                </p>
                <CodeHighlighter lang="bash" code={dockerCommand(subnetId)} />
            </div>

            <div className="space-y-4">
                <h3 className="font-medium">View RPC node logs:</h3>
                <p>
                    You can follow the logs of your RPC node to see if it's running correctly.
                </p>
                <CodeHighlighter lang="bash" code="docker logs -f rpc" />
            </div>

            <div className="space-y-4">
                <h3 className="font-medium">Verify the RPC node is running:</h3>
                <CodeHighlighter lang="bash" code={
                    `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"eth_chainId", "params":[], "id":1 
}' -H 'content-type:application/json;' \\
http://127.0.0.1:8080/ext/bc/${chainId}/rpc`
                } />

                <Note>
                    Replace <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">127.0.0.1</code> with your RPC node's IP address if you're checking from a different machine.
                </Note>

                <p>
                    You should receive this response:
                </p>

                <CodeHighlighter lang="json" code={
                    `{"jsonrpc":"2.0","id":1,"result":"0x${evmChainId.toString(16)}"}`
                } />

                <Note>
                    <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">0x{evmChainId.toString(16)}</code> is the hex representation of your EVM chain ID <code>{evmChainId}</code>. Also check that port 8080 is open on your RPC node.
                </Note>
            </div>

            <div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="rpcLaunchedConfirm"
                        checked={isRpcLaunched}
                        onChange={(e) => setIsRpcLaunched(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="rpcLaunchedConfirm" className="ml-2">
                        I confirm the RPC node is running and returning the expected chain ID
                    </label>
                </div>
                <p className="text-sm text-gray-500 pl-6 mt-1">Click this to continue</p>
            </div>

            <EnableDebug />

            <NextPrev nextEnabled={isRpcLaunched} />
        </div>
    );
}
function EnableDebug() {
    const { chainId } = useL1LauncherStore();

    return <>
        <details className="p-4 border dark:border-gray-700 rounded-lg">
            <summary className="font-medium cursor-pointer">Optional: Enable EVM debug & trace</summary>
            <div className="mt-4 space-y-4">
                <p>
                    Debug & trace methods allow you to inspect transaction execution, debug smart contracts, and trace calls.
                    This includes features like <code>debug_traceTransaction</code>, <code>debug_traceCall</code>, and more for detailed EVM-level debugging.
                </p>

                <div>
                    <h4 className="font-medium mb-2">To enable these features, run this before launching your RPC node:</h4>
                    <CodeHighlighter lang="bash" code={
                        `sudo mkdir -p $HOME/.avalanchego_rpc/configs/chains/${chainId}
sudo chown -R $USER:$GROUP $HOME/.avalanchego_rpc/configs/chains/${chainId}
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
                    } />



                </div>

                <div>
                    <h4 className="font-medium mb-2">Restart the RPC node:</h4>
                    <CodeHighlighter lang="bash" code="docker restart rpc" />
                </div>

                <div>
                    <h4 className="font-medium mb-2">Test debug functionality:</h4>
                    <CodeHighlighter lang="bash" code={
                        `curl -X POST --data '{
  "jsonrpc":"2.0",
  "method":"debug_traceBlockByNumber",
  "params":["latest", {}],
  "id":1
}' -H 'content-type:application/json;' \\
http://127.0.0.1:8080/ext/bc/${chainId}/rpc`
                    } />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        If debug is properly enabled, this will return detailed trace information for the latest block. If you get an error about the method not being available, check that you've properly configured and restarted your node.
                    </p>
                </div>
            </div>
        </details>
    </>
}
