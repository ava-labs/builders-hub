import { useWalletStore } from "../../utils/store";
import { useNativeMinter } from '@avalabs/builderkit';
import { RequireChainFuji } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
import { Input } from "../../../components/input";
import { Button } from "../../../components/button";
import { useState } from "react";
import { EVMAddressInput } from "../../components/EVMAddressInput";
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";

// Native Minter precompile address
const NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

// Create a NativeMinterComponent that doesn't include the providers
function NativeMinterComponent() {
    const { walletEVMAddress } = useWalletStore();
    const [amount, setAmount] = useState<number>(100);
    const [isMinting, setIsMinting] = useState(false);
    const [nativeMinterRecipient, setNativeMinterRecipient] = useState<string>(walletEVMAddress);

    const { mintNativeCoin } = useNativeMinter();

    const convertToHex = (amount: number): `0x${string}` => {
        const amountInWei = BigInt(amount) * BigInt(10 ** 18);
        return `0x${amountInWei.toString(16)}` as `0x${string}`;
    };

    const handleMint = async () => {
        if (!nativeMinterRecipient) return;
        setIsMinting(true);
        try {
            const amountInHex = convertToHex(amount);
            await mintNativeCoin(nativeMinterRecipient, amountInHex);
        } catch (error) {
            console.error('Minting failed:', error);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <Container
                    title="Mint Native Tokens"
                    description="This will mint native tokens to the EVM address."
                >
                    <div className="space-y-4">
                        <EVMAddressInput
                            label="Recipient Address"
                            value={nativeMinterRecipient}
                            onChange={setNativeMinterRecipient}
                        />
                        <Input
                            label="Amount"
                            value={amount}
                            onChange={(value) => setAmount(Number(value))}
                            type="number"
                        />
                        <Button
                            onClick={handleMint}
                            loading={isMinting}
                            variant="primary"
                        >
                            Mint
                        </Button>
                    </div>
                </Container>

                {/* Use AllowListControls component with the Native Minter precompile address */}
                <AllowListControls precompileAddress={NATIVE_MINTER_ADDRESS} />
            </div>
        </RequireChainFuji>
    );
}

// Create a wrapper component with the providers
export default function NativeMinter() {
    // Create Wagmi config
    const config = createConfig({
        chains: [avalancheFuji],
        transports: {
            [avalancheFuji.id]: http(),
        },
    });

    // Create query client
    const queryClient = new QueryClient();

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <NativeMinterComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
