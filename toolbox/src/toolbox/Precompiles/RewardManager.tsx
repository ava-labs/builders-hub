import { RequireChain } from "../../components/RequireChain";
import { useRewardManager } from '@avalabs/builderkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { avalancheFuji } from 'viem/chains';
import { http } from 'viem';
import { AllowListControls } from "../components/AllowListComponents";
import { Container } from "../components/Container";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useState } from "react";

// Reward Manager precompile address
const REWARD_MANAGER_ADDRESS = "0x0200000000000000000000000000000000000008";

// Create a component that doesn't include the providers
function RewardManagerComponent() {
    const { 
        setRewardAddress, 
        allowFeeRecipients, 
        disableRewards,
        currentRewardAddress,
        areFeeRecipientsAllowed 
    } = useRewardManager();

    const [isSettingRewardAddress, setIsSettingRewardAddress] = useState(false);
    const [isAllowingFeeRecipients, setIsAllowingFeeRecipients] = useState(false);
    const [isDisablingRewards, setIsDisablingRewards] = useState(false);
    const [rewardAddress, setRewardAddressInput] = useState("");
    const [currentRewardAddr, setCurrentRewardAddr] = useState<string | null>(null);
    const [areRecipientsAllowed, setAreRecipientsAllowed] = useState<boolean | null>(null);

    const handleSetRewardAddress = async () => {
        if (!rewardAddress) return;
        setIsSettingRewardAddress(true);
        try {
            await setRewardAddress(rewardAddress);
        } catch (error) {
            console.error('Setting reward address failed:', error);
        } finally {
            setIsSettingRewardAddress(false);
        }
    };

    const handleAllowFeeRecipients = async () => {
        setIsAllowingFeeRecipients(true);
        try {
            await allowFeeRecipients();
        } catch (error) {
            console.error('Allowing fee recipients failed:', error);
        } finally {
            setIsAllowingFeeRecipients(false);
        }
    };

    const handleDisableRewards = async () => {
        setIsDisablingRewards(true);
        try {
            await disableRewards();
        } catch (error) {
            console.error('Disabling rewards failed:', error);
        } finally {
            setIsDisablingRewards(false);
        }
    };

    const handleGetCurrentRewardAddress = async () => {
        try {
            const address = await currentRewardAddress(43113);
            setCurrentRewardAddr(address);
        } catch (error) {
            console.error('Getting current reward address failed:', error);
        }
    };

    const handleCheckFeeRecipientsAllowed = async () => {
        try {
            const allowed = await areFeeRecipientsAllowed(43113);
            setAreRecipientsAllowed(allowed);
        } catch (error) {
            console.error('Checking fee recipients allowed failed:', error);
        }
    };

    return (
        <RequireChain>
            <div className="space-y-6">
                <Container
                    title="Reward Address Configuration"
                    description="Set the address that will receive transaction fees."
                >
                    <div className="space-y-4">
                        <Input
                            label="Reward Address"
                            value={rewardAddress}
                            onChange={setRewardAddressInput}
                            placeholder="0x..."
                        />
                        <Button
                            onClick={handleSetRewardAddress}
                            loading={isSettingRewardAddress}
                            variant="primary"
                        >
                            Set Reward Address
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Fee Recipients Management"
                    description="Enable or disable fee recipients and rewards."
                >
                    <div className="space-y-4">
                        <Button
                            onClick={handleAllowFeeRecipients}
                            loading={isAllowingFeeRecipients}
                            variant="primary"
                        >
                            Allow Fee Recipients
                        </Button>
                        <Button
                            onClick={handleDisableRewards}
                            loading={isDisablingRewards}
                            variant="secondary"
                        >
                            Disable Rewards
                        </Button>
                    </div>
                </Container>

                <Container
                    title="Current Status"
                    description="View the current reward configuration status."
                >
                    <div className="space-y-4">
                        <Button
                            onClick={handleGetCurrentRewardAddress}
                            variant="secondary"
                        >
                            Get Current Reward Address
                        </Button>
                        <Button
                            onClick={handleCheckFeeRecipientsAllowed}
                            variant="secondary"
                        >
                            Check Fee Recipients Status
                        </Button>
                        {currentRewardAddr && (
                            <div className="mt-4">
                                <p>Current Reward Address: {currentRewardAddr}</p>
                            </div>
                        )}
                        {areRecipientsAllowed !== null && (
                            <div className="mt-4">
                                <p>Fee Recipients Allowed: {areRecipientsAllowed ? "Yes" : "No"}</p>
                            </div>
                        )}
                    </div>
                </Container>

                <Container
                    title="AllowList Controls"
                    description="Manage access control for the Reward Manager precompile."
                >
                    <AllowListControls precompileAddress={REWARD_MANAGER_ADDRESS} />
                </Container>
            </div>
        </RequireChain>
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
