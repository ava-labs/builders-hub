import { RequireChainFuji } from "../../ui/RequireChain";
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";

// Fee Manager precompile address
const FEE_MANAGER_ADDRESS = "0x0200000000000000000000000000000000000007";

// Create a component that doesn't include the providers
function FeeManagerComponent() {
    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <AllowListControls precompileAddress={FEE_MANAGER_ADDRESS} />
            </div>
        </RequireChainFuji>
    );
}

// Create a wrapper component with the providers
export default function FeeManager() {
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
                <FeeManagerComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
