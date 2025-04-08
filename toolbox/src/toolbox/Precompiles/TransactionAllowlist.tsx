import { RequireChain } from "../../components/RequireChain";
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../components/AllowListComponents";
import { Container } from "../components/Container";

// Transaction AllowList precompile address
const TRANSACTION_ALLOWLIST_ADDRESS = "0x0200000000000000000000000000000000000002";

// Create a component that doesn't include the providers
function TransactionAllowListComponent() {
    return (
        <RequireChain chain={avalancheFuji}>
            <div className="space-y-6">
                <Container
                    title="Transaction AllowList Controls"
                    description="Manage which addresses are allowed to send transactions on this chain."
                >
                    <AllowListControls precompileAddress={TRANSACTION_ALLOWLIST_ADDRESS} />
                </Container>
            </div>
        </RequireChain>
    );
}

// Create a wrapper component with the providers
export default function TransactionAllowList() {
    // Create Wagmi config with type assertion to handle version mismatch
    const config = createConfig({
        chains: [avalancheFuji],
        transports: {
            [avalancheFuji.id]: http() as any,
        },
    } as any);

    // Create query client
    const queryClient = new QueryClient();

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <TransactionAllowListComponent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
