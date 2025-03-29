import { RequireChainFuji } from "../../ui/RequireChain";
import { useFeeManager } from '@avalabs/builderkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../../components/AllowListComponents";
import { Container } from "../../../components/container";
import { Button } from "../../../components/button";
import { Input } from "../../../components/input";
import { useState } from "react";

// Fee Manager precompile address
const FEE_MANAGER_ADDRESS = "0x0200000000000000000000000000000000000007";

// Create a component that doesn't include the providers
function FeeManagerComponent() {
    const { setFeeConfig, getFeeConfig, getFeeConfigLastChangedAt } = useFeeManager();
    const [isSettingConfig, setIsSettingConfig] = useState(false);
    const [isReadingConfig, setIsReadingConfig] = useState(false);
    const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);
    const [currentConfig, setCurrentConfig] = useState<any>(null);

    // State for fee config parameters
    const [gasLimit, setGasLimit] = useState("20000000");
    const [targetBlockRate, setTargetBlockRate] = useState("2");
    const [minBaseFee, setMinBaseFee] = useState("1000000000");
    const [targetGas, setTargetGas] = useState("100000000");
    const [baseFeeChangeDenominator, setBaseFeeChangeDenominator] = useState("48");
    const [minBlockGasCost, setMinBlockGasCost] = useState("0");
    const [maxBlockGasCost, setMaxBlockGasCost] = useState("10000000");
    const [blockGasCostStep, setBlockGasCostStep] = useState("500000");

    const handleSetFeeConfig = async () => {
        setIsSettingConfig(true);
        try {
            await setFeeConfig(
                gasLimit,
                targetBlockRate,
                minBaseFee,
                targetGas,
                baseFeeChangeDenominator,
                minBlockGasCost,
                maxBlockGasCost,
                blockGasCostStep
            );
        } catch (error) {
            console.error('Setting fee config failed:', error);
        } finally {
            setIsSettingConfig(false);
        }
    };

    const handleGetFeeConfig = async () => {
        setIsReadingConfig(true);
        try {
            const config = await getFeeConfig(43113);
            setCurrentConfig(config);
        } catch (error) {
            console.error('Reading fee config failed:', error);
        } finally {
            setIsReadingConfig(false);
        }
    };

    const handleGetLastChangedAt = async () => {
        try {
            const timestamp = await getFeeConfigLastChangedAt(43113);
            setLastChangedAt(timestamp);
        } catch (error) {
            console.error('Getting last changed timestamp failed:', error);
        }
    };

    return (
        <RequireChainFuji>
            <div className="space-y-6">
                <Container
                    title="Fee Configuration"
                    description="Configure the dynamic fee parameters for the chain."
                >
                    <div className="space-y-4">
                        <Input
                            label="Gas Limit"
                            value={gasLimit}
                            onChange={setGasLimit}
                            type="number"
                        />
                        <Input
                            label="Target Block Rate"
                            value={targetBlockRate}
                            onChange={setTargetBlockRate}
                            type="number"
                        />
                        <Input
                            label="Minimum Base Fee"
                            value={minBaseFee}
                            onChange={setMinBaseFee}
                            type="number"
                        />
                        <Input
                            label="Target Gas"
                            value={targetGas}
                            onChange={setTargetGas}
                            type="number"
                        />
                        <Input
                            label="Base Fee Change Denominator"
                            value={baseFeeChangeDenominator}
                            onChange={setBaseFeeChangeDenominator}
                            type="number"
                        />
                        <Input
                            label="Minimum Block Gas Cost"
                            value={minBlockGasCost}
                            onChange={setMinBlockGasCost}
                            type="number"
                        />
                        <Input
                            label="Maximum Block Gas Cost"
                            value={maxBlockGasCost}
                            onChange={setMaxBlockGasCost}
                            type="number"
                        />
                        <Input
                            label="Block Gas Cost Step"
                            value={blockGasCostStep}
                            onChange={setBlockGasCostStep}
                            type="number"
                        />
                        <Button
                            onClick={handleSetFeeConfig}
                            loading={isSettingConfig}
                            variant="primary"
                        >
                            Set Fee Configuration
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Current Fee Configuration"
                    description="View the current fee configuration and last change timestamp."
                >
                    <div className="space-y-4">
                        <Button
                            onClick={handleGetFeeConfig}
                            loading={isReadingConfig}
                            variant="secondary"
                        >
                            Get Current Config
                        </Button>
                        <Button
                            onClick={handleGetLastChangedAt}
                            variant="secondary"
                        >
                            Get Last Changed At
                        </Button>
                        {currentConfig && (
                            <div className="mt-4 p-4 bg-gray-100 rounded">
                                <pre>{JSON.stringify(currentConfig, null, 2)}</pre>
                            </div>
                        )}
                        {lastChangedAt !== null && (
                            <div className="mt-4">
                                <p>Last changed at block: {lastChangedAt}</p>
                            </div>
                        )}
                    </div>
                </Container>

                <Container
                    title="AllowList Controls"
                    description="Manage access control for the Fee Manager precompile."
                >
                    <AllowListControls precompileAddress={FEE_MANAGER_ADDRESS} />
                </Container>
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
