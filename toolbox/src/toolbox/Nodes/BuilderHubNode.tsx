"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Container } from "../../components/Container";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import InputSubnetId from "../../components/InputSubnetId";
import BlockchainDetailsDisplay from "../../components/BlockchainDetailsDisplay";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Button } from "../../components/Button";
import { AddToWalletStep } from "../../components/AddToWalletStep";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter,
    AlertDialogHeader, 
    AlertDialogTitle 
} from "../../components/AlertDialog";

interface RegisterSubnetResponse {
    nodeID: string;
    nodePOP: {
        publicKey: string;
        proofOfPossession: string;
    };
}

export default function BuilderHubNode() {
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationResponse, setRegistrationResponse] = useState<RegisterSubnetResponse | null>(null);
    const [fullApiResponse, setFullApiResponse] = useState<any>(null);
    const [chainAddedToWallet, setChainAddedToWallet] = useState<string | null>(null);
    const [selectedBlockchainId, setSelectedBlockchainId] = useState<string>("");
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
    const [alertDialogMessage, setAlertDialogMessage] = useState("");
    const [isLoginError, setIsLoginError] = useState(false);

    const { avalancheNetworkID } = useWalletStore();

    const handleLogin = () => {
        window.location.href = "/login";
    };

    useEffect(() => {
        setSubnetIdError(null);
        setSubnet(null);
        setBlockchainInfo(null);
        setSelectedBlockchainId("");
        if (!subnetId) return;

        // Use AbortController to cancel previous requests
        const abortController = new AbortController();

        setIsLoading(true);

        const loadSubnetData = async () => {
            try {
                const subnetInfo = await getSubnetInfo(subnetId, abortController.signal);

                // Check if this request was cancelled
                if (abortController.signal.aborted) return;

                setSubnet(subnetInfo);

                // Get blockchain info for the first blockchain
                if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
                    const blockchainId = subnetInfo.blockchains[0].blockchainId;
                    setSelectedBlockchainId(blockchainId);

                    try {
                        const chainInfo = await getBlockchainInfo(blockchainId, abortController.signal);

                        // Check if this request was cancelled
                        if (abortController.signal.aborted) return;

                        setBlockchainInfo(chainInfo);
                    } catch (error) {
                        if (!abortController.signal.aborted) {
                            setSubnetIdError((error as Error).message);
                        }
                    }
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    setSubnetIdError((error as Error).message);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadSubnetData();

        // Cleanup function to abort the request if component unmounts or subnetId changes
        return () => {
            abortController.abort();
        };
    }, [subnetId]);

    const handleRegisterSubnet = async () => {
        if (!subnetId) {
            setAlertDialogTitle("Missing Information");
            setAlertDialogMessage("Please select a subnet ID first");
            setIsLoginError(false);
            setIsAlertDialogOpen(true);
            return;
        }

        setIsRegistering(true);
        setRegistrationResponse(null);

        try {
            const response = await fetch(`/api/builder-hub-node?subnetId=${subnetId}&blockchainId=${selectedBlockchainId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const rawText = await response.text();
            let data;
            
            try {
                data = JSON.parse(rawText);
            } catch (parseError) {
                throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
            }

            if (!response.ok) {
                // Temporarily remove authentication error handling
                /*
                if (response.status === 401) {
                    throw new Error("Please login first");
                }
                */
                if (response.status === 429) {
                    throw new Error(data.error?.message || "Rate limit exceeded. Please try again later.");
                }
                throw new Error(data.error?.message || `Error ${response.status}: Failed to register subnet`);
            }

            // Handle JSON-RPC response format
            if (data.error) {
                // In development, show more helpful error messages
                const isDevelopment = process.env.NODE_ENV === 'development';
                if (isDevelopment && data.error.message?.includes('Authentication required')) {
                    throw new Error('Authentication skipped in development mode. If you see this error, there might be another issue.');
                }
                throw new Error(data.error.message || 'Registration failed');
            }

            if (data.result) {
                console.log('Builder Hub registration successful:', data.result);
                setRegistrationResponse(data.result);
                setFullApiResponse(data); // Store the complete API response
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error("Builder Hub registration error:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            // Temporarily remove login-specific error handling
            /*
            if (errorMessage.includes("login") || errorMessage.includes("401")) {
                setAlertDialogTitle("Authentication Required");
                setAlertDialogMessage("You need to be logged in to register subnets with Builder Hub.");
                setIsLoginError(true);
                setIsAlertDialogOpen(true);
            } else {
            */
                setAlertDialogTitle("Registration Failed");
                setAlertDialogMessage(errorMessage);
                setIsLoginError(false);
                setIsAlertDialogOpen(true);
            /*
            }
            */
        } finally {
            setIsRegistering(false);
        }
    };

    const handleReset = () => {
        setSubnetId("");
        setSubnet(null);
        setBlockchainInfo(null);
        setSubnetIdError(null);
        setIsRegistering(false);
        setRegistrationResponse(null);
        setFullApiResponse(null);
        setChainAddedToWallet(null);
        setSelectedBlockchainId("");
        setIsAlertDialogOpen(false);
        setAlertDialogTitle("Error");
        setAlertDialogMessage("");
        setIsLoginError(false);
    };

    // Generate RPC URL for the registered node
    const rpcUrl = selectedBlockchainId 
        ? `https://multinode-experimental.solokhin.com/ext/bc/${selectedBlockchainId}/rpc`
        : "";

    return (
        <>
            <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialogTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertDialogMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex gap-2">
                        {isLoginError ? (
                            <>
                                <AlertDialogAction onClick={handleLogin} className="bg-blue-500 hover:bg-blue-600">
                                    Login
                                </AlertDialogAction>
                                <AlertDialogAction className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800">
                                    Close
                                </AlertDialogAction>
                            </>
                        ) : (
                            <AlertDialogAction>OK</AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Container
                title="Builder Hub Node Setup"
                description="Create a node for your L1 with Builder Hub's managed node infrastructure to get instant RPC access."
            >
                <Steps>
                    <Step>
                        <h3 className="text-xl font-bold mb-4">Select L1 Subnet</h3>
                        <p>Enter the Avalanche Subnet ID of the L1 you want to create a node for.</p>

                        <InputSubnetId
                            value={subnetId}
                            onChange={setSubnetId}
                            error={subnetIdError}
                        />

                        {/* Show subnet details if available */}
                        {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
                            <div className="space-y-4">
                                {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string; createBlockTimestamp: number; createBlockNumber: string; vmId: string; subnetId: string; evmChainId: number }) => (
                                    <BlockchainDetailsDisplay
                                        key={blockchain.blockchainId}
                                        blockchain={{
                                            ...blockchain,
                                            isTestnet: avalancheNetworkID === networkIDs.FujiID
                                        }}
                                        isLoading={isLoading}
                                        customTitle={`${blockchain.blockchainName} Blockchain Details`}
                                    />
                                ))}
                            </div>
                        )}
                    </Step>

                    {subnetId && blockchainInfo && (
                        <Step>
                            <h3 className="text-xl font-bold mb-4">Create Node</h3>
                            <p>Create a node for your subnet with Builder Hub's managed node infrastructure to get instant RPC access.</p>

                            {!registrationResponse && (
                                <Button 
                                    onClick={handleRegisterSubnet}
                                    loading={isRegistering}
                                    className="mt-4"
                                >
                                    Create Node
                                </Button>
                            )}

                            {registrationResponse && (
                                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                                Registration Successful
                                            </p>
                                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                                Your subnet has been registered with Builder Hub!
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RPC URL:</p>
                                            <code className="text-sm bg-white dark:bg-gray-900 px-2 py-1 rounded border font-mono text-blue-600 dark:text-blue-400 break-all">
                                                {rpcUrl}
                                            </code>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">info.getNodeID response:</p>
                                            <pre className="text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border font-mono text-gray-600 dark:text-gray-400 overflow-auto max-h-48">
                                                {JSON.stringify(fullApiResponse, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Step>
                    )}

                    {registrationResponse && selectedBlockchainId && (
                        <Step>
                            <AddToWalletStep
                                chainId={selectedBlockchainId}
                                domain="multinode-experimental.solokhin.com"
                                nodeRunningMode="server"
                                onChainAdded={setChainAddedToWallet}
                            />
                        </Step>
                    )}
                </Steps>

                {chainAddedToWallet && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Setup Complete!
                                </p>
                                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                    Chain "{chainAddedToWallet}" has been added to your wallet successfully.
                                </p>
                            </div>
                            <div className="ml-4">
                                <Button 
                                    onClick={handleReset} 
                                    variant="outline"
                                    size="sm"
                                    className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-600 dark:hover:bg-green-800"
                                >
                                    Start Over
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Container>
        </>
    );
}
