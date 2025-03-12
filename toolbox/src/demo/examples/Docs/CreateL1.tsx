"use client";

export default function CreateL1() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Steps to create an L1</h2>
                <p className="text-sm mt-2">
                    This is a temporary guide that will be moved to Builder Hub. You will need a VM with a static IPv4 address
                    with ports 443, 9651, and 9653 open.
                </p>
            </div>

            <div className="space-y-4">
                <div className="prose dark:prose-invert max-w-none">
                    <ol className="list-decimal pl-8">
                        <li>
                            <a className="text-blue-500 hover:underline" href="#getPChainAddress">Connect your wallet and get your P-chain address</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#createSubnet">Create a new subnet on the P-chain</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#genesisBuilder">Generate genesis data</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#createChain">Create a new chain within your subnet using the genesis data</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#avalanchegoDocker">Launch validator node with default settings</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#convertToL1">Convert your subnet to an L1 chain</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#collectConversionSignatures">Collect conversion signatures from validators</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#avalanchegoDocker">Launch RPC node (set Node Type to RPC, enable Debug&Trace, enter your IP)</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#switchChain">Connect to your new L1 chain using the RPC URL</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#deployValidatorMessages">Deploy the validator messages library contract</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#deployValidatorManager">Deploy the validator manager contract</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#upgradeProxy">Point the proxy to the validator manager</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#initialize">Initialize the validator manager contract</a>
                        </li>
                        <li>
                            <a className="text-blue-500 hover:underline" href="#initValidatorSet">Initialize the validator set</a>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
