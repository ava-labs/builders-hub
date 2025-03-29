import { useState } from 'react';
import { useL1LauncherWizardStore } from '../config/store';
import NextPrev from "@/components/tools/common/ui/NextPrev";
import Note from '@/components/tools/common/ui/Note';
import Pre from '@/components/tools/common/ui/Pre';
import { CONTAINER_VERSION } from '../constants';
import OSSelectionTabs from '../../common/ui/OSSelectionTabs';

const dockerCommand = (subnetID: string) => `docker run -it -d \\
  --name rpc \\
  -p 0.0.0.0:8080:8080 -p 9653:9653 \\
  -v ~/.avalanchego_rpc:/root/.avalanchego \\
  -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \\
  -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \\
  -e AVAGO_HTTP_HOST=0.0.0.0 \\
  -e AVAGO_TRACK_SUBNETS=${subnetID} \\
  -e AVAGO_HTTP_PORT=8080 \\
  -e AVAGO_STAKING_PORT=9653 \\
  -e AVAGO_NETWORK_ID=fuji \\
  -e AVAGO_HTTP_ALLOWED_HOSTS="*" \\
  avaplatform/subnet-evm:${CONTAINER_VERSION}`;


export default function LaunchRpcNode() {
    const { subnetId, chainId, evmChainId, goToNextStep, goToPreviousStep } = useL1LauncherWizardStore();
    const [isRpcLaunched, setIsRpcLaunched] = useState(false);
    const [activeOS, setActiveOS] = useState("Linux");

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-2xl font-medium mb-4">Launch L1 RPC Node</h1>
                <p>In this step we will launch the RPC nodes using Docker. </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/50 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6">
                <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-100">About RPC Nodes</h3>
                <p className="mb-2 text-gray-800 dark:text-gray-200">
                    RPC (Remote Procedure Call) nodes allow users to access your blockchain data and send transactions. You have two main options:
                </p>
                <ul className="list-disc ml-6 mb-2 text-gray-800 dark:text-gray-200">
                    <li className="mb-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Local access:</span> Running on localhost:8080 without SSL. Simple for quick testing, but only you can access the chain.
                    </li>
                    <li className="mb-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Public access:</span> Running on a domain with SSL certificates. Required for most wallets to connect.
                    </li>
                </ul>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                    Important: Don't use your validator node as an RPC node. Your RPC node from the previous step exposes port 8080 for API access.
                </p>
            </div>

            <EnableDebug />

            <div>
                <h3 className="mb-4 font-medium">Run this command on your RPC node:</h3>
                <p className="mb-4">
                    This command launches an AvalancheGo node configured as an RPC node. It changes the RPC port to <code>8080</code> and the P2P port to <code>9653</code> to avoid conflicts with your validator node. You can run this on the same machine as one of your validator nodes or even on your local computer for easier access from a wallet.
                </p>

                <Pre>{dockerCommand(subnetId)}</Pre>
            </div>

            <div>
                <h3 className="mb-4 font-medium">View RPC node logs:</h3>
                <p className="mb-4">
                    You can follow the logs of your RPC node to see if it's running correctly.
                </p>
                <Pre>docker logs -f rpc</Pre>
            </div>

            <div>
                <h3 className="mb-4 font-medium">Verify the RPC node is running:</h3>
                <Pre>
                    {`curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"eth_chainId", "params":[], "id":1 
}' -H 'content-type:application/json;' \\
http://127.0.0.1:8080/ext/bc/${chainId}/rpc`}
                </Pre>

                <Note>
                    Replace <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">127.0.0.1</code> with your RPC node's IP address if you're checking from a different machine.
                </Note>

                <p className="mb-4">
                    You should receive a response similar to:
                </p>

                <Pre>
                    {`{"jsonrpc":"2.0","id":1,"result":"0x${evmChainId.toString(16)}"}`}
                </Pre>

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
                <p className="text-sm text-gray-500 pl-6">Click this to continue</p>
            </div>


            <NextPrev nextDisabled={!isRpcLaunched} onNext={goToNextStep} onPrev={goToPreviousStep} />
        </div>
    );
}

function EnableDebug() {
    const { chainId } = useL1LauncherWizardStore();

    return <>

        <details className="mb-6 p-4 border rounded-lg">
            <summary className="font-medium cursor-pointer">Optional: Enable EVM debug & trace</summary>
            <div className="mt-4">
                <p className="mb-4">
                    Debug & trace methods allow you to inspect transaction execution, debug smart contracts, and trace calls.
                    This includes features like <code>debug_traceTransaction</code>, <code>debug_traceCall</code>, and more for detailed EVM-level debugging.
                </p>

                <h4 className="font-medium mb-2">To enable these features, run this before launching your RPC node:</h4>
                <Pre>
                    {`sudo mkdir -p $HOME/.avalanchego_rpc/configs/chains/${chainId}
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
}' > $HOME/.avalanchego_rpc/configs/chains/${chainId}/config.json`}
                </Pre>
                <Note>
                    After adding this configuration, restart your RPC node for the changes to take effect.
                </Note>

                <h4 className="font-medium mt-4 mb-2">Test debug functionality:</h4>
                <Pre>
                    {`curl -X POST --data '{
  "jsonrpc":"2.0",
  "method":"debug_traceBlockByNumber",
  "params":["latest", {}],
  "id":1
}' -H 'content-type:application/json;' \\
http://127.0.0.1:8080/ext/bc/${chainId}/rpc`}
                </Pre>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    If debug is properly enabled, this will return detailed trace information for the latest block. If you get an error about the method not being available, check that you've properly configured and restarted your node.
                </p>
            </div>
        </details>
    </>
}
