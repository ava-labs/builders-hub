import { useEffect } from 'react';
import { useL1LauncherStore } from '../L1LauncherStore';
import NextPrev from "../components/NextPrev";
import { generateGenesis } from '../../components/genesis/genGenesis';
import { CodeHighlighter } from '../../components/CodeHighlighter';

export default function Genesis() {
    const { evmChainId, tokenAllocations, genesisTxAllowlistConfig, genesisContractDeployerAllowlistConfig, genesisNativeMinterAllowlistConfig, poaOwnerAddress, setGenesisString, genesisString } = useL1LauncherStore();

    const handleGenerateGenesis = () => {
        const genesis = generateGenesis({
            evmChainId,
            tokenAllocations,
            txAllowlistConfig: genesisTxAllowlistConfig,
            contractDeployerAllowlistConfig: genesisContractDeployerAllowlistConfig,
            nativeMinterAllowlistConfig: genesisNativeMinterAllowlistConfig,
            poaOwnerAddress
        });
        setGenesisString(JSON.stringify(genesis, null, 2));
    }

    useEffect(() => {
        handleGenerateGenesis();
    }, [evmChainId, tokenAllocations, genesisTxAllowlistConfig, genesisContractDeployerAllowlistConfig, genesisNativeMinterAllowlistConfig, poaOwnerAddress]);

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-2xl font-medium mb-4">Genesis Generation</h1>
                <p>Your EVM genesis has been automatically generated based on your previous configurations. Please review it carefully before proceeding.</p>
            </div>

            {genesisString && <div >
                <div>
                    Genesis JSON:
                </div>
                <CodeHighlighter code={genesisString} lang="json" />

                <h3 className="mb-4 text-xl font-medium">Test Your Genesis Configuration (optional)</h3>
                <div className="steps space-y-6">
                    <div className="step">Open a Codespace from the main branch in <a className="underline text-blue-500" target="_blank" href="https://github.com/ava-labs/avalanche-starter-kit">Avalanche Starter Kit</a> repository.</div>
                    <div className="step">Create <code className="px-1 py-1 bg-gray-50 dark:bg-gray-900 rounded">genesis.json</code> in the GitHub codespace, paste L1 launcher genesis code, and copy the file's full path.</div>
                    <div className="step">Run <code className="px-1 py-1 bg-gray-50 dark:bg-gray-900 rounded">avalanche blockchain create &lt;blockchain_name&gt; --genesis &lt;file_path&gt; --sovereign=false</code> and enter the requested details (Token Symbol, etc.).</div>
                    <div className="step">Wait for blockchain configuration generation based on your inputs and genesis file parameters.</div>
                    <div className="step">Verify setup by running <code className="px-1 py-1 bg-gray-50 dark:bg-gray-900 rounded">avalanche blockchain describe &lt;blockchain_name&gt;</code> and check the configuration.</div>
                    <div className="step">(Optional) You can also deploy the blockchain by running <code className="px-1 py-1 bg-gray-50 dark:bg-gray-900 rounded">avalanche blockchain deploy &lt;blockchain_name&gt;</code>.</div>
                </div>
            </div>}

            <NextPrev nextEnabled={!!genesisString} />
        </div>
    );
}
