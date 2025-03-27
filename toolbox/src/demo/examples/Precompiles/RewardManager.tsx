import { RequireChainFuji } from "../../ui/RequireChain";
import { useRewardManager } from '@avalabs/builderkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";

// Reward Manager precompile address
const REWARD_MANAGER_ADDRESS = "0x0200000000000000000000000000000000000008";

// Create a component that doesn't include the providers
function RewardManagerComponent() {
    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <AllowListControls precompileAddress={REWARD_MANAGER_ADDRESS} />
            </div>
        </RequireChainFuji>
    );
}

// Create a wrapper component with the providers
export default function RewardManager() {
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
                <RewardManagerComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
