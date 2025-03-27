import { RequireChainFuji } from "../../ui/RequireChain";
import { useWarpMessenger } from '@avalabs/builderkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";

// Warp Messenger precompile address
const WARP_MESSENGER_ADDRESS = "0x0200000000000000000000000000000000000005";

// Create a component that doesn't include the providers
function WarpMessengerComponent() {
    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <AllowListControls precompileAddress={WARP_MESSENGER_ADDRESS} />
            </div>
        </RequireChainFuji>
    );
}

// Create a wrapper component with the providers
export default function WarpMessenger() {
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
                <WarpMessengerComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
