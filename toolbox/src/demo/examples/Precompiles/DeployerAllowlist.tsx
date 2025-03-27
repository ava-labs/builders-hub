import { RequireChainFuji } from "../../ui/RequireChain";
import { useDeployerAllowList } from '@avalabs/builderkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";

// Deployer Allowlist precompile address
const DEPLOYER_ALLOWLIST_ADDRESS = "0x0200000000000000000000000000000000000002";

// Create a component that doesn't include the providers
function DeployerAllowlistComponent() {
    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <AllowListControls precompileAddress={DEPLOYER_ALLOWLIST_ADDRESS} />
            </div>
        </RequireChainFuji>
    );
}

// Create a wrapper component with the providers
export default function DeployerAllowlist() {
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
                <DeployerAllowlistComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
