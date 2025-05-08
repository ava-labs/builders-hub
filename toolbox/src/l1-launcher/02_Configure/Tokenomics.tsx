import { useL1LauncherStore } from "../L1LauncherStore";
import { RadioGroup } from "../../components/RadioGroup";
import { Input } from "../../components/Input";
import TokenAllocationList from "../../components/genesis/TokenAllocationList";
import { useWalletStore } from "../../lib/walletStore";
import { useEffect } from "react";
import { useState } from "react";
import NextPrev from "../components/NextPrev";
import AllowlistPrecompileConfigurator from "../../components/genesis/AllowlistPrecompileConfigurator";
import { isValidAllowlistPrecompileConfig } from "../../components/genesis/types";

export default function Tokenomics() {
    const { evmTokenSymbol, setEvmTokenSymbol, tokenAllocations, setTokenAllocations, genesisNativeMinterAllowlistConfig, setGenesisNativeMinterAllowlistConfig, evmChainName } = useL1LauncherStore();
    const { walletEVMAddress } = useWalletStore()

    const [initComplete, setInitComplete] = useState(false)
    const [nativeTokenType, setNativeTokenType] = useState("own-token")



    useEffect(() => {
        if (initComplete) return
        setInitComplete(true)

        if (walletEVMAddress && tokenAllocations.length === 0) {
            setTokenAllocations([{ address: walletEVMAddress as `0x${string}`, amount: 1_000_000 }])
        }

        if (!evmTokenSymbol) {
            setEvmTokenSymbol(evmChainName.split(' ').map(word => word[0]).join(''))
        }
    }, [walletEVMAddress, tokenAllocations])

    return (
        <div className="space-y-12">
            <div className='space-y-4'>
                <h1 className="text-2xl font-medium">Tokenomics</h1>
                <p>Tokenomics in Layer 1 blockchains on the Avalanche network are highly flexible, allowing developers to tailor economic models to their specific needs. Each L1 can define its own native token, specifying its initial allocation, distribution mechanism, and whether it should be mintable for ongoing issuance. This enables a wide range of economic designs, from fixed-supply tokens to inflationary models that support network sustainability.</p>
                <p>Alternatively, an L1 can choose to use an existing token, such as USDC or AVAX, for transaction fees. This flexibility allows builders to align economic incentives with their ecosystem goals, whether prioritizing stability, decentralization, or utility-driven adoption.</p>
            </div>

            <div className='space-y-4'>
                <h3 className="font-medium">Native Token</h3>
                <p className="text-gray-600">Choose what kind of token should be used as the native token of the L1 which is used to pay for transaction fees.</p>

                <RadioGroup
                    value={nativeTokenType}
                    onChange={setNativeTokenType}
                    className="space-y-2"
                    items={[
                        { value: "own-token", label: "It's own native token" },
                        { value: "c-chain-usdc", label: "USDC (Coming soon)", isDisabled: true },
                        { value: "c-chain-avax", label: "AVAX (Coming soon)", isDisabled: true },
                        { value: "another-token", label: "Another token (specify blockchain id and token address) (Coming soon)", isDisabled: true }
                    ]}
                />
            </div>

            <div className='space-y-4'>
                <Input type='text' value={evmTokenSymbol} onChange={setEvmTokenSymbol} label="Token Symbol" helperText="The symbol (ticker) of your blockchain's native token (e.g., AAA, TEST). Do not use existing tickers like AVAX, ETH, etc." />
            </div>

            <div className='space-y-4'>
                <h3 className="font-medium">Initial Token Allocation</h3>
                <p className="text-gray-600">Define which addresses should hold how many tokens at the start (genesis) of the blockchain. The <span className="italic">Initial Contract Deployer</span> address is required for deploying the validator manager contracts later.</p>

                <TokenAllocationList
                    allocations={tokenAllocations}
                    onAllocationsChange={setTokenAllocations}
                />
            </div>


            <AllowlistPrecompileConfigurator
                title="Native Minter Allowlist"
                description="This precompile restricts which addresses may mint new native Tokens on this blockchain."
                precompileAction="mint new native tokens"
                config={genesisNativeMinterAllowlistConfig}
                onUpdateConfig={setGenesisNativeMinterAllowlistConfig}
                radioOptionFalseLabel="I want to have a fixed supply of tokens on my blockchain."
                radioOptionTrueLabel="I want to be able to mint additional tokens (recommended for production)."
            />

            <NextPrev nextEnabled={Boolean(evmTokenSymbol) && Boolean(tokenAllocations.length > 0) && isValidAllowlistPrecompileConfig(genesisNativeMinterAllowlistConfig)} />
        </div>
    );
}
