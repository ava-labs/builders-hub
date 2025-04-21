import { useState } from 'react';
import { useL1LauncherStore } from '../L1LauncherStore';
import NextPrev from "../components/NextPrev";
import { RadioGroup } from "../../components/RadioGroup";
import { Input } from '../../components/Input';


function isValidEvmChainName(name: string): boolean {
    if (name.length < 1) return false;
    if (name.length > 100) return false; // Made up number
    return name.split('').every(char => {
        const code = char.charCodeAt(0);
        return code <= 127 && // MaxASCII check
            (char.match(/[a-zA-Z0-9 ]/) !== null); // only letters, numbers, spaces
    });
}

export default function ChainParameters() {
    const { evmChainName, setEvmChainName, evmChainId, setEvmChainId } = useL1LauncherStore();
    const [network, setNetwork] = useState("fuji-testnet");


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-medium mb-4">Chain Parameters</h1>
                <p>Enter the basic parameters of your L1, such as it's name, it's EVM chain ID, and the network you want to deploy it on.</p>
            </div>

            <Input value={evmChainName} onChange={setEvmChainName} label="L1 Name" error={(evmChainName === "" || isValidEvmChainName(evmChainName)) ? "" : "Invalid L1 name. Only letters, numbers, and spaces are allowed."} />

            <div className='space-y-4'>
                <h3 className="font-medium">EVM Chain ID</h3>
                <Input type='number' value={evmChainId} onChange={v => setEvmChainId(parseInt(v))} min={0} step={1} label="EVM Chain ID" helperText={<span>Unique identifier for your blockchain network. Check if it's unique <a href={`https://chainlist.org/?search=${evmChainId}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-600">on chainlist.org</a>.</span>} />
            </div>

            <div>
                <div>
                    <h3 className="mb-4 font-medium">Network</h3>
                    <p className="mb-4 text-gray-600">Do you want to deploy your L1 on testnet or mainnet?</p>
                </div>

                <RadioGroup
                    value={network}
                    onChange={setNetwork}
                    className="space-y-2"
                    items={[
                        { value: "fuji-testnet", label: "Fuji Testnet" },
                        { value: "mainnet", label: "Mainnet (coming soon)", isDisabled: true }
                    ]}
                />
            </div>

            <NextPrev nextEnabled={isValidEvmChainName(evmChainName) && evmChainId > 0} />
        </div>
    );
}
