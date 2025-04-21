import { useL1LauncherStore } from '../L1LauncherStore';
import NextPrev from "../components/NextPrev";
import { useState } from 'react';
import { Note } from '../../components/Note';
import { CodeHighlighter } from '../../components/CodeHighlighter';
import versions from '../../versions.json';

const dockerCommand = (subnetId: string) => `docker run -it -d \\
  --name avago \\
  -p 127.0.0.1:9650:9650 -p 9651:9651 \\
  -v ~/.avalanchego:/root/.avalanchego \\
  -e AVAGO_NETWORK_ID=fuji \\
  -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \\
  -e AVAGO_TRACK_SUBNETS=${subnetId} \\
  -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \\
  -e AVAGO_HTTP_HOST=0.0.0.0 \\
  avaplatform/subnet-evm:${versions["avaplatform/subnet-evm"]}`


export default function LaunchValidators() {
  const { subnetId, chainId, evmChainId, nodesCount } = useL1LauncherStore();
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium mb-4">Launch L1 Validators</h1>
        <p>In this step we will launch the actual validator nodes using Docker.</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">
          {nodesCount > 1 ? 'Launch this on each of your ' + nodesCount + ' validator nodes' + ':' : 'Launch this on your validator node:'}
        </h3>

        <CodeHighlighter lang="bash" code={dockerCommand(subnetId)} />

        <Note>
          <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">{subnetId}</code> is the subnet ID
        </Note>

        <p>
          It will take approximately 3 to 10 minutes to bootstrap as it needs to sync the P-Chain, which is quick. Note that these nodes are not archival; you should read how to set up archival nodes if needed.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">
          You can check the node logs by running:
        </h3>
        <CodeHighlighter lang="bash" code="docker logs -f avago" />
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">
          To test if the node bootstrapped successfully, run:
        </h3>
        <CodeHighlighter lang="bash" code={`curl -X POST --data '{ 
"jsonrpc":"2.0", "method":"eth_chainId", "params":[], "id":1 
}' -H 'content-type:application/json;' \\
127.0.0.1:9650/ext/bc/${chainId}/rpc`} />

        <Note>
          <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">{chainId}</code> is the chain ID
        </Note>

        <p>
          At first, it will return <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">404 page not found</code> as the node is not bootstrapped yet.
        </p>

        <p>
          If your node has bootstrapped successfully, you should see this response:
        </p>

        <CodeHighlighter lang="json" code={`{"jsonrpc":"2.0","id":1,"result":"0x${evmChainId.toString(16)}"}`} />

        <Note>
          <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">0x{evmChainId.toString(16)}</code> is the hex representation of the chain ID {evmChainId}
        </Note>
      </div>

      <p>
        Once the validator
        {nodesCount > 1 ? 's' : ''} are bootstrapped, you will launch the RPC
        node{nodesCount > 1 ? 's' : ''} in the next step.
      </p>

      <div className="mt-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="bootstrapConfirm"
            checked={isBootstrapped}
            onChange={(e) => setIsBootstrapped(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="bootstrapConfirm" className="ml-2">
            I confirm my node{nodesCount > 1 ? 's are' : ' is'} bootstrapped and returning the expected chain ID
          </label>
        </div>
        <p className="text-sm text-gray-500 pl-6 mt-1">Click this to continue</p>
      </div>

      <NextPrev nextEnabled={isBootstrapped} />
    </div>
  );
}
