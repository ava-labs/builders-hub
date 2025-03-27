import { RequireChainFuji } from "../../ui/RequireChain";
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";
import { Container } from "../../../components/container";

// Deployer AllowList precompile address
const DEPLOYER_ALLOWLIST_ADDRESS = "0x0200000000000000000000000000000000000000";

// Create a component that doesn't include the providers
function DeployerAllowListComponent() {
    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <Container
                    title="Deployer AllowList Controls"
                    description="Manage which addresses are allowed to deploy contracts on this chain."
                >
                    <AllowListControls precompileAddress={DEPLOYER_ALLOWLIST_ADDRESS} />
                </Container>
            </div>
        </RequireChainFuji>
    );
}

// Create a wrapper component with the providers
export default function DeployerAllowList() {
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
                <DeployerAllowListComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
